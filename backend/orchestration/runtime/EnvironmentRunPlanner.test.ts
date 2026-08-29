import { describe, expect, test } from "vitest";
import { approveUseCase, type UseCase } from "../../../shared/orchestration/direction.js";
import type { ProjectConfigurationV20 } from "../../../shared/orchestration/environment.js";
import { canonicalJson, sha256 } from "../../../shared/orchestration/primitives.js";
import type { RuntimeCapabilitySnapshot } from "../../../shared/orchestration/runtime.js";
import { EnvironmentRunPlanner, type ProjectDefinition } from "./EnvironmentRunPlanner.js";
import { parseOrchestrationStructuredOutput } from "./StructuredOutputValidator.js";

describe("EnvironmentRunPlanner immutable closure", () => {
  test("resolves approved direction, resources, capabilities, permissions and canonical snapshot", async () => {
    const project = definition();
    const planner = new EnvironmentRunPlanner({ load: async () => project }, {
      inspect: async () => capability()
    }, () => "2026-08-29T10:00:00.000Z");
    const result = await planner.plan();
    expect(result.snapshot).toMatchObject({ version: 13, projectHeadSha: "a".repeat(40) });
    expect(result.snapshot.approvedUseCases).toHaveLength(1);
    expect(result.snapshot.resources.map(({ kind }) => kind)).toEqual(["instruction", "skill"]);
    expect(result.snapshot.permissions.find(({ role }) => role === "validation")?.toolPolicy).toBe("read_only");
    expect(result.snapshot.permissions.find(({ role }) => role === "work")?.toolPolicy).toBe("workspace_write");
    expect(result.snapshotSha256).toBe(contentHash(result.snapshot));
  });

  test("fails before provider work on missing resource or invalid instruction sections", async () => {
    const project = definition();
    project.resources = project.resources.filter(({ kind }) => kind !== "skill");
    const planner = new EnvironmentRunPlanner({ load: async () => project }, { inspect: async () => capability() }, () => new Date().toISOString());
    await expect(planner.plan()).rejects.toThrow(/Missing skill/);
  });

  test("fails closed on Copilot capability mismatch", async () => {
    const project = definition();
    project.config.executionProfiles[0] = { ...project.config.executionProfiles[0]!, provider: "copilot" };
    project.configSha256 = contentHash(project.config);
    const planner = new EnvironmentRunPlanner({ load: async () => project }, {
      inspect: async () => ({ ...capability(), provider: "copilot", supportedModels: ["different-model"] })
    }, () => new Date().toISOString());
    await expect(planner.plan()).rejects.toThrow(/not supported/);
  });
});

describe("strict orchestration provider output", () => {
  test("rejects markdown wrappers, unknown fields, invalid enum and phase mismatch", () => {
    const valid = JSON.stringify({
      version: 10, role: "validation", summary: "done",
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
  const draft: UseCase = {
    id: "UC-1", name: "Execute Action", status: "draft",
    examples: [{ given: "approved closure", when: "Environment runs", then: "Action is validated" }],
    successGoals: ["Action done"], failureGoals: ["Action blocked visibly"], expectedOutcomes: ["evidence"],
    goalIds: ["goal-1"], adrIds: ["adr-1"], constraintIds: ["constraint-1"]
  };
  const useCase = approveUseCase(draft, { approvedBy: "human-1", approvedAt: "2026-08-29T09:00:00.000Z", revision: 1 });
  const agent = (toolPolicy: "read_only" | "workspace_write") => ({
    executionProfileId: "profile-1", instructionResource: "action-instruction", skillResources: ["skill-1"], toolPolicy
  });
  const config: ProjectConfigurationV20 = {
    version: 20,
    direction: {
      goals: [{ id: "goal-1", name: "Goal", status: "accepted" }],
      adrs: [{ id: "adr-1", name: "ADR", status: "accepted" }],
      constraints: [{ id: "constraint-1", name: "Constraint", status: "accepted", kind: "required", description: "Safe", rationale: "Required" }],
      useCases: [useCase]
    },
    executionProfiles: [{
      id: "profile-1", name: "Profile", provider: "codex", model: "gpt-test", reasoningEffort: "high", networkAccess: false
    }],
    environment: {
      id: "environment-1", name: "Environment", description: "Ordered environment", states: [{
        id: "state-1", name: "State", description: "First State", order: 1, useCaseIds: ["UC-1"], actions: [{
          id: "action-1", name: "Action", description: "First Action", priority: 1, useCaseIds: ["UC-1"], maxRetries: 1,
          validation: agent("read_only"), work: agent("workspace_write")
        }]
      }]
    },
    critic: { version: 1, enabled: false, schedules: [], agent: agent("read_only") },
    refinement: { version: 1, enabled: false, agent: agent("read_only"), allowedRoots: [".ballet/instructions", ".agents/skills"] }
  };
  return {
    config, configSha256: contentHash(config), baseCommit: "a".repeat(40), checkoutRoot: "/tmp/worktree",
    directionDocumentHashes: {
      goals: { "goal-1": "1".repeat(64) }, adrs: { "adr-1": "2".repeat(64) },
      constraints: { "constraint-1": "3".repeat(64) }
    },
    resources: [
      { kind: "instruction", id: "action-instruction", relativePath: ".ballet/instructions/action.md", content: instruction() },
      { kind: "skill", id: "skill-1", relativePath: ".agents/skills/test/SKILL.md", content: "# Test Skill\nUse evidence." }
    ]
  };
};
const capability = (): RuntimeCapabilitySnapshot => {
  const value = {
    executionProfileId: "profile-1", provider: "codex" as const, cliVersion: "1.0.0", supportedModels: ["gpt-test"],
    supportedReasoningEfforts: ["high"], supportsReadOnly: true, supportsWorkspaceWrite: true
  };
  return { ...value, capabilitySha256: contentHash(value) };
};
const instruction = () => [
  "## Task\nExecute the bounded Action.", "## Role\nAct only in the assigned role.", "## Goals\nUse approved goals.",
  "## Priorities\nSafety first.", "## Method\nInspect and verify.", "## Output contract\nReturn strict JSON.",
  "## Tool policy\nRespect permissions.", "## Acceptance evidence\nReturn checks."
].join("\n\n");
const contentHash = (value: unknown) => sha256(canonicalJson(JSON.parse(JSON.stringify(value))));
