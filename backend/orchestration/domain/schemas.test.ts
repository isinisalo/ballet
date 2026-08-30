import { describe, expect, it } from "vitest";
import {
  EXECUTION_SPEC_VERSION, PROJECT_CONFIG_VERSION, ROLE_OUTCOME_VERSION,
  TASK_ENVELOPE_VERSION, actionAgentDefinitionSchema, agentRunSchema, approveUseCase, projectConfigurationV25Schema,
  refinementOutcomeSchema, roleOutcomeV11Schema, sha256, taskEnvelopeV11Schema,
  validationDecisionSchema, workOutcomeSchema
} from "../../../shared/orchestration/index.js";
import { ROOT_SNAPSHOT_VERSION } from "../../../shared/orchestration/versions.js";
import { DATABASE_SCHEMA_VERSION } from "../persistence/RuntimeSchema.js";

const checks = [{ name: "test", status: "passed", evidenceRefs: ["evidence-1"] }];
const outcomeBase = { version: ROLE_OUTCOME_VERSION, summary: "Summary", checks };

describe("strict orchestration outcome schemas", () => {
  it.each([
    { phase: "precheck", decision: "done", evidence: {} },
    { phase: "precheck", decision: "delegate", workPrompt: "Do the work", evidence: {} },
    { phase: "precheck", decision: "blocked", reason: "Cannot proceed", correctiveActions: ["Fix it"], evidence: {} },
    { phase: "postwork", decision: "done", evidence: {} },
    { phase: "postwork", decision: "retry", workPrompt: "Retry work", feedback: "Fix", expectedCorrection: "Pass", evidence: {} },
    { phase: "postwork", decision: "blocked", reason: "Cannot proceed", correctiveActions: ["Fix it"], evidence: {} }
  ])("accepts $phase/$decision", (decision) => {
    expect(validationDecisionSchema.safeParse(decision).success).toBe(true);
  });

  it.each([
    { phase: "precheck", decision: "retry", feedback: "No", expectedCorrection: "No", evidence: {} },
    { phase: "precheck", decision: "delegate", evidence: {} },
    { phase: "postwork", decision: "delegate", workPrompt: "No", evidence: {} },
    { phase: "precheck", decision: "done", workPrompt: "Forbidden", evidence: {} },
    { phase: "postwork", decision: "retry", feedback: "Missing prompt", expectedCorrection: "Correction", evidence: {} },
    { phase: "precheck", decision: "blocked", reason: "Missing actions", evidence: {} },
    { phase: "postwork", decision: "blocked", reason: "Missing actions", correctiveActions: [], evidence: {} },
    { phase: "postwork", decision: "done" }
  ])("rejects invalid combinations", (decision) => {
    expect(validationDecisionSchema.safeParse(decision).success).toBe(false);
  });

  it("keeps done out of Work outcomes and requires needs-input context", () => {
    expect(workOutcomeSchema.safeParse({ ...outcomeBase, role: "work", state: "done", artifacts: {} }).success).toBe(false);
    expect(workOutcomeSchema.safeParse({ ...outcomeBase, role: "work", state: "needs_input", artifacts: {}, question: "What?" }).success).toBe(false);
    expect(workOutcomeSchema.safeParse({ ...outcomeBase, role: "work", state: "completed", artifacts: {} }).success).toBe(true);
  });

  it("keeps a Critic result as a proposal rather than Feedback", () => {
    const result = roleOutcomeV11Schema.safeParse({
      ...outcomeBase, role: "critic",
      proposal: {
        proposalId: "proposal", title: "Finding", finding: "Quality gap", rationale: "Evidence", evidenceRefs: [],
        category: "code", targetType: "action_definition", targetId: "action", severity: "medium", priority: 2,
        recommendedCorrectiveActions: ["Improve this"], confidence: 0.9
      }
    });
    expect(result.success).toBe(true);
    expect("feedback" in (result.success ? result.data : {})).toBe(false);
  });

  it("binds Refinement content to its exact SHA-256", () => {
    const proposedContent = "# Task\nNew content";
    const valid = {
      ...outcomeBase, role: "refinement", proposalId: "proposal", rationale: "Improve instruction",
      feedbackIds: ["feedback"], targetActionId: "action", impactedActionIds: ["action"],
      mappingExplanation: "Feedback maps to the Action instruction",
      files: [{
        operation: "replace",
        relativePath: ".ballet/instructions/work.md", preimageSha256: "a".repeat(64),
        proposedContentSha256: sha256(proposedContent), proposedContent, rationale: "Clarify work"
      }],
      sharedSkillImpact: [], expectedBehavioralImprovement: "Validation passes", risks: ["Prompt drift"],
      validationPlan: ["instruction_contract"], rollback: "Discard local branch",
      continuationInvalidationScope: ["action"]
    };
    expect(refinementOutcomeSchema.safeParse(valid).success).toBe(true);
    expect(refinementOutcomeSchema.safeParse({ ...valid, files: [{ ...valid.files[0], proposedContentSha256: "b".repeat(64) }] }).success).toBe(false);
    expect(refinementOutcomeSchema.safeParse({ ...valid, files: [{ ...valid.files[0], relativePath: "/tmp/work.md" }] }).success).toBe(false);
  });
});

