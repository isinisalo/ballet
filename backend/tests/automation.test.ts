// This validation suite intentionally keeps the canonical graph fixture and its cross-field invariants together.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import {
  defaultTerminalNodes,
  type ProjectAutomationConfig,
  type ProjectStep
} from "../../shared/domain/automation.js";
import {
  loadProjectAutomationConfig,
  saveProjectAutomationConfig,
  validateProjectAutomationConfig
} from "../automation.js";
import { MAX_ROOT_TRANSITIONS } from "../runtime/RuntimeDbTypes.js";

const roots: string[] = [];
const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-automation-v8-"));
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
  version: 8,
  loops: [{
    id: "delivery",
    start: "implement",
    summaryStyle: "route",
    nodes: [{
      id: "implement",
      type: "agent",
      agentId: agent.id,
      description: "Implement the change.",
      nodeStyle: "terra",
      nodeSize: "medium",
      on: { approved: "review", rejected: "failed" }
    }, {
      id: "review",
      type: "human",
      description: "Review the change.",
      nodeStyle: "luna",
      nodeSize: "tiny",
      on: { approved: "completed", rejected: "implement" }
    }, ...defaultTerminalNodes()]
  }]
});

describe("automation v8 config", () => {
  it("round-trips only the canonical v8 shape", async () => {
    const root = await tempRoot();
    const saved = await saveProjectAutomationConfig(root, config(), [agent]);
    expect(saved).toEqual(config());
    expect(await loadProjectAutomationConfig(root, [agent])).toEqual(config());
    const raw = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8")) as Record<string, unknown>;
    expect(raw.version).toBe(8);
    expect(raw.agents).toEqual({});
    expect(raw).not.toHaveProperty("runtimes");
    expect(raw).not.toHaveProperty("actions");
    expect(raw).not.toHaveProperty("outputRoutes");
    expect(raw).not.toHaveProperty("humanGateResponses");
  });

  it("rejects missing starts, duplicate nodes, and unknown targets", () => {
    const base = config();
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{ ...base.loops[0]!, start: "missing" }]
    }, [agent]).some((issue) => issue.message.includes("executable node"))).toBe(true);
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{ ...base.loops[0]!, nodes: [base.loops[0]!.nodes[0]!, base.loops[0]!.nodes[0]!, ...defaultTerminalNodes()] }]
    }, [agent]).some((issue) => issue.message.includes("Duplicate node"))).toBe(true);
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{
        ...base.loops[0]!,
        nodes: [{ ...base.loops[0]!.nodes[0]!, on: { approved: "missing", rejected: "failed" } }, ...defaultTerminalNodes()]
      }]
    }, [agent]).some((issue) => issue.message.includes("unknown node"))).toBe(true);
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{
        ...base.loops[0]!,
        nodes: [{ ...base.loops[0]!.nodes[0]!, on: { approved: "implement" } }, ...defaultTerminalNodes()]
      }]
    }, [agent]).some((issue) => issue.path.includes("on.rejected"))).toBe(true);
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{
        id: "cycle",
        start: "again",
        summaryStyle: "route",
        nodes: [{
          id: "again",
          type: "agent",
          agentId: agent.id,
          description: "Cycle forever.",
          nodeStyle: "terra",
          nodeSize: "medium",
          on: { approved: "again", rejected: "again" }
        }, ...defaultTerminalNodes()]
      }]
    }, [agent]).some((issue) => issue.message.includes("terminal or cross-loop"))).toBe(true);
  });

  it("allows cross-loop transitions only from humans and never back to the same loop", () => {
    const target = {
      id: "release",
      start: "finish",
      summaryStyle: "route" as const,
      nodes: [{
        id: "finish",
        type: "human" as const,
        description: "Finish.",
        nodeStyle: "luna" as const,
        nodeSize: "tiny" as const,
        on: { approved: "completed", rejected: "failed" }
      }, ...defaultTerminalNodes()]
    };
    const base = config();
    const agentCrossLoop = {
      ...base,
      loops: [{
        ...base.loops[0]!,
        nodes: [{
          ...base.loops[0]!.nodes[0]!,
          on: { approved: { loop: "release" }, rejected: "failed" }
        }, ...defaultTerminalNodes()]
      }, target]
    };
    expect(validateProjectAutomationConfig(agentCrossLoop, [agent]).some((issue) =>
      issue.message === "Only a human step may transition to another loop."
    )).toBe(true);

    const humanSelfLoop = {
      ...base,
      loops: [{
        ...base.loops[0]!,
        nodes: base.loops[0]!.nodes.map((node) => node.id === "review"
          ? { ...node, on: { approved: { loop: "delivery" }, rejected: "implement" } }
          : node)
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
      version: 8,
      loops: [{
        id: "planning",
        start: "approve-plan",
        summaryStyle: "route",
        nodes: [{
          id: "approve-plan",
          type: "human",
          description: "Approve the plan.",
          nodeStyle: "luna",
          nodeSize: "tiny",
          on: { approved: { loop: "delivery" }, rejected: "failed" }
        }, ...defaultTerminalNodes()]
      }, {
        id: "delivery",
        start: "approve-delivery",
        summaryStyle: "route",
        nodes: [{
          id: "approve-delivery",
          type: "human",
          description: "Approve delivery.",
          nodeStyle: "luna",
          nodeSize: "tiny",
          on: { approved: { loop: "planning" }, rejected: "failed" }
        }, ...defaultTerminalNodes()]
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
        nodeStyle: "luna",
        nodeSize: "tiny",
        on: {
          approved: index === MAX_ROOT_TRANSITIONS - 1
            ? { loop: "finish" }
            : `step-${index + 2}`,
          rejected: "failed"
        }
      })
    );
    const tooLong: ProjectAutomationConfig = {
      version: 8,
      loops: [{
        id: "delivery",
        start: "step-1",
        summaryStyle: "route",
        nodes: [...longSteps, ...defaultTerminalNodes()]
      }, {
        id: "finish",
        start: "complete",
        summaryStyle: "route",
        nodes: [{
          id: "complete",
          type: "human",
          description: "Complete delivery.",
          nodeStyle: "luna",
          nodeSize: "tiny",
          on: { approved: "completed", rejected: "failed" }
        }, ...defaultTerminalNodes()]
      }]
    };

    expect(validateProjectAutomationConfig(tooLong, [agent])).toContainEqual({
      path: "loops.0.start",
      message: `The all-approved path exceeds the root transition limit of ${MAX_ROOT_TRANSITIONS} before reaching a terminal target.`
    });
  });

  it("allows a short all-approved chain across loops", () => {
    const short: ProjectAutomationConfig = {
      version: 8,
      loops: [{
        id: "delivery",
        start: "implement",
        summaryStyle: "route",
        nodes: [{
          id: "implement",
          type: "agent",
          agentId: agent.id,
          description: "Implement the task.",
          nodeStyle: "terra",
          nodeSize: "medium",
          on: { approved: "code-gate", rejected: "blocked" }
        }, {
          id: "code-gate",
          type: "human",
          description: "Approve the task.",
          nodeStyle: "luna",
          nodeSize: "tiny",
          on: { approved: { loop: "dev-deployment" }, rejected: "implement" }
        }, ...defaultTerminalNodes()]
      }, {
        id: "dev-deployment",
        start: "deploy",
        summaryStyle: "route",
        nodes: [{
          id: "deploy",
          type: "agent",
          agentId: agent.id,
          description: "Deploy to dev.",
          nodeStyle: "terra",
          nodeSize: "medium",
          on: { approved: "completed", rejected: "failed" }
        }, ...defaultTerminalNodes()]
      }]
    };

    expect(validateProjectAutomationConfig(short, [agent])).toEqual([]);
  });
});
