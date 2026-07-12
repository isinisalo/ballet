// This validation suite intentionally keeps the canonical graph fixture and its cross-field invariants together.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import type { ProjectAutomationConfig, ProjectStep } from "../../shared/domain/automation.js";
import {
  loadProjectAutomationConfig,
  saveProjectAutomationConfig,
  validateProjectAutomationConfig
} from "../automation.js";
import { MAX_ROOT_TRANSITIONS } from "../runtime/RuntimeDbTypes.js";

const roots: string[] = [];
const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-automation-v6-"));
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
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z"
};

const config = (): ProjectAutomationConfig => ({
  version: 6,
  loops: [{
    id: "delivery",
    theme: "open-ai",
    start: "implement",
    steps: [{
      id: "implement",
      type: "agent",
      agentId: agent.id,
      description: "Implement the change.",
      nodeSize: "medium",
      on: { approved: "review", rejected: { end: "failed" } }
    }, {
      id: "review",
      type: "human",
      description: "Review the change.",
      nodeSize: "small",
      on: { approved: { end: "completed" }, rejected: "implement" }
    }]
  }]
});

describe("automation v6 config", () => {
  it("round-trips only the canonical v6 shape", async () => {
    const root = await tempRoot();
    const saved = await saveProjectAutomationConfig(root, config(), [agent]);
    expect(saved).toEqual(config());
    expect(await loadProjectAutomationConfig(root, [agent])).toEqual(config());
    const raw = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8")) as Record<string, unknown>;
    expect(raw.version).toBe(6);
    expect(raw.agents).toEqual({});
    expect(raw).not.toHaveProperty("runtimes");
    expect(raw).not.toHaveProperty("actions");
    expect(raw).not.toHaveProperty("outputRoutes");
    expect(raw).not.toHaveProperty("humanGateResponses");
  });

  it("rejects missing starts, duplicate steps, and unknown targets", () => {
    const base = config();
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
        theme: "open-ai",
        start: "again",
        steps: [{
          id: "again",
          type: "agent",
          agentId: agent.id,
          description: "Cycle forever.",
          nodeSize: "medium",
          on: { approved: "again", rejected: "again" }
        }]
      }]
    }, [agent]).some((issue) => issue.message.includes("end or cross-loop"))).toBe(true);
  });

  it("allows cross-loop transitions only from humans and never back to the same loop", () => {
    const target = {
      id: "release",
      theme: "open-ai" as const,
      start: "finish",
      steps: [{
        id: "finish",
        type: "human" as const,
        description: "Finish.",
        nodeSize: "small" as const,
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

describe("all-approved path liveness", () => {
  it("rejects an all-approved cycle across loops", () => {
    const cyclic: ProjectAutomationConfig = {
      version: 6,
      loops: [{
        id: "planning",
        theme: "open-ai",
        start: "approve-plan",
        steps: [{
          id: "approve-plan",
          type: "human",
          description: "Approve the plan.",
          nodeSize: "small",
          on: { approved: { loop: "delivery" }, rejected: { end: "failed" } }
        }]
      }, {
        id: "delivery",
        theme: "open-ai",
        start: "approve-delivery",
        steps: [{
          id: "approve-delivery",
          type: "human",
          description: "Approve delivery.",
          nodeSize: "small",
          on: { approved: { loop: "planning" }, rejected: { end: "failed" } }
        }]
      }]
    };

    const issues = validateProjectAutomationConfig(cyclic, [agent]);
    expect(issues.filter((issue) => issue.message.includes("all-approved path cycles"))).toHaveLength(2);
  });

  it("rejects an all-approved cross-loop path longer than the runtime transition limit", () => {
    const longSteps: ProjectStep[] = Array.from(
      { length: MAX_ROOT_TRANSITIONS },
      (_, index): ProjectStep => ({
        id: `step-${index + 1}`,
        type: "human",
        description: `Complete step ${index + 1}.`,
        nodeSize: "small",
        on: {
          approved: index === MAX_ROOT_TRANSITIONS - 1
            ? { loop: "finish" }
            : `step-${index + 2}`,
          rejected: { end: "failed" }
        }
      })
    );
    const tooLong: ProjectAutomationConfig = {
      version: 6,
      loops: [{
        id: "delivery",
        theme: "open-ai",
        start: "step-1",
        steps: longSteps
      }, {
        id: "finish",
        theme: "open-ai",
        start: "complete",
        steps: [{
          id: "complete",
          type: "human",
          description: "Complete delivery.",
          nodeSize: "small",
          on: { approved: { end: "completed" }, rejected: { end: "failed" } }
        }]
      }]
    };

    expect(validateProjectAutomationConfig(tooLong, [agent])).toContainEqual({
      path: "loops.0.start",
      message: `The all-approved path exceeds the root transition limit of ${MAX_ROOT_TRANSITIONS} before reaching a terminal target.`
    });
  });

  it("allows a short all-approved chain across loops", () => {
    const short: ProjectAutomationConfig = {
      version: 6,
      loops: [{
        id: "delivery",
        theme: "open-ai",
        start: "implement",
        steps: [{
          id: "implement",
          type: "agent",
          agentId: agent.id,
          description: "Implement the task.",
          nodeSize: "medium",
          on: { approved: "code-gate", rejected: { end: "blocked" } }
        }, {
          id: "code-gate",
          type: "human",
          description: "Approve the task.",
          nodeSize: "small",
          on: { approved: { loop: "dev-deployment" }, rejected: "implement" }
        }]
      }, {
        id: "dev-deployment",
        theme: "open-ai",
        start: "deploy",
        steps: [{
          id: "deploy",
          type: "agent",
          agentId: agent.id,
          description: "Deploy to dev.",
          nodeSize: "medium",
          on: { approved: { end: "completed" }, rejected: { end: "failed" } }
        }]
      }]
    };

    expect(validateProjectAutomationConfig(short, [agent])).toEqual([]);
  });
});
