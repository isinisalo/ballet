import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runGit } from "../execution/git/gitProcess.js";
import { resolveProjectContext } from "./ProjectContext.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ProjectContext", () => {
  it("accepts exactly a committed Git checkout root and keeps its state below .git", async () => {
    const root = await createRepository("project");

    const first = await resolveProjectContext({ root });
    const second = await resolveProjectContext({ root });

    expect(first.root).toBe(root);
    expect(first.headSha).toMatch(/^[0-9a-f]{40}$/);
    expect(first.stateRoot).toBe(path.join(root, ".git", "ballet"));
    expect(first.databasePath).toBe(path.join(root, ".git", "ballet", "state.sqlite"));
    expect(first.instanceId).toBe(second.instanceId);
    expect(first.serviceLabel).toMatch(/^ai\.ballet\.[0-9a-f]{16}$/);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("rejects a checkout subdirectory and a directory outside Git", async () => {
    const root = await createRepository("project");
    const nested = path.join(root, "nested");
    await mkdir(nested);
    const outside = await createTemporaryRoot("outside");

    await expect(resolveProjectContext({ root: nested })).rejects.toThrow(
      `Ballet must be started at the Git checkout root: ${root}`
    );
    await expect(resolveProjectContext({ root: outside })).rejects.toThrow(/git rev-parse --show-toplevel failed/);
  });

  it("rejects a Git checkout without a HEAD commit", async () => {
    const root = await createTemporaryRoot("unborn");
    await runGit(["init", "-b", "main"], { cwd: root });

    await expect(resolveProjectContext({ root })).rejects.toThrow(/git rev-parse HEAD failed/);
  });

  it("gives two clones isolated state roots, instance ids, and launchd labels", async () => {
    const origin = await createRepository("origin");
    const fixtureRoot = path.dirname(origin);
    const cloneA = path.join(fixtureRoot, "clone-a");
    const cloneB = path.join(fixtureRoot, "clone-b");
    await runGit(["clone", "--quiet", origin, cloneA], { cwd: fixtureRoot });
    await runGit(["clone", "--quiet", origin, cloneB], { cwd: fixtureRoot });

    const first = await resolveProjectContext({ root: cloneA });
    const second = await resolveProjectContext({ root: cloneB });

    expect(first.stateRoot).toBe(path.join(cloneA, ".git", "ballet"));
    expect(second.stateRoot).toBe(path.join(cloneB, ".git", "ballet"));
    expect(first.stateRoot).not.toBe(second.stateRoot);
    expect(first.instanceId).not.toBe(second.instanceId);
    expect(first.serviceLabel).not.toBe(second.serviceLabel);
  });

  it("fails closed when an explicit state root escapes the checkout Git directory", async () => {
    const root = await createRepository("project");

    await expect(resolveProjectContext({ root, stateRoot: path.join(root, ".ballet-state") }))
      .rejects.toThrow("Ballet state root must be a child of this checkout's Git directory.");
  });

  it("accepts a canonical .git/ballet state root through a symlinked path alias", async () => {
    const root = await createRepository("aliased-state");
    const alias = path.join(path.dirname(root), "git-alias");
    await symlink(path.join(root, ".git"), alias, "dir");

    const context = await resolveProjectContext({ root, stateRoot: path.join(alias, "ballet") });

    expect(context.stateRoot).toBe(path.join(root, ".git", "ballet"));
  });
});

const createRepository = async (name: string): Promise<string> => {
  const fixtureRoot = await createTemporaryRoot(`repo-${name}`);
  const root = path.join(fixtureRoot, name);
  await mkdir(root);
  await runGit(["init", "-b", "main"], { cwd: root });
  await writeFile(path.join(root, "README.md"), `${name}\n`);
  await runGit(["add", "README.md"], { cwd: root });
  await runGit([
    "-c", "user.name=Ballet Test", "-c", "user.email=ballet@example.test",
    "commit", "-m", "initial"
  ], { cwd: root });
  return root;
};

const createTemporaryRoot = async (name: string): Promise<string> => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), `ballet-${name}-`)));
  temporaryRoots.push(root);
  return root;
};
