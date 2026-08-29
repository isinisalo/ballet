import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { EnvironmentWorkspaceManager } from "./EnvironmentWorkspaceManager.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("orchestration governance workspace lifetime", () => {
  test("materializes the immutable Run Evidence commit read-only and cleans it after capture", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "ballet-governance-worktree-")); roots.push(directory);
    const root = path.join(directory, "repo"); const worktrees = path.join(directory, "worktrees");
    mkdirSync(root); writeFileSync(path.join(root, "evidence.txt"), "evidence one\n"); git(root, ["init"]);
    git(root, ["add", "evidence.txt"]); commit(root, "evidence one"); const productCommit = git(root, ["rev-parse", "HEAD"]);
    writeFileSync(path.join(root, "evidence.txt"), "evidence two\n"); git(root, ["add", "evidence.txt"]); commit(root, "evidence two");
    const currentCommit = git(root, ["rev-parse", "HEAD"]);
    const manager = new EnvironmentWorkspaceManager(root, worktrees, (kind) => kind);
    const checkout = await manager.prepareReadOnly("critic-task-1", productCommit);
    expect(git(checkout, ["rev-parse", "HEAD"])).toBe(productCommit);
    expect(git(root, ["rev-parse", "HEAD"])).toBe(currentCommit);
    await manager.releaseReadOnly("critic-task-1");
    expect(existsSync(checkout)).toBe(false);
    symlinkSync(root, checkout);
    await expect(manager.prepareReadOnly("critic-task-1", productCommit)).rejects.toThrow(/ordinary directory/);
    await expect(manager.prepare("environment-run-stale", productCommit)).rejects.toThrow(/HEAD changed/);
    writeFileSync(path.join(root, "uncommitted.txt"), "dirty\n");
    await expect(manager.prepare("environment-run-1")).rejects.toThrow(/Commit or stash/);
  });
});

const git = (cwd: string, args: string[]): string => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const commit = (cwd: string, message: string): void => {
  git(cwd, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", message]);
};
