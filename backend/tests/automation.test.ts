import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import {
  loadProjectAutomationConfig,
  saveProjectAutomationConfig,
  validateProjectAutomationConfig
} from "../automation.js";

const roots: string[] = [];
const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-automation-v3-"));
  roots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const agent: Agent = {
  id: "developer-agent",
  name: "Developer",
  description: "Implements work.",
  instructions: "Implement.",
  skills: [],
  enabled: true,
  nodeStyle: "terra",
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z"
};

const config = (): ProjectAutomationConfig => ({
  version: 3,
  loops: [{
    id: "delivery",
    start: "implement",
    steps: [{
      id: "implement",
      type: "agent",
      agentId: agent.id,
      description: "Implement the change.",
      on: { approved: "review", rejected: { end: "failed" } }
    }, {
      id: "review",
      type: "human",
      description: "Review the change.",
      on: { approved: { end: "completed" }, rejected: "implement" }
    }]
  }]
});

describe("automation v3 config", () => {
  it("round-trips only the canonical v3 shape", async () => {
    const root = await tempRoot();
    const saved = await saveProjectAutomationConfig(root, config(), [agent]);
    expect(saved).toEqual(config());
    expect(await loadProjectAutomationConfig(root, [agent])).toEqual(config());
    const raw = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8")) as Record<string, unknown>;
    expect(raw.version).toBe(3);
    expect(raw).not.toHaveProperty("runtimes");
    expect(raw).not.toHaveProperty("actions");
    expect(raw).not.toHaveProperty("outputRoutes");
    expect(raw).not.toHaveProperty("humanGateResponses");
  });

  it("rejects v1 fields, invalid ids, missing starts, duplicate steps, and unknown targets", () => {
    expect(validateProjectAutomationConfig({
      version: 1,
      actions: [],
      outputRoutes: [],
      humanGateResponses: [],
      loops: [],
      runtimes: []
    }, [agent]).length).toBeGreaterThan(0);
    const base = config();
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{ ...base.loops[0]!, id: "Delivery" }]
    }, [agent]).some((issue) => issue.path === "loops.0.id")).toBe(true);
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{ ...base.loops[0]!, start: "missing" }]
    }, [agent]).some((issue) => issue.message.includes("unknown step"))).toBe(true);
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{ ...base.loops[0]!, steps: [base.loops[0]!.steps[0]!, base.loops[0]!.steps[0]!] }]
    }, [agent]).some((issue) => issue.message.includes("Duplicate step"))).toBe(true);
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{
        ...base.loops[0]!,
        steps: [{ ...base.loops[0]!.steps[0]!, on: { approved: "missing", rejected: { end: "failed" } } }]
      }]
    }, [agent]).some((issue) => issue.message.includes("unknown step"))).toBe(true);
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{
        ...base.loops[0]!,
        steps: [{ ...base.loops[0]!.steps[0]!, on: { approved: "implement" } }]
      }]
    }, [agent]).some((issue) => issue.path.includes("on.rejected"))).toBe(true);
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{
        id: "cycle",
        start: "again",
        steps: [{
          id: "again",
          type: "agent",
          agentId: agent.id,
          description: "Cycle forever.",
          on: { approved: "again", rejected: "again" }
        }]
      }]
    }, [agent]).some((issue) => issue.message.includes("end or cross-loop"))).toBe(true);
  });

  it("allows cross-loop transitions only from humans and never back to the same loop", () => {
    const target = {
      id: "release",
      start: "finish",
      steps: [{
        id: "finish",
        type: "human" as const,
        description: "Finish.",
        on: { approved: { end: "completed" as const }, rejected: { end: "failed" as const } }
      }]
    };
    const base = config();
    const agentCrossLoop = {
      ...base,
      loops: [{
        ...base.loops[0]!,
        steps: [{
          ...base.loops[0]!.steps[0]!,
          on: { approved: { loop: "release" }, rejected: { end: "failed" as const } }
        }]
      }, target]
    };
    expect(validateProjectAutomationConfig(agentCrossLoop, [agent]).some((issue) =>
      issue.message === "Only a human step may transition to another loop."
    )).toBe(true);

    const humanSelfLoop = {
      ...base,
      loops: [{
        ...base.loops[0]!,
        steps: base.loops[0]!.steps.map((step) => step.id === "review"
          ? { ...step, on: { approved: { loop: "delivery" }, rejected: "implement" } }
          : step)
      }]
    };
    expect(validateProjectAutomationConfig(humanSelfLoop, [agent]).some((issue) =>
      issue.message.includes("different loop")
    )).toBe(true);
  });
});
