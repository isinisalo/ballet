import type Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  ActionDefinition, CreateAgentRunInput, CreateEnvironmentRunInput, FeedbackSeed,
  ProductSnapshotSeed, RootSnapshotV13, StateDefinition, TaskEnvelopeV10
} from "../../../shared/vnext/index.js";
import { canonicalJson, sha256 } from "../../../shared/vnext/primitives.js";
import { VNextConnection } from "./VNextConnection.js";

export const TEST_AT = "2026-08-29T10:00:00.000Z";
export const TEST_SHA = "a".repeat(40);
export const HASH_A = "a".repeat(64);

export interface TestDatabase {
  manager: VNextConnection;
  connection: Database.Database;
  directory: string;
  databasePath: string;
  cleanup: () => void;
}

export const openTestDatabase = (): TestDatabase => {
  const directory = mkdtempSync(path.join(tmpdir(), "ballet-vnext-"));
  const databasePath = path.join(directory, "state.sqlite");
  const manager = new VNextConnection(databasePath);
  const connection = manager.connection();
  return {
    manager, connection, directory, databasePath,
    cleanup: () => {
      manager.close();
      rmSync(directory, { recursive: true, force: true });
    }
  };
};

const agent = (toolPolicy: "read_only" | "workspace_write") => ({
  executionProfileId: "profile", instructionResource: "instruction", skillResources: [], toolPolicy
});

export const actionDefinition = (id: string, priority: number, maxRetries = 1): ActionDefinition => ({
  id, name: id, description: `${id} description`, priority, useCaseIds: ["UC-1"], maxRetries,
  validation: agent("read_only"), work: agent("workspace_write")
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
      order: number, useCaseIds: ["UC-1"], actions: [action]
    };
    return {
      stateExecutionId: `state-execution-${number}${executionSuffix}`,
      definition,
      definitionHash: hash(definition),
      actions: [{ actionExecutionId: `action-execution-${number}${executionSuffix}`, definition: action, definitionHash: hash(action) }]
    };
  });
  const snapshot: RootSnapshotV13 = {
    version: 13, projectHeadSha: TEST_SHA, projectConfigSha256: HASH_A,
    directionSha256: "b".repeat(64), environmentSha256: "c".repeat(64),
    resourceSha256: "d".repeat(64), createdAt: TEST_AT
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
    version: 10 as const, taskId: `task-${agentRunId}`, environmentRunId,
    snapshotSha256: HASH_A, instruction: "Instruction", context: {},
    stateExecutionId: "state-execution-1", actionExecutionId, actionId: "action-1"
  };
  let envelope: TaskEnvelopeV10;
  if (phase === "precheck") {
    envelope = { ...base, role: "validation", phase, workAttempts: attempt - 1, maxRetries };
  } else if (phase === "work") {
    envelope = { ...base, role: "work", phase, workAttempt: attempt, dynamicPrompt };
  } else {
    envelope = {
      ...base, role: "validation", phase, workAttempt: attempt,
      retriesRemaining: Math.max(0, maxRetries - Math.max(0, attempt - 1)),
      workOutcome: { version: 10, role: "work", state: "completed", summary: "Work complete", checks: [], artifacts: {} }
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
  feedbackEntryId, source, category: "quality", targetType: "action", targetId: "action-1",
  title: "Action blocked", description: "Validation blocked the Action", correctiveActions: ["Correct the failure"],
  environmentRunId: "run-1", stateExecutionId: "state-execution-1",
  actionExecutionId: "action-execution-1", agentRunId: "postwork-1",
  provenance: { source: "validation" }, createdAt: TEST_AT, ...overrides
});

export const productSnapshotSeed = (environmentRunId = "run-1"): ProductSnapshotSeed => ({
  productSnapshotId: `snapshot-${environmentRunId}`, environmentRunId,
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
) => ({ version: 10 as const, role: "validation" as const, summary: "Validation complete", checks: [], result });

export const workOutcome = () => ({
  version: 10 as const, role: "work" as const, state: "completed" as const,
  summary: "Work complete", checks: [], artifacts: {}
});

export const hash = (value: unknown): string => sha256(canonicalJson(JSON.parse(JSON.stringify(value))));

type EmptyEvidence = Record<string, never>;
