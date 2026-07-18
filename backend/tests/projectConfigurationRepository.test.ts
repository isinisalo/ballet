import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectConfigurationRepository, ProjectConfigurationSourceError } from "../project-config/ProjectConfigurationRepository.js";
import { defaultTerminalNodes } from "../../shared/domain/automation.js";

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
    expect(repository.load(projectRoot)).toMatchObject({ exists: false, config: { version: 8, agents: {}, loops: [] }, issues: [] });
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
      version: 8,
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

  it("loads legacy binary v8 transitions canonically without mutating source and rewrites them on save", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    await mkdir(path.dirname(repository.path(projectRoot)), { recursive: true });
    const legacy = {
      version: 8,
      agents: {},
      loops: [{
        id: "delivery",
        start: "timer",
        nodes: [{
          id: "timer", type: "scheduled", agentId: "builder", description: "Start.", nodeStyle: "luna", nodeSize: "tiny",
          schedule: { kind: "once", date: "2026-07-20", time: "09:00", timeZone: "UTC" },
          on: { approved: "review", rejected: "blocked" }
        }, {
          id: "review", type: "agent", agentId: "reviewer", description: "Review.", nodeStyle: "terra", nodeSize: "medium",
          on: { approved: "gate", rejected: "review" }
        }, {
          id: "gate", type: "human", description: "Decide.", nodeStyle: "luna", nodeSize: "tiny",
          on: { approved: "completed", rejected: "review" }
        }, ...defaultTerminalNodes()]
      }]
    };
    const source = `${JSON.stringify(legacy, null, 2)}\n`;
    await writeFile(repository.path(projectRoot), source, "utf8");

    const loaded = repository.load(projectRoot);
    expect(loaded.issues).toEqual([]);
    expect(await readFile(repository.path(projectRoot), "utf8")).toBe(source);
    const [timer, review, gate] = loaded.config!.loops[0]!.nodes;
    expect(timer).toMatchObject({
      type: "scheduled",
      on: {
        ready: { action: "goto", target: "review" },
        approved: { action: "goto", target: "review" },
        "changes-requested": { action: "terminate", status: "blocked" },
        needs_input: { action: "goto", target: "gate", input: "signal" },
        blocked: { action: "terminate", status: "blocked" },
        failed: {
          action: "retry",
          policy: {
            maxAttempts: 1,
            when: { failureClassification: "transient" },
            onExhausted: { action: "terminate", status: "failed" }
          }
        }
      }
    });
    expect(review).toMatchObject({
      type: "agent",
      on: {
        "changes-requested": {
          action: "retry",
          target: "review",
          policy: {
            maxAttempts: 3,
            stallDetection: "same-evidence",
            onExhausted: { action: "terminate", status: "blocked" }
          }
        },
        needs_input: { action: "goto", target: "gate", input: "signal" }
      }
    });
    expect(gate).toMatchObject({
      type: "human",
      on: {
        approved: { action: "goto", target: "completed", input: "append-signal" },
        rejected: {
          action: "retry",
          target: "review",
          input: "append-signal",
          policy: { maxAttempts: 3, onExhausted: { action: "terminate", status: "blocked" } }
        }
      }
    });

    repository.putAutomation(projectRoot, loaded.config!.loops);
    const stored = JSON.parse(await readFile(repository.path(projectRoot), "utf8")) as {
      loops: Array<{ nodes: Array<{ on?: Record<string, unknown> }> }>;
    };
    expect(stored.loops[0]!.nodes[0]!.on).not.toHaveProperty("rejected");
    expect(stored.loops[0]!.nodes[1]!.on).toHaveProperty("changes-requested");
    expect(JSON.stringify(stored)).not.toContain('"repair"');
    expect(JSON.stringify(stored)).not.toContain('"terminal"');
  });

  it("does not repair malformed legacy targets into valid actions", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    await mkdir(path.dirname(repository.path(projectRoot)), { recursive: true });
    await writeFile(repository.path(projectRoot), JSON.stringify({
      version: 8,
      agents: {},
      loops: [{
        id: "broken",
        start: "gate",
        nodes: [{
          id: "gate", type: "human", description: "", nodeStyle: "flat", nodeSize: "medium",
          on: { approved: "completed", rejected: 123 }
        }, ...defaultTerminalNodes()]
      }]
    }), "utf8");
    const loaded = repository.load(projectRoot);
    expect(loaded.config).toBeUndefined();
    expect(loaded.issues).not.toEqual([]);
  });

  it("continues to reject v7 project configuration", async () => {
    const projectRoot = await root();
    const repository = new ProjectConfigurationRepository();
    await mkdir(path.dirname(repository.path(projectRoot)), { recursive: true });
    await writeFile(repository.path(projectRoot), JSON.stringify({ version: 7, agents: {}, loops: [] }), "utf8");
    const loaded = repository.load(projectRoot);
    expect(loaded.config).toBeUndefined();
    expect(loaded).toMatchObject({
      issues: [expect.objectContaining({ code: "invalid_schema", path: "version" })]
    });
  });
});
