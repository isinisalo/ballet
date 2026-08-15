// This validation suite intentionally keeps the canonical graph fixture and its cross-field invariants together.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultTerminalNodes,
  type ProjectAgentStep,
  type ProjectAutomationConfig
} from "../../shared/domain/automation.js";
import type { ExecutionProfile } from "../../shared/domain/projectConfig.js";
import {
  loadProjectAutomationConfig,
  saveProjectAutomationConfig,
  validateProjectAutomationConfig
} from "../automation.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";

const roots: string[] = [];
const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-automation-v9-"));
  roots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const profile: ExecutionProfile = {
  id: "primary",
  name: "Primary",
  provider: "codex",
  model: "gpt-5",
  reasoningEffort: "medium",
  networkAccess: false
};

const agentStep = (
  id: string,
  on: ProjectAgentStep["on"],
  executionProfileId = profile.id
): ProjectAgentStep => ({
  id,
  type: "agent",
  executionProfileId,
  primaryInstructionId: "project:primary",
  skillIds: [],
  description: `Execute ${id}.`,
  nodeStyle: "terra",
  nodeSize: "medium",
  on
});

const config = (): ProjectAutomationConfig => ({
  version: 9,
  loops: [{
    id: "delivery",
    start: "implement",
    nodes: [agentStep("implement", { approved: "review", rejected: "failed" }), {
      id: "review",
      type: "human",
      description: "Review the change.",
      nodeStyle: "luna",
      nodeSize: "tiny",
      on: { approved: "completed", rejected: "implement" }
    }, ...defaultTerminalNodes()]
  }]
});

describe("automation v9 config", () => {
  it("round-trips only the canonical v9 shape while preserving ExecutionProfiles", async () => {
    const root = await tempRoot();
    new ProjectConfigurationRepository().createExecutionProfile(root, profile);
    const saved = await saveProjectAutomationConfig(root, config(), [profile]);
    expect(saved).toEqual(config());
    expect(await loadProjectAutomationConfig(root)).toEqual(config());
    const raw = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8")) as Record<string, unknown>;
    expect(raw.version).toBe(9);
    expect(raw.executionProfiles).toEqual([profile]);
    expect(raw).not.toHaveProperty("agents");
    expect(raw).not.toHaveProperty("runtimes");
    expect(raw).not.toHaveProperty("actions");
    expect(raw).not.toHaveProperty("outputRoutes");
    expect(raw).not.toHaveProperty("humanGateResponses");
  });

  it("rejects missing starts, duplicate nodes, unknown targets, and missing profiles", () => {
    const base = config();
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{ ...base.loops[0]!, start: "missing" }]
    }, [profile]).some((issue) => issue.message.includes("executable node"))).toBe(true);
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{ ...base.loops[0]!, nodes: [base.loops[0]!.nodes[0]!, base.loops[0]!.nodes[0]!, ...defaultTerminalNodes()] }]
    }, [profile]).some((issue) => issue.message.includes("Duplicate node"))).toBe(true);
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{
        ...base.loops[0]!,
        nodes: [{ ...base.loops[0]!.nodes[0]!, on: { approved: "missing", rejected: "failed" } }, ...defaultTerminalNodes()]
      }]
    }, [profile]).some((issue) => issue.message.includes("unknown node"))).toBe(true);
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{
        ...base.loops[0]!,
        nodes: [agentStep("implement", { approved: "completed", rejected: "failed" }, "missing"), ...defaultTerminalNodes()]
      }]
    }, [profile])).toContainEqual(expect.objectContaining({ path: "loops.0.nodes.0.executionProfileId" }));
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{
        id: "cycle",
        start: "again",
        nodes: [agentStep("again", { approved: "again", rejected: "again" }), ...defaultTerminalNodes()]
      }]
    }, [profile]).some((issue) => issue.message.includes("terminal or cross-loop"))).toBe(true);
  });

  it("allows Agent and Human cross-Loop transitions but never back to the same Loop", () => {
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
        nodes: [agentStep("implement", { approved: { loop: "release" }, rejected: "failed" }), ...defaultTerminalNodes()]
      }, target]
    };
    expect(validateProjectAutomationConfig(agentCrossLoop, [profile])).toEqual([]);

    const humanSelfLoop = {
      ...base,
      loops: [{
        ...base.loops[0]!,
        nodes: base.loops[0]!.nodes.map((node) => node.id === "review"
          ? { ...node, on: { approved: { loop: "delivery" }, rejected: "implement" } }
          : node)
      }]
    };
    expect(validateProjectAutomationConfig(humanSelfLoop, [profile]).some((issue) =>
      issue.message.includes("different loop")
    )).toBe(true);
  });
});

describe("cyclic and cross-Loop paths", () => {
  it("allows an all-approved cycle across Loops when each Step has an exit", () => {
    const cyclic: ProjectAutomationConfig = {
      version: 9,
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

    expect(validateProjectAutomationConfig(cyclic, [profile])).toEqual([]);
  });

  it("allows a short all-approved chain across Loops", () => {
    const short: ProjectAutomationConfig = {
      version: 9,
      loops: [{
        id: "delivery",
        start: "implement",
        nodes: [agentStep("implement", { approved: "code-gate", rejected: "blocked" }), {
          id: "code-gate",
          type: "human",
          description: "Approve the task.",
          nodeStyle: "luna",
          nodeSize: "tiny",
          on: { approved: { loop: "deployment" }, rejected: "implement" }
        }, ...defaultTerminalNodes()]
      }, {
        id: "deployment",
        start: "deploy",
        nodes: [agentStep("deploy", { approved: "completed", rejected: "failed" }), ...defaultTerminalNodes()]
      }]
    };

    expect(validateProjectAutomationConfig(short, [profile])).toEqual([]);
  });
});
