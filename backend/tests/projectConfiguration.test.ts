import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";
import { projectRuntimeConfigSchema } from "../../shared/api/runtime-schemas.js";
import type { Agent, AgentNodeStyle } from "../../shared/domain/agents.js";
import type { ProjectAutomationConfig, StepTransitionTarget } from "../../shared/domain/automation.js";
import { validateProjectAutomationConfig } from "../automation.js";
import { parseTomlDocument } from "../markdown.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface ExpectedAgentConfig {
  model: string;
  reasoning: "medium";
  network: boolean;
  nodeStyle: AgentNodeStyle;
}

const expectedAgents: Record<string, ExpectedAgentConfig> = {
  "dev-deploy-agent": { model: "gpt-5.6-terra", reasoning: "medium", network: true, nodeStyle: "terra" },
  "implementation-agent": { model: "gpt-5.6-terra", reasoning: "medium", network: false, nodeStyle: "terra" },
  "milestone-task-agent": { model: "gpt-5.6-luna", reasoning: "medium", network: false, nodeStyle: "luna" },
  "review-test-agent": { model: "gpt-5.6-terra", reasoning: "medium", network: true, nodeStyle: "terra" },
  "roadmap-agent": { model: "gpt-5.6-sol", reasoning: "medium", network: false, nodeStyle: "sol" },
  "ui-design-agent": { model: "gpt-5.6-sol", reasoning: "medium", network: false, nodeStyle: "sol" }
};

const readJson = async (relativePath: string): Promise<unknown> =>
  JSON.parse(await readFile(path.join(repositoryRoot, relativePath), "utf8")) as unknown;

const configuredAgents = (): Agent[] => Object.entries(expectedAgents).map(([id, config]) => ({
  id,
  name: id,
  description: id,
  instructions: id,
  skills: [],
  enabled: true,
  nodeStyle: config.nodeStyle,
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z"
}));

const routeShape = (config: ProjectAutomationConfig): Record<string, unknown> =>
  Object.fromEntries(config.loops.map((loop) => [loop.id, {
    start: loop.start,
    steps: loop.steps.map((step) => [
      step.id,
      step.type,
      step.type === "agent" ? step.agentId : null,
      step.on
    ])
  }]));

const isLoopTarget = (target: StepTransitionTarget): target is { loop: string } =>
  typeof target === "object" && "loop" in target;

const approvedTransitionCount = (config: ProjectAutomationConfig, initialLoopId: string): number => {
  const loops = new Map(config.loops.map((loop) => [loop.id, loop]));
  let loop = loops.get(initialLoopId);
  let stepId = loop?.start;
  const visited = new Set<string>();
  let transitions = 0;

  while (loop && stepId) {
    const state = `${loop.id}:${stepId}`;
    if (visited.has(state)) throw new Error(`Approved transition cycle at ${state}.`);
    visited.add(state);
    const step = loop.steps.find((candidate) => candidate.id === stepId);
    if (!step) throw new Error(`Unknown step ${state}.`);
    if (step.type === "scheduled") {
      stepId = step.on.triggered;
      continue;
    }
    const target = step.on.approved;
    transitions += 1;
    if (typeof target === "string") {
      stepId = target;
    } else if (isLoopTarget(target)) {
      loop = loops.get(target.loop);
      stepId = loop?.start;
    } else {
      return transitions;
    }
  }
  throw new Error(`Approved path from ${initialLoopId} has no end.`);
};

describe("repository Loop engineering configuration", () => {
  it("keeps exactly the six GPT-5.6 runtime and agent definitions", async () => {
    const runtime = projectRuntimeConfigSchema.parse(await readJson(".ballet/runtime.json"));
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
      expect(parsed.frontmatter.node_style).toBe(expectedAgents[agentId]!.nodeStyle);
      expect(parsed.frontmatter.developer_instructions).toEqual(expect.stringContaining("## Tavoite"));
      expect(parsed.frontmatter.developer_instructions).toEqual(expect.stringContaining("## Pysäytyssäännöt"));
    }
  });

  it("keeps the four simple Loops and their 3/1/4 approved paths", async () => {
    const config = automationConfigSchema.parse(await readJson(".ballet/project.json"));
    expect(validateProjectAutomationConfig(config, configuredAgents())).toEqual([]);
    expect(routeShape(config)).toEqual({
      "delivery-planning": {
        start: "create-roadmap",
        steps: [
          ["create-roadmap", "agent", "roadmap-agent", { approved: "create-work-breakdown", rejected: { end: "blocked" } }],
          ["create-work-breakdown", "agent", "milestone-task-agent", { approved: "planning-gate", rejected: { end: "blocked" } }],
          ["planning-gate", "human", null, { approved: { end: "completed" }, rejected: "create-roadmap" }]
        ]
      },
      "ui-design": {
        start: "design-task-ui",
        steps: [["design-task-ui", "agent", "ui-design-agent", { approved: { end: "completed" }, rejected: { end: "blocked" } }]]
      },
      implementation: {
        start: "implement-task",
        steps: [
          ["implement-task", "agent", "implementation-agent", { approved: "verify-task", rejected: { end: "blocked" } }],
          ["verify-task", "agent", "review-test-agent", { approved: "code-gate", rejected: "implement-task" }],
          ["code-gate", "human", null, { approved: { loop: "dev-deployment" }, rejected: "implement-task" }]
        ]
      },
      "dev-deployment": {
        start: "deploy-and-validate-dev",
        steps: [["deploy-and-validate-dev", "agent", "dev-deploy-agent", { approved: { end: "completed" }, rejected: { end: "failed" } }]]
      }
    });
    expect({
      deliveryPlanning: approvedTransitionCount(config, "delivery-planning"),
      uiDesign: approvedTransitionCount(config, "ui-design"),
      implementationToDev: approvedTransitionCount(config, "implementation")
    }).toEqual({ deliveryPlanning: 3, uiDesign: 1, implementationToDev: 4 });
  });
});
