import { describe, expect, test } from "vitest";
import type { ActionAgentDefinition, ProjectConfigurationV26 } from "../../../shared/orchestration/environment.js";
import { canonicalJson, sha256 } from "../../../shared/orchestration/primitives.js";
import type { RuntimeActionCapabilitySnapshot, RuntimeAgentCapabilitySnapshot } from "../../../shared/orchestration/runtime.js";
import { projectConfigurationV26Schema } from "../../../shared/orchestration/schemas/environmentSchemas.js";
import { EnvironmentRunPlanner, type ProjectDefinition } from "./EnvironmentRunPlanner.js";
import { parseOrchestrationStructuredOutput } from "./StructuredOutputValidator.js";
import { buildBoundedTaskContext } from "./TaskContextBuilder.js";

describe("EnvironmentRunPlanner immutable context", () => {
  test("resolves project direction, resources, capabilities, permissions and canonical snapshot", async () => {
    const project = definition();
    const planner = new EnvironmentRunPlanner({ load: async () => project }, {
      inspectAgent: async (agent) => agentCapability(agent.id),
      inspectAction: async (actionId, profiles) => actionCapability(actionId, profiles)
    }, () => "2026-08-29T10:00:00.000Z");
    const result = await planner.plan();
    expect(result.snapshot).toMatchObject({ version: 21, projectHeadSha: "a".repeat(40) });
    expect(result.snapshot).not.toHaveProperty("userStories");
    expect(result.snapshot).not.toHaveProperty("direction");
    expect(result.snapshot.resources.map(({ kind }) => kind)).toEqual(["skill"]);
    expect(result.snapshot.permissions.find(({ role }) => role === "validation")?.toolPolicy).toBe("read_only");
    expect(result.snapshot.permissions.find(({ role }) => role === "work")?.toolPolicy).toBe("workspace_write");
    expect(result.snapshotSha256).toBe(contentHash(result.snapshot));
    const action = result.snapshot.environment.states[0]!.actions[0]!;
    const context = buildBoundedTaskContext({ snapshot: result.snapshot, state: result.snapshot.environment.states[0], action,
      composition: action.validation, outputSchemaId: "validation-precheck-v11" });
    expect(context).not.toHaveProperty("direction");
    expect(JSON.stringify(context)).not.toContain("UC-1");
  });

  test("preserves an opaque process target in both role contexts without injecting model or stories", async () => {
    const project = definition();
    const target = { processId: "00000000-0000-4000-8000-000000000003" };
    project.config.environment.states[0].actions[0].input = { eventStormingTarget: target };
    project.configSha256 = contentHash(projectConfigurationV26Schema.parse(project.config));
    const planner = new EnvironmentRunPlanner({ load: async () => project }, {
      inspectAgent: async (agent) => agentCapability(agent.id), inspectAction: async (actionId, profiles) => actionCapability(actionId, profiles)
    }, () => "2026-09-06T10:00:00.000Z");
    const { snapshot } = await planner.plan(); const state = snapshot.environment.states[0], action = state.actions[0];
    for (const role of ["validation", "work"] as const) {
      const context = buildBoundedTaskContext({ snapshot, state, action, composition: action[role], outputSchemaId: `${role}-v11` });
      expect(context).toMatchObject({ definitions: { action: { input: { eventStormingTarget: target } } } });
      expect(context).not.toHaveProperty("model"); expect(context).not.toHaveProperty("userStories");
    }
  });

  test("plans a Run without project document or story approval inputs", async () => {
    const project = definition();
    project.configSha256 = contentHash(projectConfigurationV26Schema.parse(project.config));
    const planner = new EnvironmentRunPlanner({ load: async () => project }, {
      inspectAgent: async (agent) => agentCapability(agent.id), inspectAction: async (actionId, profiles) => actionCapability(actionId, profiles)
    }, () => "2026-08-30T10:00:00.000Z");
    await expect(planner.plan()).resolves.toMatchObject({ snapshot: { version: 21 } });
  });

  test("fails before provider work on missing resource or invalid instruction sections", async () => {
    const project = definition();
    project.resources = project.resources.filter(({ kind }) => kind !== "skill");
    const planner = new EnvironmentRunPlanner({ load: async () => project }, {
      inspectAgent: async (agent) => agentCapability(agent.id),
      inspectAction: async (actionId, profiles) => actionCapability(actionId, profiles)
    }, () => new Date().toISOString());
    await expect(planner.plan()).rejects.toThrow(/Missing skill/);
  });

  test("fails closed on model capability mismatch", async () => {
    const project = definition();
    const planner = new EnvironmentRunPlanner({ load: async () => project }, {
      inspectAgent: async (agent) => ({ ...agentCapability(agent.id), supportedModels: ["different-model"] }),
      inspectAction: async (actionId, profiles) => actionCapability(actionId, profiles)
    }, () => new Date().toISOString());
    await expect(planner.plan()).rejects.toThrow(/not supported/);
  });

  test.each(["validation", "work"] as const)("fails before dispatch on %s model capability mismatch", async (role) => {
    const project = definition();
    const planner = new EnvironmentRunPlanner({ load: async () => project }, {
      inspectAgent: async (agent) => agentCapability(agent.id),
      inspectAction: async (actionId, profiles) => {
        const capability = actionCapability(actionId, profiles);
        const content = { ...capability, capabilitySha256: undefined,
          roles: { ...capability.roles, [role]: { ...capability.roles[role], supportedModels: ["different-model"] } } };
        delete content.capabilitySha256;
        return { ...content, capabilitySha256: contentHash(content) };
      }
    }, () => new Date().toISOString());
    await expect(planner.plan()).rejects.toThrow(/not supported/);
  });
});

