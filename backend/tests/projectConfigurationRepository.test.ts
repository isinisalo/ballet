import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectAutomationConfig, ProjectLoop } from "../../shared/domain/automation.js";
import { defaultProjectConfiguration, type ExecutionProfile } from "../../shared/domain/projectConfig.js";
import { ExecutionProfileConflictError, ExecutionProfileNotFoundError } from "../project-config/ExecutionProfileErrors.js";
import { ProjectConfigurationRepository, ProjectConfigurationSourceError } from "../project-config/ProjectConfigurationRepository.js";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const root = async () => {
  const value = await mkdtemp(path.join(tmpdir(), "ballet-project-config-"));
  roots.push(value);
  return value;
};

const profile = (id: string, networkAccess = false): ExecutionProfile => ({
  id,
  name: id,
  provider: "codex",
  model: "gpt-5",
  reasoningEffort: "medium",
  networkAccess
});

const loop = (executionProfileId: string): ProjectLoop => ({
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
      executionProfileId,
      primaryInstructionId: "project:primary",
      skillIds: ["project:zeta", "project:alpha"],
      nodeStyle: "terra",
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
});

const automation = (executionProfileId: string): ProjectAutomationConfig => ({
  version: 10,
  orchestrator: {
    executionProfileId,
    primaryInstructionId: "project:primary",
    skillIds: ["project:zeta", "project:alpha"],
    maxRepairDepth: 4,
    maxRepairAttempts: 3
  },
  loops: [loop(executionProfileId)],
  loopEdges: []
});

describe("project configuration repository", () => {
  it("does not create repository state while reading a fresh checkout", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    expect(repository.load(projectRoot)).toMatchObject({
      exists: false,
      config: { version: 10, executionProfiles: [], orchestrator: expect.any(Object), loops: [], loopEdges: [] },
      issues: []
    });
    await expect(readFile(repository.path(projectRoot), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("atomically preserves Loops while sorting ExecutionProfiles and execution composition skills", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    repository.createExecutionProfile(projectRoot, profile("zeta", true));
    repository.createExecutionProfile(projectRoot, profile("alpha"));
    repository.putAutomation(projectRoot, automation("zeta"));

    expect(JSON.parse(await readFile(repository.path(projectRoot), "utf8"))).toEqual({
      version: 10,
      executionProfiles: [profile("alpha"), profile("zeta", true)],
      orchestrator: {
        ...automation("zeta").orchestrator,
        skillIds: ["project:alpha", "project:zeta"]
      },
      loops: [{
        ...loop("zeta"),
        nodes: [{
          ...loop("zeta").nodes[0]!,
          work: { ...loop("zeta").nodes[0]!.work, skillIds: ["project:alpha", "project:zeta"] }
        }]
      }],
      loopEdges: []
    });
    expect(await readdir(path.join(projectRoot, ".ballet"))).toEqual(["project.json"]);
  });

  it("rejects duplicate creates and missing updates without changing project config", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    repository.createExecutionProfile(projectRoot, profile("primary"));
    const before = await readFile(repository.path(projectRoot), "utf8");

    expect(() => repository.createExecutionProfile(projectRoot, profile("primary", true)))
      .toThrow(ExecutionProfileConflictError);
    expect(() => repository.updateExecutionProfile(projectRoot, profile("missing")))
      .toThrow(ExecutionProfileNotFoundError);
    expect(await readFile(repository.path(projectRoot), "utf8")).toBe(before);
  });

  it("rejects strict-v8 source clearly and leaves it unchanged", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    await mkdir(path.dirname(repository.path(projectRoot)), { recursive: true });
    const legacySource = `${JSON.stringify({ version: 8, loops: [] }, null, 2)}\n`;
    await writeFile(repository.path(projectRoot), legacySource, "utf8");

    expect(repository.load(projectRoot)).toMatchObject({
      exists: true,
      source: legacySource,
      issues: [expect.objectContaining({
        code: "invalid_schema",
        path: "version",
        message: expect.stringContaining("version 10 is required")
      })]
    });
    expect(() => repository.createExecutionProfile(projectRoot, profile("primary")))
      .toThrow(ProjectConfigurationSourceError);
    expect(await readFile(repository.path(projectRoot), "utf8")).toBe(legacySource);
  });

  it("preserves invalid JSON source", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    await mkdir(path.dirname(repository.path(projectRoot)), { recursive: true });
    const invalidJson = "{ definitely not json\n";
    await writeFile(repository.path(projectRoot), invalidJson, "utf8");
    expect(repository.load(projectRoot)).toMatchObject({
      exists: true,
      source: invalidJson,
      issues: [expect.objectContaining({ code: "invalid_json", path: ".ballet/project.json" })]
    });
    expect(() => repository.createExecutionProfile(projectRoot, profile("primary")))
      .toThrow(ProjectConfigurationSourceError);
    expect(await readFile(repository.path(projectRoot), "utf8")).toBe(invalidJson);
  });

  it("rejects invalid UTF-8 without replacing or rewriting its bytes", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    await mkdir(path.dirname(repository.path(projectRoot)), { recursive: true });
    const invalidUtf8 = Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x7d]);
    await writeFile(repository.path(projectRoot), invalidUtf8);

    expect(repository.load(projectRoot)).toMatchObject({
      exists: true,
      issues: [expect.objectContaining({
        code: "invalid_json",
        path: ".ballet/project.json",
        message: expect.stringContaining("valid UTF-8 JSON")
      })]
    });
    expect(() => repository.createExecutionProfile(projectRoot, profile("primary")))
      .toThrow(ProjectConfigurationSourceError);
    expect(await readFile(repository.path(projectRoot))).toEqual(invalidUtf8);
  });
});

