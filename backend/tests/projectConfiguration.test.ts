import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import type { Agent } from "../../shared/domain/agents.js";
import { isProjectTerminalNode, type LoopNodeStyle, type ProjectAutomationConfig, type StepTransitionTarget } from "../../shared/domain/automation.js";
import { validateProjectAutomationConfig } from "../automation.js";
import { parseTomlDocument } from "../markdown.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface ExpectedAgentConfig {
  model: string;
  reasoning: "medium";
  network: boolean;
  nodeStyle: LoopNodeStyle;
}

const expectedAgents: Record<string, ExpectedAgentConfig> = {
  "acceptance-test-agent": { model: "gpt-5.6-terra", reasoning: "medium", network: true, nodeStyle: "terra" },
  "architecture-agent": { model: "gpt-5.6-sol", reasoning: "medium", network: false, nodeStyle: "sol" },
  "implementation-agent": { model: "gpt-5.6-terra", reasoning: "medium", network: false, nodeStyle: "terra" },
  "implementation-plan-agent": { model: "gpt-5.6-luna", reasoning: "medium", network: false, nodeStyle: "luna" },
  "milestone-issues-agent": { model: "gpt-5.6-luna", reasoning: "medium", network: true, nodeStyle: "luna" },
  "release-agent": { model: "gpt-5.6-terra", reasoning: "medium", network: true, nodeStyle: "terra" },
  "roadmap-agent": { model: "gpt-5.6-sol", reasoning: "medium", network: false, nodeStyle: "sol" },
  "test-plan-agent": { model: "gpt-5.6-luna", reasoning: "medium", network: false, nodeStyle: "luna" },
  "ui-design-agent": { model: "gpt-5.6-sol", reasoning: "medium", network: false, nodeStyle: "sol" }
};

const readJson = async (relativePath: string): Promise<unknown> =>
  JSON.parse(await readFile(path.join(repositoryRoot, relativePath), "utf8")) as unknown;

const configuredAgents = (): Agent[] => Object.keys(expectedAgents).map((id) => ({
  id,
  name: id,
  description: id,
  instructions: id,
  skills: [],
  enabled: true,
  createdAt: "2026-07-15T00:00:00.000Z",
  updatedAt: "2026-07-15T00:00:00.000Z"
}));

const routeShape = (config: ProjectAutomationConfig): Record<string, unknown> =>
  Object.fromEntries(config.loops.map((loop) => [loop.id, {
    start: loop.start,
    nodes: loop.nodes.filter((node) => !isProjectTerminalNode(node)).map((step) => [
      step.id,
      step.type,
      step.type === "human" ? null : step.agentId,
      step.on
    ])
  }]));

const isLoopTarget = (target: StepTransitionTarget): target is { loop: string } =>
  typeof target === "object" && "loop" in target;

const projectAgentOn = (success: StepTransitionTarget, human: string, repair?: string) => ({
  ready: success,
  approved: success,
  "changes-requested": repair ? { repair } : { terminate: "blocked" as const },
  needs_input: { human },
  blocked: { terminal: "blocked" as const },
  failed: { terminal: "failed" as const, retry: { when: "transient" as const, limit: 1 as const } }
});

const successTransitionCount = (config: ProjectAutomationConfig, initialLoopId: string): number => {
  const loops = new Map(config.loops.map((loop) => [loop.id, loop]));
  let loop = loops.get(initialLoopId);
  let stepId = loop?.start;
  const visited = new Set<string>();
  let transitions = 0;

  while (loop && stepId) {
    const state = `${loop.id}:${stepId}`;
    if (visited.has(state)) throw new Error(`Approved transition cycle at ${state}.`);
    visited.add(state);
    const step = loop.nodes.find((candidate) => candidate.id === stepId);
    if (!step) throw new Error(`Unknown node ${state}.`);
    if (isProjectTerminalNode(step)) return transitions;
    const target = step.type === "human" ? step.on.approved : step.on.ready;
    transitions += 1;
    if (typeof target === "string") {
      stepId = target;
    } else if (isLoopTarget(target)) {
      loop = loops.get(target.loop);
      stepId = loop?.start;
    }
  }
  throw new Error(`Success path from ${initialLoopId} has no end.`);
};