describe("strict orchestration provider output", () => {
  test("rejects markdown wrappers, unknown fields, invalid enum and phase mismatch", () => {
    const valid = JSON.stringify({
      version: 11, role: "validation", summary: "done",
      checks: [{ name: "fixture", status: "passed", evidenceRefs: ["test:fixture"] }],
      result: { phase: "precheck", decision: "done", evidence: {} }
    });
    expect(parseOrchestrationStructuredOutput(`\`\`\`json\n${valid}\n\`\`\``, { role: "validation", phase: "precheck" }).success).toBe(false);
    expect(parseOrchestrationStructuredOutput(valid.replace('"summary":"done"', '"summary":"done","extra":true'), { role: "validation", phase: "precheck" }).success).toBe(false);
    expect(parseOrchestrationStructuredOutput(valid.replace('"decision":"done"', '"decision":"continue"'), { role: "validation", phase: "precheck" }).success).toBe(false);
    expect(parseOrchestrationStructuredOutput(valid, { role: "validation", phase: "postwork" }).success).toBe(false);
  });
});

const definition = (): ProjectDefinition => {
  const validationId = "ballet-action-validation-action-1";
  const workId = "ballet-action-work-action-1";
  const critic = { agentId: "ballet-critic-agent" as const, skillResources: ["skill-1"] };
  const refinement = { agentId: "ballet-refinement-agent" as const, skillResources: ["skill-1"] };
  const config: ProjectConfigurationV26 = {
    version: 26,
    environment: {
      id: "environment-1", name: "Environment", description: "Ordered environment", states: [{
        id: "state-1", name: "State", description: "First State", order: 1, actions: [{
          id: "action-1", name: "Action", description: "First Action", priority: 1, maxRetries: 1,
          validation: { agentId: validationId, skillResources: ["skill-1"] },
          work: { agentId: workId, skillResources: ["skill-1"] }
        }]
      }]
    },
    critic: { version: 2, enabled: false, schedules: [], agent: critic },
    refinement: { version: 2, enabled: false, agent: refinement,
      allowedRoots: [".codex/agents", ".ballet/instructions", ".agents/skills"] }
  };
  return {
    config, configSha256: contentHash(config), baseCommit: "a".repeat(40), checkoutRoot: "/tmp/worktree",
    agents: (["ballet-critic-agent", "ballet-refinement-agent"] as const).map((id) => ({ id, name: id,
      description: "Test Agent", developerInstructions: instruction(), model: "gpt-5.6-sol", reasoningEffort: "high",
      sandboxMode: "read-only" as const, contentSha256: "4".repeat(64) })),
    actionAgents: ([validationId, workId] as const).map((id) => ({ id, name: id,
      description: `Test ${id}`, developerInstructions: `${instruction()}\n\n${id}`,
      model: "gpt-5.6-sol", reasoningEffort: "high", contentSha256: "5".repeat(64) })),
    agentDocumentHashes: { "ballet-critic-agent": "4".repeat(64), "ballet-refinement-agent": "4".repeat(64),
      [validationId]: "5".repeat(64), [workId]: "5".repeat(64) },
    resources: [
      { kind: "skill", id: "skill-1", relativePath: ".agents/skills/test/SKILL.md", content: "# Test Skill\nUse evidence." }
    ]
  };
};
const agentCapability = (agentId: string): RuntimeAgentCapabilitySnapshot => {
  const value = {
    subject: { kind: "agent" as const, agentId },
    provider: "codex" as const, model: "gpt-5.6-sol", reasoningEffort: "high",
    cliVersion: "1.0.0", supportedModels: ["gpt-5.6-sol"],
    supportedReasoningEfforts: ["high"], supportsReadOnly: true, supportsWorkspaceWrite: true
  };
  return { ...value, capabilitySha256: contentHash(value) };
};
const actionCapability = (actionId: string, profiles: { validation: ActionAgentDefinition; work: ActionAgentDefinition }): RuntimeActionCapabilitySnapshot => {
  const role = (agentId: string) => ({ agentId, model: "gpt-5.6-sol", reasoningEffort: "high", supportedModels: ["gpt-5.6-sol"], supportedReasoningEfforts: ["high"] });
  const value = {
    subject: { kind: "action" as const, actionId }, provider: "codex" as const,
    cliVersion: "1.0.0",
    roles: { validation: role(profiles.validation.id), work: role(profiles.work.id) }, supportsReadOnly: true, supportsWorkspaceWrite: true
  };
  return { ...value, capabilitySha256: contentHash(value) };
};
const instruction = () => [
  "## Task\nExecute the bounded Action.", "## Role\nAct only in the assigned role.", "## Goals\nUse approved goals.",
  "## Priorities\nSafety first.", "## Method\nInspect and verify.", "## Output contract\nReturn strict JSON.",
  "## Tool policy\nRespect permissions.", "## Acceptance evidence\nReturn checks."
].join("\n\n");
const contentHash = (value: unknown) => sha256(canonicalJson(JSON.parse(JSON.stringify(value))));