describe("project configuration repository source safety", () => {
  it("never follows or replaces a symlinked project.json", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    const outside = path.join(projectRoot, "outside.json");
    const outsideSource = `${JSON.stringify(defaultProjectConfiguration(), null, 2)}\n`;
    await writeFile(outside, outsideSource, "utf8");
    await mkdir(path.dirname(repository.path(projectRoot)), { recursive: true });
    await symlink(outside, repository.path(projectRoot));

    const loaded = repository.load(projectRoot);
    expect(loaded).toMatchObject({
      exists: true,
      issues: [expect.objectContaining({
        code: "invalid_schema",
        path: ".ballet/project.json",
        message: expect.stringContaining("must not be a symbolic link")
      })]
    });
    expect(loaded).not.toHaveProperty("source");
    expect(() => repository.createExecutionProfile(projectRoot, profile("primary")))
      .toThrow(ProjectConfigurationSourceError);
    expect((await lstat(repository.path(projectRoot))).isSymbolicLink()).toBe(true);
    expect(await readlink(repository.path(projectRoot))).toBe(outside);
    expect(await readFile(outside, "utf8")).toBe(outsideSource);
  });

  it("rejects a symlinked .ballet parent on load and immediately before writing", async () => {
    const projectRoot = await root();
    const outsideRoot = await root();
    const repository = new ProjectConfigurationRepository();
    const outsideDirectory = path.join(outsideRoot, "external-ballet");
    const outsideProject = path.join(outsideDirectory, "project.json");
    const outsideSource = `${JSON.stringify(defaultProjectConfiguration(), null, 2)}\n`;
    await mkdir(outsideDirectory);
    await writeFile(outsideProject, outsideSource, "utf8");
    await symlink(outsideDirectory, path.join(projectRoot, ".ballet"), "dir");

    expect(repository.load(projectRoot)).toMatchObject({
      exists: true,
      issues: [expect.objectContaining({
        code: "invalid_schema",
        path: ".ballet",
        message: expect.stringContaining("must not be a symbolic link")
      })]
    });

    vi.spyOn(repository, "load").mockReturnValue({
      path: repository.path(projectRoot),
      exists: false,
      config: defaultProjectConfiguration(),
      issues: []
    });
    expect(() => repository.createExecutionProfile(projectRoot, profile("primary")))
      .toThrow(ProjectConfigurationSourceError);

    expect((await lstat(path.join(projectRoot, ".ballet"))).isSymbolicLink()).toBe(true);
    expect(await readlink(path.join(projectRoot, ".ballet"))).toBe(outsideDirectory);
    expect(await readFile(outsideProject, "utf8")).toBe(outsideSource);
    expect(await readdir(outsideDirectory)).toEqual(["project.json"]);
  });

  it("rejects a non-directory .ballet parent without replacing it", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    const balletPath = path.join(projectRoot, ".ballet");
    await writeFile(balletPath, "preserve me", "utf8");

    expect(repository.load(projectRoot)).toMatchObject({
      exists: true,
      issues: [expect.objectContaining({ path: ".ballet", message: expect.stringContaining("ordinary directory") })]
    });
    vi.spyOn(repository, "load").mockReturnValue({
      path: repository.path(projectRoot),
      exists: false,
      config: defaultProjectConfiguration(),
      issues: []
    });
    expect(() => repository.createExecutionProfile(projectRoot, profile("primary")))
      .toThrow(ProjectConfigurationSourceError);
    expect(await readFile(balletPath, "utf8")).toBe("preserve me");
  });

  it("cannot remove an ExecutionProfile still referenced by v10 compositions", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    repository.createExecutionProfile(projectRoot, profile("primary"));
    repository.putAutomation(projectRoot, automation("primary"));
    const before = await readFile(repository.path(projectRoot), "utf8");

    expect(() => repository.removeExecutionProfile(projectRoot, "primary"))
      .toThrow(ProjectConfigurationSourceError);
    expect(await readFile(repository.path(projectRoot), "utf8")).toBe(before);
  });
});
