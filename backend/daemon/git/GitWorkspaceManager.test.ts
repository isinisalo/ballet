import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { GitWorkspaceManager } from "./GitWorkspaceManager.js";

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("GitWorkspaceManager", () => {
  it("refreshes the paired checkout and materializes the exact config snapshot", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ballet-daemon-git-"));
    roots.push(root);
    const source = path.join(root, "source");
    await mkdir(path.join(source, ".ballet"), { recursive: true });
    const config = JSON.parse(await readFile(path.resolve(".ballet/project.json"), "utf8")) as Record<string, unknown>;
    await writeFile(path.join(source, ".ballet", "project.json"), `${JSON.stringify(config, null, 2)}\n`);
    await git(source, "init", "-b", "main");
    await git(source, "config", "user.email", "ballet@example.test");
    await git(source, "config", "user.name", "Ballet Test");
    await git(source, "add", ".ballet/project.json");
    await git(source, "commit", "-m", "Initial project");

    const manager = new GitWorkspaceManager({ root: path.join(root, "daemon") });
    await manager.cloneProject("project-test", source);
    const initial = await manager.inspectManagedProject("project-test");
    expect(initial.configHash).toMatch(/^[0-9a-f]{64}$/);
    expect(initial.snapshotHash).toMatch(/^[0-9a-f]{64}$/);

    const environment = config.environment as Record<string, unknown>;
    environment.description = `${String(environment.description)} updated`;
    await writeFile(path.join(source, ".ballet", "project.json"), `${JSON.stringify(config, null, 2)}\n`);
    await git(source, "add", ".ballet/project.json");
    await git(source, "commit", "-m", "Update project");

    const refreshed = await manager.refreshManagedProject("project-test");
    expect(refreshed.headSha).not.toBe(initial.headSha);
    expect(refreshed.configHash).not.toBe(initial.configHash);
    expect(refreshed.snapshotHash).not.toBe(initial.snapshotHash);

    const workspace = await manager.prepare({
      executionId: "task-1",
      rootRunId: "root-run-1",
      projectId: "project-test",
      repositoryUrl: source,
      headSha: refreshed.headSha,
      expectedSnapshotHash: refreshed.snapshotHash
    });
    expect(JSON.parse(await readFile(path.join(workspace.path, ".ballet", "project.json"), "utf8")))
      .toMatchObject({ environment: { description: environment.description } });
    const finalized = await manager.finalize(workspace, true);
    expect(finalized).toMatchObject({ success: true, retained: false, snapshotHash: refreshed.snapshotHash });
    expect(finalized.commitSha).toMatch(/^[0-9a-f]{40}$/);
  });
});

const git = async (cwd: string, ...args: string[]): Promise<void> => {
  await execFileAsync("git", args, { cwd });
};
