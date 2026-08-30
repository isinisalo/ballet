import type Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  ActionDefinition, CreateAgentRunInput, CreateEnvironmentRunInput, FeedbackSeed,
  RunEvidenceSeed, RootSnapshotV20, StateDefinition, TaskEnvelopeV11
} from "../../../shared/orchestration/index.js";
import { canonicalJson, sha256 } from "../../../shared/orchestration/primitives.js";
import { LocalDatabase } from "./LocalDatabase.js";

export const TEST_AT = "2026-08-29T10:00:00.000Z";
export const TEST_SHA = "a".repeat(40);
export const HASH_A = "a".repeat(64);
export const VALID_INSTRUCTION = [
  "## Task\nExecute the bounded Action.", "## Role\nFollow the assigned role.",
  "## Goals\nSatisfy approved goals.", "## Priorities\nPreserve quality and safety.",
  "## Method\nUse supplied evidence.", "## Output contract\nReturn strict JSON.",
  "## Tool policy\nRespect the supplied policy.", "## Acceptance evidence\nReport checks and evidence."
].join("\n\n");

export interface TestDatabase {
  manager: LocalDatabase;
  connection: Database.Database;
  directory: string;
  databasePath: string;
  cleanup: () => void;
}

export const openTestDatabase = (): TestDatabase => {
  const directory = mkdtempSync(path.join(tmpdir(), "ballet-orchestration-"));
  const databasePath = path.join(directory, "state.sqlite");
  const manager = new LocalDatabase(databasePath);
  const connection = manager.connection();
  return {
    manager, connection, directory, databasePath,
    cleanup: () => {
      manager.close();
      rmSync(directory, { recursive: true, force: true });
    }
  };
};

const agent = (agentId: "ballet-critic-agent" | "ballet-refinement-agent") => ({ agentId, skillResources: [] });
const actionRole = (id: string, role: "validation" | "work") => ({ agentId: `ballet-action-${role}-${id}`, skillResources: [] });

export const actionDefinition = (id: string, priority: number, maxRetries = 1): ActionDefinition => ({
  id, name: id, description: `${id} description`, priority, maxRetries,
  validation: actionRole(id, "validation"), work: actionRole(id, "work")
});

export const environmentSeed = (options: {
  environmentRunId?: string;
  source?: "manual" | "continuation";
  previousRunId?: string;
  baseCommit?: string;
  maxRetries?: number;
  stateCount?: number;
} = {}): CreateEnvironmentRunInput => {
  const stateCount = options.stateCount ?? 2;
  const runId = options.environmentRunId ?? "run-1";
  const executionSuffix = runId === "run-1" ? "" : `-${runId}`;
  const states = Array.from({ length: stateCount }, (_, index) => {
    const number = index + 1;
    const action = actionDefinition(`action-${number}`, number, options.maxRetries ?? 1);
    const definition: StateDefinition = {
      id: `state-${number}`, name: `State ${number}`, description: `State ${number} description`,
      order: number, actions: [action]
    };
    return {
      stateExecutionId: `state-execution-${number}${executionSuffix}`,
      definition,
      definitionHash: hash(definition),
      actions: [{ actionExecutionId: `action-execution-${number}${executionSuffix}`, definition: action, definitionHash: hash(action) }]
    };
  });
  const actionAgents = states.flatMap(({ definition }) => definition.actions.flatMap((action) => (["validation", "work"] as const).map((role) => ({
    id: action[role].agentId, name: action[role].agentId,
    description: `${role} test Agent`, developerInstructions: `${VALID_INSTRUCTION}\n\nAction Agent ${action.id} ${role}.`,
    model: "gpt-5.6-sol", reasoningEffort: "high", contentSha256: HASH_A
  }))));
  const snapshot: RootSnapshotV20 = {
    version: 20, projectHeadSha: options.baseCommit ?? TEST_SHA, projectConfigSha256: HASH_A,
    directionSha256: "b".repeat(64), environmentSha256: "c".repeat(64),
    resourceSha256: "d".repeat(64),
    environment: { id: "environment-1", name: "Environment", description: "Test Environment", states: states.map(({ definition }) => definition) },
    direction: { goals: [], adrs: [], constraints: [] },
    agents: (["ballet-critic-agent", "ballet-refinement-agent"] as const).map((id) => ({
      id, name: id, description: "Test Agent", developerInstructions: VALID_INSTRUCTION,
      model: "gpt-5.6-sol", reasoningEffort: "high", sandboxMode: "read-only" as const, contentSha256: HASH_A
    })),
    actionAgents,
    runtimeCapabilities: [...(["ballet-critic-agent", "ballet-refinement-agent"] as const).map((agentId) => ({
      subject: { kind: "agent" as const, agentId }, provider: "codex" as const,
      model: "gpt-5.6-sol", reasoningEffort: "high",
      cliVersion: "1.0.0", supportedModels: ["gpt-5.6-sol"],
      supportedReasoningEfforts: ["high"], supportsReadOnly: true, supportsWorkspaceWrite: true, capabilitySha256: HASH_A
    })), ...states.flatMap(({ definition }) => definition.actions.map((action) => ({
      subject: { kind: "action" as const, actionId: action.id }, provider: "codex" as const,
      cliVersion: "1.0.0",
      roles: {
        validation: { agentId: action.validation.agentId, model: "gpt-5.6-sol", reasoningEffort: "high", supportedModels: ["gpt-5.6-sol"], supportedReasoningEfforts: ["high"] },
        work: { agentId: action.work.agentId, model: "gpt-5.6-sol", reasoningEffort: "high", supportedModels: ["gpt-5.6-sol"], supportedReasoningEfforts: ["high"] }
      },
      supportsReadOnly: true, supportsWorkspaceWrite: true, capabilitySha256: HASH_A
    })))],
    resources: [],
    permissions: [
      { role: "validation", actionId: "action-1", toolPolicy: "read_only", approvalPolicy: "never" },
      { role: "work", actionId: "action-1", toolPolicy: "workspace_write", approvalPolicy: "never" }
    ], governance: { critic: agent("ballet-critic-agent"), refinement: agent("ballet-refinement-agent") }, createdAt: TEST_AT
  };
  return {
    environmentRunId: runId,
    environmentDefinitionId: "environment-1",
    source: options.source ?? "manual",
    previousRunId: options.previousRunId,
    baseCommit: options.baseCommit ?? TEST_SHA,
    worktreePath: "/tmp/worktree",
    branch: "codex/test",
    executionSnapshot: snapshot,
    executionSnapshotHash: hash(snapshot),
    transitionLimit: 256,
    states,
    createdAt: TEST_AT
  };
};