describe("task and runtime boundary schemas", () => {
  const base = {
    version: TASK_ENVELOPE_VERSION,
    taskId: "task", environmentRunId: "run", snapshotSha256: "a".repeat(64),
    instruction: "Instruction", context: {}
  };

  it.each([
    { ...base, role: "validation", phase: "precheck", stateExecutionId: "state", actionExecutionId: "action", actionId: "definition", workAttempts: 0, maxRetries: 1 },
    { ...base, role: "work", phase: "work", stateExecutionId: "state", actionExecutionId: "action", actionId: "definition", workAttempt: 1, dynamicPrompt: "Work" },
    {
      ...base, role: "validation", phase: "postwork", stateExecutionId: "state", actionExecutionId: "action", actionId: "definition",
      workAttempt: 1, retriesRemaining: 1, workOutcome: { ...outcomeBase, role: "work", state: "completed", artifacts: {} }
    },
    { ...base, role: "critic", phase: "proposal", criticRunId: "critic", scheduleId: "schedule", runEvidenceIds: [] },
    { ...base, role: "refinement", phase: "proposal", refinementRunId: "refinement", approvedCriticProposalIds: [], allowedPaths: [], preimageHashes: {} }
  ])("accepts each task phase", (envelope) => {
    expect(taskEnvelopeV11Schema.safeParse(envelope).success).toBe(true);
  });

  it("rejects a role/phase mismatch", () => {
    expect(agentRunSchema.safeParse({
      id: "agent", environmentRunId: "run", role: "work", phase: "precheck", status: "queued", attempt: 1,
      createdAt: "2026-08-29T10:00:00.000Z", updatedAt: "2026-08-29T10:00:00.000Z"
    }).success).toBe(false);
  });

  it("keeps the precheck work-attempt snapshot unchanged", () => {
    const envelope = {
      ...base, role: "validation", phase: "precheck", stateExecutionId: "state",
      actionExecutionId: "action", actionId: "definition", workAttempts: 0, maxRetries: 0
    };
    const parsed = taskEnvelopeV11Schema.parse(envelope);
    expect("workAttempts" in parsed && parsed.workAttempts).toBe(0);
  });
});

