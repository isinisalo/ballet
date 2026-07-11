import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSnapshotStore } from "../git/ConfigSnapshotStore.js";
import { GitWorkspaceManager } from "../git/GitWorkspaceManager.js";
import { runGit } from "../git/gitProcess.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-git-manager-"));
  roots.push(root);
  const source = path.join(root, "source");
  const home = path.join(root, "home");
  await mkdir(source, { recursive: true });
  await runGit(["init", "-b", "main"], { cwd: source });
  await writeFile(path.join(source, "README.md"), "initial\n");
  await mkdir(path.join(source, ".ballet"), { recursive: true });
  await writeFile(path.join(source, ".ballet", "project.json"), "{\"version\":1}\n");
  await runGit(["add", "-A"], { cwd: source });
  await runGit(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-m", "initial"], { cwd: source });
  const manager = new GitWorkspaceManager({ root: home });
  await manager.cloneProject("project-1", source);
  const repository = path.join(home, "projects", "project-1", "repo");
  await mkdir(path.join(repository, ".agents", "skills", "local"), { recursive: true });
  await writeFile(path.join(repository, ".agents", "skills", "local", "SKILL.md"), "local runtime skill\n");
  await writeFile(path.join(repository, ".ballet", "project.json"), "{\"version\":2}\n");
  const headSha = (await runGit(["rev-parse", "HEAD"], { cwd: repository })).stdout.trim();
  const snapshots = new ConfigSnapshotStore(path.join(home, "cache", "config-snapshots"));
  const snapshot = await snapshots.capture(repository);
  return { root, source, home, repository, manager, headSha, snapshot };
};

describe("GitWorkspaceManager", () => {
  it("materializes a verified config snapshot on exact HEAD, commits every result, and cleans the worktree", async () => {
    const context = await fixture();
    await writeFile(path.join(context.repository, ".ballet", "project.json"), "{\"version\":3}\n");
    await writeFile(path.join(context.repository, "README.md"), "changed after Start\n");
    const prepared = await context.manager.prepare({
      executionId: "task-1",
      rootRunId: "01900000-0000-7000-8000-000000000001",
      projectId: "project-1",
      repositoryUrl: context.source,
      headSha: context.headSha,
      expectedSnapshotHash: context.snapshot.hash
    });

    expect(prepared.branch).toBe("ballet/run/01900000-000");
    expect((await runGit(["rev-parse", "HEAD"], { cwd: prepared.path })).stdout.trim()).toBe(context.headSha);
    expect(await readFile(path.join(prepared.path, ".ballet", "project.json"), "utf8")).toContain('"version":2');
    expect(await readFile(path.join(prepared.path, ".agents", "skills", "local", "SKILL.md"), "utf8")).toContain("local runtime skill");

    await writeFile(path.join(prepared.path, "README.md"), "completed\n");
    const finalized = await context.manager.finalize(prepared, true);

    expect(finalized.retained).toBe(false);
    expect(finalized.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(finalized.changedFiles).toEqual(expect.arrayContaining(["README.md", ".ballet/project.json", ".agents/skills/local/SKILL.md"]));
    await expect(stat(prepared.path)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await runGit(["show", `${prepared.branch}:README.md`], { cwd: context.repository })).stdout).toBe("completed\n");
  });

  it("reuses and locks one retained worktree for sequential tasks in the same root run", async () => {
    const context = await fixture();
    const request = {
      rootRunId: "01900000-0000-7000-8000-000000000002",
      projectId: "project-1",
      repositoryUrl: context.source,
      headSha: context.headSha,
      expectedSnapshotHash: context.snapshot.hash
    };
    const first = await context.manager.prepare({ ...request, executionId: "task-a" });
    await writeFile(path.join(first.path, "step-a.txt"), "retained\n");
    await context.manager.release(first);
    await writeFile(path.join(context.repository, ".ballet", "project.json"), "{\"version\":99}\n");
    await writeFile(path.join(context.repository, "README.md"), "source changed between steps\n");
    const second = await context.manager.prepare({ ...request, executionId: "task-b" });

    expect(second.path).toBe(first.path);
    expect(await readFile(path.join(second.path, "step-a.txt"), "utf8")).toBe("retained\n");
    const retained = await context.manager.finalize(second, false);
    expect(retained.retained).toBe(true);
    expect(await stat(second.path)).toBeTruthy();
  });

  it("reports source code dirt for Start preflight", async () => {
    const context = await fixture();
    await writeFile(path.join(context.repository, "README.md"), "dirty code\n");
    await expect(context.manager.inspectManagedProject("project-1")).resolves.toMatchObject({ codeDirty: true });
  });

  it("fails closed when the immutable config snapshot hash differs", async () => {
    const context = await fixture();
    await expect(context.manager.prepare({
      executionId: "task-hash",
      rootRunId: "01900000-0000-7000-8000-000000000004",
      projectId: "project-1",
      repositoryUrl: context.source,
      headSha: context.headSha,
      expectedSnapshotHash: "0".repeat(64)
    })).rejects.toThrow("is not available in the local content-addressed store");
  });

  it("finalizes a retained human-terminal root and durably replays its report after cleanup", async () => {
    const context = await fixture();
    const rootRunId = "01900000-0000-7000-8000-000000000005";
    const prepared = await context.manager.prepare({
      executionId: "task-human-loop",
      rootRunId,
      projectId: "project-1",
      repositoryUrl: context.source,
      headSha: context.headSha,
      expectedSnapshotHash: context.snapshot.hash
    });
    await writeFile(path.join(prepared.path, "human-terminal.txt"), "ready\n");
    await context.manager.release(prepared);

    const finalized = await context.manager.finalizeRoot("project-1", rootRunId, true);
    const replayed = await context.manager.finalizeRoot("project-1", rootRunId, true);

    expect(finalized).toMatchObject({ success: true, retained: false, changedFiles: expect.arrayContaining(["human-terminal.txt"]) });
    expect(replayed).toEqual(finalized);
    await expect(stat(prepared.path)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await runGit(["show", `${prepared.branch}:human-terminal.txt`], { cwd: context.repository })).stdout).toBe("ready\n");
    const journal = JSON.parse(await readFile(path.join(
      context.home, "projects", "project-1", "finalizations", `${rootRunId}.json`
    ), "utf8")) as { report: unknown };
    expect(journal.report).toEqual(finalized);
  });
});
