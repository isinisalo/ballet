import { access, chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, truncate, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultLoopTheme } from "../../../shared/domain/loopThemes.js";
import type { ProjectConfiguration } from "../../../shared/domain/projectConfig.js";
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
    await writeFile(path.join(fixture.root, ".ballet", "project.json"), projectJson("Changed profile"));
    await expect(fixture.manager.inspect()).resolves.toMatchObject({
      codeDirty: false,
      ignoredRuntimePaths: expect.arrayContaining([".ballet/project.json"])
    });
  });

  it("snapshots uncommitted config, instructions, skills, and tracked deletions into one root worktree", async () => {
    const fixture = await createFixture();
    await writeFile(path.join(fixture.root, ".ballet", "project.json"), projectJson("Snapshot profile"));
    await rm(path.join(fixture.root, ".ballet", "instructions", "tracked.md"));
    await writeFile(
      path.join(fixture.root, ".ballet", "instructions", "new.md"),
      "---\nid: new-instruction\ntitle: New instruction\n---\nNew instruction.\n"
    );
    await writeFile(path.join(fixture.root, ".agents", "skills", "review", "SKILL.md"), "updated skill\n");

    const prepared = await fixture.manager.prepare("root-snapshot");

    expect(prepared.path).toBe(path.join(fixture.context.worktreesRoot, "root-snapshot"));
    expect(prepared.configHash).toBe(prepared.snapshotHash);
    expect(await readFile(path.join(prepared.path, ".ballet", "project.json"), "utf8"))
      .toContain('"name": "Snapshot profile"');
    expect(await readFile(path.join(prepared.path, ".ballet", "instructions", "new.md"), "utf8"))
      .toContain("id: new-instruction");
    await expect(access(path.join(prepared.path, ".ballet", "instructions", "tracked.md")))
      .rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(prepared.path, ".agents", "skills", "review", "SKILL.md"), "utf8"))
      .toBe("updated skill\n");

    await writeFile(path.join(fixture.root, ".ballet", "project.json"), projectJson("Later profile"));
    expect(await readFile(path.join(prepared.path, ".ballet", "project.json"), "utf8"))
      .toContain('"name": "Snapshot profile"');
  });

  it("keeps sequential workspace changes, commits success idempotently, and cleans up only when requested", async () => {
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

  it("retains an unsuccessful sparse worktree without committing its changes", async () => {
    const fixture = await createFixture();
    const prepared = await fixture.manager.prepare("root-failed");
    await writeFile(path.join(prepared.path, "diagnostic.txt"), "keep for inspection\n");
    const run = storedRun("root-failed", prepared);

    const report = await fixture.manager.finalize(run, false);

    expect(report).toMatchObject({
      success: false,
      retained: true,
      commitSha: undefined,
      changedFiles: expect.arrayContaining([
        ".agents/skills/review/assets/rules.txt",
        ".agents/skills/review/scripts/check.sh",
        "diagnostic.txt"
      ])
    });
    expect(await readFile(path.join(prepared.path, "diagnostic.txt"), "utf8")).toBe("keep for inspection\n");
    await expect(access(path.join(prepared.path, ".agents", "skills", "review", "scripts", "check.sh")))
      .rejects.toMatchObject({ code: "ENOENT" });
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

it("rehydrates immutable skill support files before finalizing the complete branch tree", async () => {
  const fixture = await createFixture();
  const skillRoot = path.join(fixture.root, ".agents", "skills", "review");
  const beforeExcludedChanges = await fixture.manager.inspect();
  await writeFile(path.join(skillRoot, "scripts", "check.sh"), "echo changed\n");
  await writeFile(path.join(skillRoot, "assets", "rules.txt"), "changed asset\n");
  const afterExcludedChanges = await fixture.manager.inspect();
  const prepared = await fixture.manager.prepare("skill-file-filter");

  expect(afterExcludedChanges.codeDirty).toBe(false);
  expect(afterExcludedChanges.configHash).toBe(beforeExcludedChanges.configHash);
  expect(prepared.snapshotHash).toBe(beforeExcludedChanges.configHash);
  expect(await readFile(path.join(prepared.path, ".agents", "skills", "review", "SKILL.md"), "utf8"))
    .toBe("initial skill\n");
  await expect(access(path.join(prepared.path, ".agents", "skills", "review", "scripts", "check.sh")))
    .rejects.toMatchObject({ code: "ENOENT" });
  await expect(access(path.join(prepared.path, ".agents", "skills", "review", "assets", "rules.txt")))
    .rejects.toMatchObject({ code: "ENOENT" });

  const generatedPath = path.join(prepared.path, ".agents", "skills", "review", "generated", "report.txt");
  await mkdir(path.dirname(generatedPath), { recursive: true });
  await writeFile(generatedPath, "generated during execution\n");
  await writeFile(path.join(prepared.path, "run-output.txt"), "completed\n");

  const report = await fixture.manager.finalize(storedRun("skill-file-filter", prepared), true);

  expect([...report.changedFiles].sort()).toEqual([
    ".agents/skills/review/generated/report.txt",
    "run-output.txt"
  ]);
  expect((await runGit(["ls-tree", "-r", "-z", "--name-only", prepared.branch], { cwd: fixture.root }))
    .stdout.split("\0").filter(Boolean)).toEqual([
    ".agents/skills/review/SKILL.md",
    ".agents/skills/review/assets/rules.txt",
    ".agents/skills/review/generated/report.txt",
    ".agents/skills/review/scripts/check.sh",
    ".ballet/instructions/tracked.md",
    ".ballet/project.json",
    "README.md",
    "run-output.txt"
  ]);
  expect((await runGit(["show", `${prepared.branch}:.agents/skills/review/scripts/check.sh`], { cwd: fixture.root })).stdout)
    .toBe("echo tracked\n");
  expect((await runGit(["show", `${prepared.branch}:.agents/skills/review/assets/rules.txt`], { cwd: fixture.root })).stdout)
    .toBe("tracked asset\n");
  expect((await runGit(["show", `${prepared.branch}:.agents/skills/review/generated/report.txt`], { cwd: fixture.root })).stdout)
    .toBe("generated during execution\n");
  expect((await runGit(["ls-tree", prepared.branch, "--", ".agents/skills/review/scripts/check.sh"], { cwd: fixture.root })).stdout)
    .toMatch(/^100755 blob /);
});

it("rejects non-SKILL files introduced before prepared snapshot verification", async () => {
  const fixture = await createFixture();
  const prepared = await fixture.manager.prepare("skill-overlay-verification");
  await expect(fixture.manager.verifyPreparedSnapshot(prepared)).resolves.toBeUndefined();
  const introduced = path.join(prepared.path, ".agents", "skills", "review", "scripts", "check.sh");
  await mkdir(path.dirname(introduced), { recursive: true });
  await writeFile(introduced, "echo introduced\n");

  await expect(fixture.manager.verifyPreparedSnapshot(prepared)).rejects.toThrow(
    "Prepared Run workspace contains a non-SKILL skill entry: .agents/skills/review/scripts/check.sh"
  );
});

it("fails closed instead of overwriting output at a tracked skill support path", async () => {
  const fixture = await createFixture();
  const prepared = await fixture.manager.prepare("skill-support-collision");
  const collision = path.join(prepared.path, ".agents", "skills", "review", "scripts", "check.sh");
  await mkdir(path.dirname(collision), { recursive: true });
  await writeFile(collision, "generated collision\n");

  await expect(fixture.manager.finalize(storedRun("skill-support-collision", prepared), true)).rejects.toThrow(
    "Run output conflicts with an immutable skill support file: .agents/skills/review/scripts/check.sh"
  );
  expect(await readFile(collision, "utf8")).toBe("generated collision\n");
  expect((await runGit(["rev-parse", "HEAD"], { cwd: prepared.path })).stdout.trim()).toBe(prepared.headSha);
});

const storedRun = (rootRunId: string, prepared: PreparedRootWorkspace): StoredRootRun => ({
  rootRunId,
  kind: "loop",
  targetId: "delivery",
  source: "manual",
  status: "running",
  stateRevision: 0, transitionCount: 0,
  worktreePath: prepared.path, branch: prepared.branch, headSha: prepared.headSha,
  configHash: prepared.configHash, snapshotHash: prepared.snapshotHash,
  executionSnapshot: {
    version: 2,
    rootLoopId: "delivery",
    project: {
      checkoutRoot: prepared.path,
      headSha: prepared.headSha,
      configHash: prepared.configHash,
      snapshotHash: prepared.snapshotHash
    },
    loops: projectConfiguration("Test profile").loops,
    orchestrator: projectConfiguration("Test profile").orchestrator,
    loopEdges: projectConfiguration("Test profile").loopEdges,
    theme: defaultLoopTheme,
    executionProfiles: projectConfiguration("Test profile").executionProfiles,
    runtimes: [], resources: [],
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
});

const projectConfiguration = (profileName: string): ProjectConfiguration => ({
  version: 10,
  executionProfiles: [{
    id: "test-profile",
    name: profileName,
    provider: "codex",
    model: "test-model",
    reasoningEffort: "medium",
    networkAccess: false
  }],
  orchestrator: {
    executionProfileId: "test-profile",
    primaryInstructionId: "project:tracked-instruction",
    skillIds: ["project:review"],
    maxRepairDepth: 4,
    maxRepairAttempts: 3
  },
  loops: [{
    id: "delivery",
    description: "Complete and validate the work.",
    state: { description: "Shared delivery state.", initial: {} },
    startNodeId: "work",
    nodes: [{
      id: "work",
      description: "Complete the work.",
      work: {
        type: "agent",
        task: "Complete the work.",
        executionProfileId: "test-profile",
        primaryInstructionId: "project:tracked-instruction",
        skillIds: ["project:review"],
        nodeStyle: "flat",
        nodeSize: "medium"
      },
      validation: {
        type: "human",
        task: "Validate the completed work.",
        nodeStyle: "luna",
        nodeSize: "small"
      },
      maxLocalAttempts: 3
    }],
    edges: [{ id: "work-completed", source: "work", target: { terminal: "completed" } }]
  }],
  loopEdges: []
});

const projectJson = (profileName: string): string =>
  `${JSON.stringify(projectConfiguration(profileName), null, 2)}\n`;

const createFixture = async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "ballet-local-workspace-"));
  temporaryRoots.push(fixtureRoot);
  const root = path.join(fixtureRoot, "checkout");
  await mkdir(path.join(root, ".ballet", "instructions"), { recursive: true });
  await mkdir(path.join(root, ".agents", "skills", "review"), { recursive: true });
  await runGit(["init", "-b", "main"], { cwd: root });
  await writeFile(path.join(root, "README.md"), "initial\n");
  await writeFile(path.join(root, ".ballet", "project.json"), projectJson("Initial profile"));
  await writeFile(
    path.join(root, ".ballet", "instructions", "tracked.md"),
    "---\nid: tracked-instruction\ntitle: Tracked instruction\n---\nTracked instruction.\n"
  );
  await writeFile(path.join(root, ".agents", "skills", "review", "SKILL.md"), "initial skill\n");
  await mkdir(path.join(root, ".agents", "skills", "review", "scripts"), { recursive: true });
  await mkdir(path.join(root, ".agents", "skills", "review", "assets"), { recursive: true });
  const scriptPath = path.join(root, ".agents", "skills", "review", "scripts", "check.sh");
  await writeFile(scriptPath, "echo tracked\n");
  await chmod(scriptPath, 0o755);
  await writeFile(path.join(root, ".agents", "skills", "review", "assets", "rules.txt"), "tracked asset\n");
  await runGit(["add", "-A"], { cwd: root });
  await runGit([
    "-c", "user.name=Ballet Test", "-c", "user.email=ballet@example.test",
    "commit", "-m", "initial"
  ], { cwd: root });
  const context = await resolveProjectContext({ root });
  return { root: context.root, context, manager: new LocalWorkspaceManager(context) };
};