describe("repository Loop engineering configuration", () => {
  it("keeps the nine GPT-5.6 runtime and agent definitions", async () => {
    const runtime = projectConfigSchema.parse(await readJson(".ballet/project.json"));
    const agentIds = Object.keys(expectedAgents).sort();
    expect(Object.keys(runtime.agents).sort()).toEqual(agentIds);

    for (const [agentId, expected] of Object.entries(expectedAgents)) {
      expect(runtime.agents[agentId]).toEqual({
        provider: "codex",
        model: expected.model,
        reasoning: expected.reasoning,
        policy: { network: expected.network }
      });
    }

    const agentDirectory = path.join(repositoryRoot, ".codex/agents");
    const agentFiles = (await readdir(agentDirectory)).filter((file) => file.endsWith(".toml")).sort();
    expect(agentFiles).toEqual(agentIds.map((id) => `${id}.toml`));

    for (const agentId of agentIds) {
      const parsed = parseTomlDocument(await readFile(path.join(agentDirectory, `${agentId}.toml`), "utf8"));
      expect(parsed.errors).toBeUndefined();
      expect(parsed.frontmatter.enabled).toBe(true);
      expect(parsed.frontmatter).not.toHaveProperty("node_style");
      expect(parsed.frontmatter.developer_instructions).toEqual(expect.stringContaining("## Tavoite"));
      expect(parsed.frontmatter.developer_instructions).toEqual(expect.stringContaining("## Pysäytyssäännöt"));
      if (agentId === "acceptance-test-agent") {
        expect(parsed.frontmatter.developer_instructions).toEqual(expect.stringContaining("Palauta `approved`, kun kaikki hyväksyntäkriteerit täyttyvät."));
      }
    }
  });

  it("keeps the four connected Loops and their outcome-aware paths", async () => {
    const project = projectConfigSchema.parse(await readJson(".ballet/project.json"));
    const config: ProjectAutomationConfig = { version: 8, loops: project.loops };
    expect(validateProjectAutomationConfig(config, configuredAgents())).toEqual([]);
    expect(config.version).toBe(8);
    expect(config.loops.map((loop) => loop.id)).toEqual([
      "blueprint-design",
      "milestone-planning",
      "milestone-delivery",
      "release-validation"
    ]);

    for (const loop of config.loops) {
      expect(loop.nodes.filter(isProjectTerminalNode).map((node) => node.id).sort()).toEqual(["blocked", "completed", "failed"]);
      expect(loop.nodes.filter((node) => node.type === "human")).toHaveLength(1);
      for (const step of loop.nodes.filter((node) => !isProjectTerminalNode(node))) {
        const expectedStyle = step.type === "human" ? "luna" : expectedAgents[step.agentId]!.nodeStyle;
        expect(step.nodeStyle).toBe(expectedStyle);
        expect(step.nodeSize).toBe(step.type === "human" ? "tiny" : expectedStyle === "sol" ? "large" : "medium");
      }
    }

    expect(routeShape(config)).toEqual({
      "blueprint-design": {
        start: "roadmap",
        nodes: [
          ["roadmap", "agent", "roadmap-agent", projectAgentOn("data-model", "blueprint-gate")],
          ["data-model", "agent", "architecture-agent", projectAgentOn("ui-design", "blueprint-gate")],
          ["ui-design", "agent", "ui-design-agent", projectAgentOn("ui-mocks", "blueprint-gate")],
          ["ui-mocks", "agent", "ui-design-agent", projectAgentOn("c4-models", "blueprint-gate")],
          ["c4-models", "agent", "architecture-agent", projectAgentOn("blueprint-gate", "blueprint-gate")],
          ["blueprint-gate", "human", null, { approved: { loop: "milestone-planning" }, rejected: "roadmap" }]
        ]
      },
      "milestone-planning": {
        start: "plan-milestone-issues",
        nodes: [
          ["plan-milestone-issues", "agent", "milestone-issues-agent", projectAgentOn("implementation-plan", "milestone-gate")],
          ["implementation-plan", "agent", "implementation-plan-agent", projectAgentOn("test-plan", "milestone-gate")],
          ["test-plan", "agent", "test-plan-agent", projectAgentOn("milestone-gate", "milestone-gate")],
          ["milestone-gate", "human", null, { approved: { loop: "milestone-delivery" }, rejected: "plan-milestone-issues" }]
        ]
      },
      "milestone-delivery": {
        start: "implement-milestone",
        nodes: [
          ["implement-milestone", "agent", "implementation-agent", projectAgentOn("run-acceptance-tests", "implementation-gate")],
          ["run-acceptance-tests", "agent", "acceptance-test-agent", projectAgentOn("implementation-gate", "implementation-gate", "implement-milestone")],
          ["implementation-gate", "human", null, { approved: { loop: "release-validation" }, rejected: "implement-milestone" }]
        ]
      },
      "release-validation": {
        start: "make-git-release",
        nodes: [
          ["make-git-release", "agent", "release-agent", projectAgentOn("deploy-release", "release-gate")],
          ["deploy-release", "agent", "release-agent", projectAgentOn("verify-release", "release-gate")],
          ["verify-release", "agent", "release-agent", projectAgentOn("release-gate", "release-gate")],
          ["release-gate", "human", null, { approved: "completed", rejected: "verify-release" }]
        ]
      }
    });
    expect({
      blueprint: successTransitionCount(config, "blueprint-design"),
      milestone: successTransitionCount(config, "milestone-planning"),
      delivery: successTransitionCount(config, "milestone-delivery"),
      release: successTransitionCount(config, "release-validation")
    }).toEqual({ blueprint: 17, milestone: 11, delivery: 7, release: 4 });
  });
});
