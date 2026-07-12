import { access, mkdir, mkdtemp, readFile, rm, stat, symlink, truncate, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveProjectContext } from "../../project/ProjectContext.js";
import type { StoredRootRun } from "../../runs/RootRunStore.js";
import { LocalWorkspaceManager, type PreparedRootWorkspace } from "./LocalWorkspaceManager.js";
import { runGit } from "./gitProcess.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("LocalWorkspaceManager", () => {
  it("blocks dirty code while allowing versioned Ballet configuration changes", async () => {
    const fixture = await createFixture();
    await writeFile(path.join(fixture.root, "README.md"), "dirty source code\n");

    await expect(fixture.manager.prepare("dirty-run")).rejects.toThrow(
      /Commit or stash source changes before starting a Run: README\.md/
    );

    await writeFile(path.join(fixture.root, "README.md"), "initial\n");
    await writeFile(path.join(fixture.root, ".ballet", "project.json"), "{\"version\":6,\"changed\":true}\n");
    await expect(fixture.manager.inspect()).resolves.toMatchObject({
      codeDirty: false,
      ignoredRuntimePaths: expect.arrayContaining([".ballet/project.json"])
    });
  });

  it("snapshots uncommitted config, agents, skills, and tracked deletions into one root worktree", async () => {
    const fixture = await createFixture();
    await writeFile(path.join(fixture.root, ".ballet", "project.json"), "{\"version\":6,\"snapshot\":true}\n");
    await rm(path.join(fixture.root, ".codex", "agents", "tracked.md"));
    await writeFile(path.join(fixture.root, ".codex", "agents", "new.md"), "new agent\n");
    await writeFile(path.join(fixture.root, ".agents", "skills", "review", "SKILL.md"), "updated skill\n");

    const prepared = await fixture.manager.prepare("root-snapshot");

    expect(prepared.path).toBe(path.join(fixture.context.worktreesRoot, "root-snapshot"));
    expect(prepared.configHash).toBe(prepared.snapshotHash);
    expect(await readFile(path.join(prepared.path, ".ballet", "project.json"), "utf8"))
      .toContain('"snapshot":true');
    expect(await readFile(path.join(prepared.path, ".codex", "agents", "new.md"), "utf8")).toBe("new agent\n");
    await expect(access(path.join(prepared.path, ".codex", "agents", "tracked.md"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(prepared.path, ".agents", "skills", "review", "SKILL.md"), "utf8"))
      .toBe("updated skill\n");

    await writeFile(path.join(fixture.root, ".ballet", "project.json"), "{\"version\":6,\"later\":true}\n");
    expect(await readFile(path.join(prepared.path, ".ballet", "project.json"), "utf8"))
      .toContain('"snapshot":true');
  });

  it("keeps sequential step changes, commits success idempotently, and cleans up only when requested", async () => {
    const fixture = await createFixture();
    const prepared = await fixture.manager.prepare("root-success");
    await writeFile(path.join(prepared.path, "step-one.txt"), "one\n");
    await writeFile(path.join(prepared.path, "step-two.txt"), "two\n");
    await writeFile(path.join(prepared.path, " leading name.txt"), "space\n");
    await writeFile(path.join(prepared.path, "line\nbreak.txt"), "newline\n");
    await runGit(["mv", "README.md", "renamed file.md"], { cwd: prepared.path });
    const run = storedRun("root-success", prepared);

    const first = await fixture.manager.finalize(run, true);
    const replayed = await fixture.manager.finalize(run, true);

    expect(first).toMatchObject({
      success: true,
      retained: false,
      branch: prepared.branch,
      worktreePath: prepared.path,
      commitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
      changedFiles: expect.arrayContaining([
        "step-one.txt", "step-two.txt", " leading name.txt", "line\nbreak.txt", "README.md", "renamed file.md"
      ])
    });
    expect(replayed.commitSha).toBe(first.commitSha);
    expect(await stat(prepared.path)).toBeTruthy();
    expect((await runGit(["show", `${prepared.branch}:step-one.txt`], { cwd: fixture.root })).stdout).toBe("one\n");

    await fixture.manager.cleanupSuccessful(run);

    await expect(access(prepared.path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("retains an unsuccessful worktree without committing its changes", async () => {
    const fixture = await createFixture();
    const prepared = await fixture.manager.prepare("root-failed");
    await writeFile(path.join(prepared.path, "diagnostic.txt"), "keep for inspection\n");
    const run = storedRun("root-failed", prepared);

    const report = await fixture.manager.finalize(run, false);

    expect(report).toMatchObject({
      success: false,
      retained: true,
      commitSha: undefined,
      changedFiles: expect.arrayContaining(["diagnostic.txt"])
    });
    expect(await readFile(path.join(prepared.path, "diagnostic.txt"), "utf8")).toBe("keep for inspection\n");
    expect((await runGit(["rev-parse", "HEAD"], { cwd: prepared.path })).stdout.trim()).toBe(prepared.headSha);
  });

  it("never includes checkout-local state in Git status or the configuration snapshot", async () => {
    const fixture = await createFixture();
    await mkdir(path.join(fixture.context.stateRoot, "logs"), { recursive: true });
    await writeFile(path.join(fixture.context.stateRoot, "logs", "ballet.log"), "runtime log\n");
    await writeFile(fixture.context.databasePath, "not a real database in this fixture\n");

    const inspection = await fixture.manager.inspect();
    const prepared = await fixture.manager.prepare("root-state-exclusion");

    expect(inspection.codeDirty).toBe(false);
    expect(inspection.dirtyPaths).toEqual([]);
    await expect(access(path.join(prepared.path, ".git", "ballet", "state.sqlite")))
      .rejects.toMatchObject({ code: "ENOTDIR" });
  });

  it("fails closed for symlinks and oversized files in snapshot roots", async () => {
    const fixture = await createFixture();
    await symlink(path.join(fixture.root, "README.md"), path.join(fixture.root, ".ballet", "linked.md"));
    await expect(fixture.manager.prepare("root-symlink")).rejects.toThrow(
      "Snapshot path must be a regular file: .ballet/linked.md"
    );
    await rm(path.join(fixture.root, ".ballet", "linked.md"));

    const oversized = path.join(fixture.root, ".ballet", "oversized.bin");
    await writeFile(oversized, "");
    await truncate(oversized, 32 * 1024 * 1024 + 1);
    await expect(fixture.manager.prepare("root-oversized")).rejects.toThrow(
      "Snapshot file exceeds 32 MiB: .ballet/oversized.bin"
    );
  });
});

const storedRun = (rootRunId: string, prepared: PreparedRootWorkspace): StoredRootRun => ({
  rootRunId,
  kind: "agent",
  targetId: "agent",
  source: "manual",
  status: "running",
  worktreePath: prepared.path,
  branch: prepared.branch,
  headSha: prepared.headSha,
  configHash: prepared.configHash,
  snapshotHash: prepared.snapshotHash,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const createFixture = async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "ballet-local-workspace-"));
  temporaryRoots.push(fixtureRoot);
  const root = path.join(fixtureRoot, "checkout");
  await mkdir(path.join(root, ".ballet"), { recursive: true });
  await mkdir(path.join(root, ".codex", "agents"), { recursive: true });
  await mkdir(path.join(root, ".agents", "skills", "review"), { recursive: true });
  await runGit(["init", "-b", "main"], { cwd: root });
  await writeFile(path.join(root, "README.md"), "initial\n");
  await writeFile(path.join(root, ".ballet", "project.json"), "{\"version\":6}\n");
  await writeFile(path.join(root, ".codex", "agents", "tracked.md"), "tracked agent\n");
  await writeFile(path.join(root, ".agents", "skills", "review", "SKILL.md"), "initial skill\n");
  await runGit(["add", "-A"], { cwd: root });
  await runGit([
    "-c", "user.name=Ballet Test", "-c", "user.email=ballet@example.test",
    "commit", "-m", "initial"
  ], { cwd: root });
  const context = await resolveProjectContext({ root });
  return { root: context.root, context, manager: new LocalWorkspaceManager(context) };
};
