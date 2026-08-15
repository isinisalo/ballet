import { access, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { resolveProjectContext } from "../../project/ProjectContext.js";
import type { StoredRootRun } from "../../runs/RootRunStore.js";
import {
  configManifestHash,
  LocalWorkspaceManager,
  type PreparedRootWorkspace
} from "./LocalWorkspaceManager.js";
import { runGit } from "./gitProcess.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it("rejects a committed .agents symlink before snapshot materialization can escape the worktree", async () => {
  const fixtureRoot = await temporaryRoot();
  const root = path.join(fixtureRoot, "checkout");
  const externalAgents = path.join(fixtureRoot, "external-agents");
  const externalSkills = path.join(externalAgents, "skills");
  await mkdir(path.join(root, ".ballet"), { recursive: true });
  await mkdir(path.join(externalSkills, "nested"), { recursive: true });
  await writeFile(path.join(externalSkills, "sentinel.txt"), "must remain unchanged\n");
  await writeFile(path.join(externalSkills, "nested", "second.txt"), "also unchanged\n");
  await runGit(["init", "-b", "main"], { cwd: root });
  await writeFile(path.join(root, "README.md"), "initial\n");
  await writeFile(path.join(root, ".ballet", "project.json"), projectJson);
  await symlink(externalAgents, path.join(root, ".agents"));
  await commitAll(root, "commit unsafe agents link");
  await runGit(["update-index", "--skip-worktree", ".agents"], { cwd: root });
  await rm(path.join(root, ".agents"));
  await mkdir(path.join(root, ".agents"));
  const context = await resolveProjectContext({ root });
  const manager = new LocalWorkspaceManager(context);

  await expect(manager.prepare("symlink-escape")).rejects.toThrow(
    "Run workspace snapshot path must use ordinary directories: .agents"
  );

  expect((await lstat(path.join(root, ".agents"))).isDirectory()).toBe(true);
  expect(await readdir(externalSkills)).toEqual(["nested", "sentinel.txt"]);
  expect(await readFile(path.join(externalSkills, "sentinel.txt"), "utf8")).toBe("must remain unchanged\n");
  expect(await readFile(path.join(externalSkills, "nested", "second.txt"), "utf8")).toBe("also unchanged\n");
  await expect(access(path.join(context.worktreesRoot, "symlink-escape"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("rejects a nested source symlink before reading an indexed snapshot leaf", async () => {
  const fixture = await ordinaryFixture();
  const externalInstructions = path.join(fixture.fixtureRoot, "external-instructions");
  await mkdir(externalInstructions);
  await writeFile(path.join(externalInstructions, "tracked.md"), "external secret must not be captured\n");
  await rm(path.join(fixture.root, ".ballet", "instructions"), { recursive: true });
  await symlink(externalInstructions, path.join(fixture.root, ".ballet", "instructions"));

  await expect(configManifestHash(fixture.root)).rejects.toThrow(
    "Run workspace snapshot path must use ordinary directories: .ballet/instructions"
  );

  expect((await lstat(path.join(fixture.root, ".ballet", "instructions"))).isSymbolicLink()).toBe(true);
  expect(await readdir(externalInstructions)).toEqual(["tracked.md"]);
  expect(await readFile(path.join(externalInstructions, "tracked.md"), "utf8"))
    .toBe("external secret must not be captured\n");
});

it("rejects a nested support-file ancestor symlink before collision checks or restore", async () => {
  const fixture = await ordinaryFixture();
  const prepared = await fixture.manager.prepare("rehydrate-symlink");
  const externalScripts = path.join(fixture.fixtureRoot, "external-scripts");
  await mkdir(externalScripts);
  await writeFile(path.join(externalScripts, "sentinel.txt"), "external output must remain unchanged\n");
  const scriptsPath = path.join(prepared.path, ".agents", "skills", "review", "scripts");
  await symlink(externalScripts, scriptsPath);

  await expect(fixture.manager.finalize(storedRun("rehydrate-symlink", prepared), true)).rejects.toThrow(
    "Run workspace snapshot path must use ordinary directories: .agents/skills/review/scripts"
  );

  expect((await lstat(scriptsPath)).isSymbolicLink()).toBe(true);
  expect(await readdir(externalScripts)).toEqual(["sentinel.txt"]);
  expect(await readFile(path.join(externalScripts, "sentinel.txt"), "utf8"))
    .toBe("external output must remain unchanged\n");
  await expect(access(path.join(externalScripts, "check.sh"))).rejects.toMatchObject({ code: "ENOENT" });
});

const ordinaryFixture = async () => {
  const fixtureRoot = await temporaryRoot();
  const root = path.join(fixtureRoot, "checkout");
  await mkdir(path.join(root, ".ballet", "instructions"), { recursive: true });
  await mkdir(path.join(root, ".agents", "skills", "review", "scripts"), { recursive: true });
  await runGit(["init", "-b", "main"], { cwd: root });
  await writeFile(path.join(root, "README.md"), "initial\n");
  await writeFile(path.join(root, ".ballet", "project.json"), projectJson);
  await writeFile(path.join(root, ".ballet", "instructions", "tracked.md"), "tracked instruction\n");
  await writeFile(path.join(root, ".agents", "skills", "review", "SKILL.md"), "tracked skill\n");
  await writeFile(path.join(root, ".agents", "skills", "review", "scripts", "check.sh"), "echo tracked\n");
  await commitAll(root, "initial");
  const context = await resolveProjectContext({ root });
  return { fixtureRoot, root, manager: new LocalWorkspaceManager(context) };
};

const temporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-workspace-symlink-"));
  temporaryRoots.push(root);
  return root;
};

const commitAll = async (root: string, message: string): Promise<void> => {
  await runGit(["add", "-A"], { cwd: root });
  await runGit([
    "-c", "user.name=Ballet Test", "-c", "user.email=ballet@example.test",
    "commit", "-m", message
  ], { cwd: root });
};

const storedRun = (rootRunId: string, prepared: PreparedRootWorkspace): StoredRootRun => ({
  rootRunId,
  worktreePath: prepared.path,
  branch: prepared.branch,
  headSha: prepared.headSha,
  snapshotHash: prepared.snapshotHash
} as StoredRootRun);

const projectJson = `${JSON.stringify({ version: 9, executionProfiles: [], loops: [] }, null, 2)}\n`;
