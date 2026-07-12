import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectConfigurationRepository, ProjectConfigurationSourceError } from "../project-config/ProjectConfigurationRepository.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

const root = async () => {
  const value = await mkdtemp(path.join(tmpdir(), "ballet-project-config-"));
  roots.push(value);
  return value;
};

describe("project configuration repository", () => {
  it("does not create repository state while reading a fresh checkout", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    expect(repository.load(projectRoot)).toMatchObject({ exists: false, config: { version: 6, agents: {}, loops: [] }, issues: [] });
    await expect(readFile(repository.path(projectRoot), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("atomically preserves loops while sorting agent ids", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    repository.putAutomation(projectRoot, []);
    repository.putAgentIntent(projectRoot, "reviewer", {
      provider: "copilot", model: "claude-sonnet", reasoning: "high", policy: { network: true }
    });
    repository.putAgentIntent(projectRoot, "developer", {
      provider: "codex", model: "gpt-5", reasoning: "medium", policy: { network: false }
    });
    repository.putAutomation(projectRoot, []);
    expect(JSON.parse(await readFile(repository.path(projectRoot), "utf8"))).toEqual({
      version: 6,
      agents: {
        developer: { provider: "codex", model: "gpt-5", reasoning: "medium", policy: { network: false } },
        reviewer: { provider: "copilot", model: "claude-sonnet", reasoning: "high", policy: { network: true } }
      },
      loops: []
    });
    expect(await readdir(path.join(projectRoot, ".ballet"))).toEqual(["project.json"]);
  });

  it("preserves invalid project source", async () => {
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
    expect(() => repository.putAgentIntent(projectRoot, "developer", {
      provider: "codex", model: "gpt-5", reasoning: "high", policy: { network: false }
    })).toThrow(ProjectConfigurationSourceError);
    expect(await readFile(repository.path(projectRoot), "utf8")).toBe(invalidJson);
  });
});