export const agentRunInput = (
  agentRunId: string,
  phase: "precheck" | "work" | "postwork",
  attempt: number,
  actionExecutionId = "action-execution-1",
  environmentRunId = "run-1",
  dynamicPrompt = "Perform the work",
  maxRetries = 1
): CreateAgentRunInput => {
  const base = {
    version: 11 as const, taskId: `task-${agentRunId}`, environmentRunId,
    snapshotSha256: HASH_A, instruction: "Instruction", context: {},
    stateExecutionId: "state-execution-1", actionExecutionId, actionId: "action-1"
  };
  let envelope: TaskEnvelopeV11;
  if (phase === "precheck") {
    envelope = { ...base, role: "validation", phase, workAttempts: attempt - 1, maxRetries };
  } else if (phase === "work") {
    envelope = { ...base, role: "work", phase, workAttempt: attempt, dynamicPrompt };
  } else {
    envelope = {
      ...base, role: "validation", phase, workAttempt: attempt,
      retriesRemaining: Math.max(0, maxRetries - Math.max(0, attempt - 1)),
      workOutcome: { version: 11, role: "work", state: "completed", summary: "Work complete", checks: [testCheck], artifacts: {} }
    };
  }
  return {
    agentRunId, environmentRunId, actionExecutionId,
    role: phase === "work" ? "work" : "validation", phase, attempt,
    taskEnvelope: envelope, taskEnvelopeHash: hash(envelope), createdAt: TEST_AT
  };
};

export const feedbackSeed = (
  feedbackEntryId: string,
  source: FeedbackSeed["source"],
  overrides: Partial<FeedbackSeed> = {}
): FeedbackSeed => ({
  feedbackEntryId, source, category: "system", targetType: "action_execution", targetId: "action-execution-1",
  comment: "Validation blocked the Action. Correct the failure.",
  environmentRunId: "run-1", stateExecutionId: "state-execution-1",
  actionExecutionId: "action-execution-1", agentRunId: "postwork-1",
  provenance: { source: "validation" }, createdAt: TEST_AT, ...overrides
});

export const runEvidenceSeed = (environmentRunId = "run-1"): RunEvidenceSeed => ({
  runEvidenceId: `snapshot-${environmentRunId}`, environmentRunId,
  branch: "codex/test", worktreePath: "/tmp/worktree", baseCommit: TEST_SHA,
  resultCommit: "b".repeat(40), changedFiles: ["shared/file.ts"], artifactRefs: ["artifact-1"],
  resourceHashes: { instruction: HASH_A }, definitionHashes: { environment: "c".repeat(64) },
  validationSummary: { status: "passed" }, createdAt: TEST_AT
});

export const validationOutcome = (
  result: { phase: "precheck"; decision: "done"; evidence: EmptyEvidence }
    | { phase: "precheck"; decision: "delegate"; workPrompt: string; evidence: EmptyEvidence }
    | { phase: "precheck"; decision: "blocked"; reason: string; correctiveActions: string[]; evidence: EmptyEvidence }
    | { phase: "postwork"; decision: "done"; evidence: EmptyEvidence }
    | { phase: "postwork"; decision: "retry"; workPrompt: string; feedback: string; expectedCorrection: string; evidence: EmptyEvidence }
    | { phase: "postwork"; decision: "blocked"; reason: string; correctiveActions: string[]; evidence: EmptyEvidence }
) => ({ version: 11 as const, role: "validation" as const, summary: "Validation complete", checks: [testCheck], result });

export const workOutcome = () => ({
  version: 11 as const, role: "work" as const, state: "completed" as const,
  summary: "Work complete", checks: [testCheck], artifacts: {}
});

export const hash = (value: unknown): string => sha256(canonicalJson(JSON.parse(JSON.stringify(value))));

type EmptyEvidence = Record<string, never>;
const testCheck = { name: "fixture", status: "passed" as const, evidenceRefs: ["test:fixture"] };
