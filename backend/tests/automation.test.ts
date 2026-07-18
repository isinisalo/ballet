// This validation suite intentionally keeps the canonical graph fixture and its cross-field invariants together.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import {
  defaultTerminalNodes,
  type ProjectAutomationConfig
} from "../../shared/domain/automation.js";
import {
  loadProjectAutomationConfig,
  saveProjectAutomationConfig,
  validateProjectAutomationConfig
} from "../automation.js";

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

  it("allows agent and human cross-loop transitions but never back to the same loop", () => {
    const target = {
      id: "release",
      start: "finish",
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
    expect(validateProjectAutomationConfig(agentCrossLoop, [agent])).toEqual([]);

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

describe("cyclic and cross-loop paths", () => {
  it("allows an all-approved cycle across loops when each Step has an exit", () => {
    const cyclic: ProjectAutomationConfig = {
      version: 8,
      loops: [{
        id: "planning",
        start: "approve-plan",
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

    expect(validateProjectAutomationConfig(cyclic, [agent])).toEqual([]);
  });

  it("allows a short all-approved chain across loops", () => {
    const short: ProjectAutomationConfig = {
      version: 8,
      loops: [{
        id: "delivery",
        start: "implement",
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