describe("Project Configuration v25 boundary", () => {
  it("publishes the canonical strict versions", () => {
    expect(PROJECT_CONFIG_VERSION).toBe(25);
    expect(TASK_ENVELOPE_VERSION).toBe(11);
    expect(ROLE_OUTCOME_VERSION).toBe(11);
    expect(EXECUTION_SPEC_VERSION).toBe(18);
    expect(ROOT_SNAPSHOT_VERSION).toBe(20);
    expect(DATABASE_SCHEMA_VERSION).toBe(23);
  });

  it("accepts only the strict Action Agent definition", () => {
    const agent = { id: "ballet-action-validation-action", name: "ballet-action-validation-action",
      description: "Validate Action", developerInstructions: "Inspect exact evidence", model: "gpt-5.6-sol", reasoningEffort: "high" };
    expect(actionAgentDefinitionSchema.safeParse(agent).success).toBe(true);
    expect(actionAgentDefinitionSchema.safeParse({ ...agent, sandboxMode: "read-only" }).success).toBe(false);
    expect(actionAgentDefinitionSchema.safeParse({ ...agent, name: "different" }).success).toBe(false);
  });

  it("accepts a runnable bounded Environment and rejects unknown fields", () => {
    const useCase = approveUseCase({
      id: "UC-1", name: "Use Case", status: "draft",
      examples: [{ given: "Direction", when: "Action runs", then: "Outcome exists" }],
      successGoals: ["Success"], failureGoals: ["Failure"], expectedOutcomes: ["Evidence"],
      goalIds: ["goal"], adrIds: ["adr"], constraintIds: ["constraint"]
    }, { approvedBy: "human", approvedAt: "2026-08-29T10:00:00.000Z", revision: 1 });
    const validation = { agentId: "ballet-action-validation-action", skillResources: [] };
    const work = { agentId: "ballet-action-work-action", skillResources: [] };
    const criticAgent = { agentId: "ballet-critic-agent", skillResources: [] };
    const refinementAgent = { agentId: "ballet-refinement-agent", skillResources: [] };
    const config = {
      version: 25,
      direction: {
        goals: [{ id: "goal", name: "Goal", status: "accepted" }],
        adrs: [{ id: "adr", name: "ADR", status: "accepted" }],
        constraints: [{
          id: "constraint", name: "Constraint", status: "accepted", kind: "required",
          description: "Required", rationale: "Reason"
        }],
        useCases: [useCase]
      },
      environment: {
        id: "environment", name: "Environment", description: "Description",
        states: [{
          id: "state", name: "State", description: "Description", order: 1,
          actions: [{ id: "action", name: "Action", description: "Description", priority: 1, maxRetries: 1, validation, work }]
        }]
      },
      critic: { version: 2, enabled: true, schedules: [{ id: "daily-1", kind: "daily", timeZone: "Europe/Helsinki", localTimes: ["09:00"] }], agent: criticAgent },
      refinement: { version: 2, enabled: true, agent: refinementAgent,
        allowedRoots: [".codex/agents", ".ballet/instructions", ".agents/skills"] }
    };
    expect(projectConfigurationV25Schema.safeParse(config).success).toBe(true);
    expect(projectConfigurationV25Schema.safeParse({ ...config, version: 24 }).success).toBe(false);
    expect(projectConfigurationV25Schema.safeParse({ ...config, environment: { ...config.environment,
      states: [{ ...config.environment.states[0], useCaseIds: ["UC-1"] }] } }).success).toBe(false);
    expect(projectConfigurationV25Schema.safeParse({ ...config, graph: {} }).success).toBe(false);
    const duplicateAction = structuredClone(config);
    duplicateAction.environment.states.push({ ...duplicateAction.environment.states[0]!, id: "state-2", order: 2 });
    expect(projectConfigurationV25Schema.safeParse(duplicateAction).success).toBe(false);
    expect(projectConfigurationV25Schema.safeParse({
      ...config,
      critic: { ...config.critic, schedules: [{ ...config.critic.schedules[0], timeZone: "Mars/Olympus" }] }
    }).success).toBe(false);
  });
});

describe("pure SHA-256", () => {
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"]
  ])("hashes the standard vector", (input, expected) => expect(sha256(input)).toBe(expected));
});
