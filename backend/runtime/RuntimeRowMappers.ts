import type { ProjectLoop } from "../../shared/domain/automation.js";
import { migrateAutomationConfig } from "../../shared/domain/automationMigration.js";
import type { LoopTheme } from "../../shared/domain/loopThemes.js";
import { agentOutcomeStatuses } from "../../shared/domain/outcomes.js";
import { agentOutcomeSchema } from "../../shared/api/runtime-schemas.js";
import { loopThemeSchema } from "../../shared/api/workspace-schemas.js";
import type {
  AgentOutcome,
  ExecutionRuntimeSnapshot,
  LoopExecutionPlan,
  LoopRun,
  LoopRunTermination,
  StepRun,
  StepRunResult,
  StepRunTransition
} from "../../shared/domain/runtime.js";
import {
  migrateLegacyStoredTransition,
  normalizeStoredTerminationCode
} from "./LegacyRuntimeTransitionAdapter.js";
import type { LoopRunRow, StepRunRow } from "./RuntimeDbTypes.js";

interface StoredLoopRunSnapshot {
  automationVersion?: number;
  loop: ProjectLoop;
  theme: LoopTheme;
}

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const toLoopRun = (row: LoopRunRow): LoopRun => {
  const storedSnapshot = JSON.parse(row.snapshot_json) as unknown;
  if (!isRecord(storedSnapshot)
    || (storedSnapshot.automationVersion !== undefined && storedSnapshot.automationVersion !== 8)) {
    throw new Error(`Stored snapshot for Loop Run ${row.run_id} has an unsupported envelope.`);
  }
  const snapshot = storedSnapshot as unknown as StoredLoopRunSnapshot;
  const migrated = migrateAutomationConfig({
    version: snapshot.automationVersion ?? 8,
    loops: [snapshot.loop]
  });
  const theme = loopThemeSchema.safeParse(snapshot.theme);
  const loops = isRecord(migrated) && Array.isArray(migrated.loops) ? migrated.loops : [];
  const loop = loops[0];
  if (!isStoredLoop(loop) || !theme.success) {
    throw new Error(`Stored snapshot for Loop Run ${row.run_id} is invalid.`);
  }
  return {
    runId: row.run_id,
    loopId: row.loop_id,
    rootRunId: row.root_run_id,
    parentRunId: row.parent_run_id ?? undefined,
    parentStepRunId: row.parent_step_run_id ?? undefined,
    source: row.source === "human" ? "transition" : row.source,
    status: row.status,
    executionPlan: row.execution_plan_json ? JSON.parse(row.execution_plan_json) as LoopExecutionPlan : undefined,
    schedule: row.schedule_step_id && row.scheduled_for
      ? { stepId: row.schedule_step_id, scheduledFor: row.scheduled_for }
      : undefined,
    input: row.input ?? undefined,
    snapshot: loop,
    themeSnapshot: theme.data,
    transitionCount: row.transition_count,
    termination: row.termination_json
      ? migrateStoredTermination(JSON.parse(row.termination_json))
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined
  };
};

export const toStepRun = (row: StepRunRow): StepRun => {
  const outcome = storedOutcome(row);
  const result = storedResult(row, outcome);
  const transition = row.transition_json
    ? migrateStoredTransition(JSON.parse(row.transition_json), row, result)
    : undefined;
  return {
    stepRunId: row.step_run_id,
    runId: row.run_id,
    loopId: row.loop_id,
    stepId: row.step_id,
    type: row.step_type,
    agentId: row.agent_id ?? undefined,
    executionTaskId: row.execution_task_id ?? undefined,
    execution: row.execution_snapshot_json ? JSON.parse(row.execution_snapshot_json) as ExecutionRuntimeSnapshot : undefined,
    status: row.status,
    input: row.input ?? undefined,
    responseInput: row.response_input ?? undefined,
    result,
    transition,
    outcome,
    error: row.error ?? undefined,
    attempt: row.attempt,
    retryOfStepRunId: row.retry_of_step_run_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined
  };
};

const storedOutcome = (row: StepRunRow): AgentOutcome | undefined => {
  if (row.outcome_json) {
    const parsed = agentOutcomeSchema.safeParse(JSON.parse(row.outcome_json));
    if (parsed.success) return parsed.data;
  }
  if (row.step_type !== "agent" || row.result !== "rejected") return undefined;
  return {
    outcome: "failed",
    summary: row.error ?? "Legacy agent execution failed without a structured outcome.",
    checks: [],
    failure: { classification: "permanent", code: "execution_failed" }
  };
};

const storedResult = (row: StepRunRow, outcome?: AgentOutcome): StepRunResult | undefined => {
  if (row.step_type === "human") {
    return row.result === "approved" || row.result === "rejected"
      ? { kind: "human", decision: row.result }
      : undefined;
  }
  if (outcome) return { kind: "agent", outcome: outcome.outcome };
  return isAgentOutcomeStatus(row.result) ? { kind: "agent", outcome: row.result } : undefined;
};

const migrateStoredTransition = (
  value: unknown,
  row: StepRunRow,
  fallbackSignal?: StepRunResult
): StepRunTransition | undefined => {
  if (!isRecord(value)) return undefined;
  if (value.version === 1) return canonicalStoredTransition(value);
  const signal = storedSignal(value.signal) ?? fallbackSignal;
  if (!signal || typeof value.action !== "string") return undefined;
  return migrateLegacyStoredTransition(value, row, signal);
};

const migrateStoredTermination = (value: unknown): LoopRunTermination | undefined => {
  if (!isRecord(value) || typeof value.status !== "string" || typeof value.message !== "string") return undefined;
  return {
    ...value,
    status: value.status as LoopRunTermination["status"],
    code: normalizeStoredTerminationCode(value.code),
    message: value.message
  } as LoopRunTermination;
};

const storedSignal = (value: unknown): StepRunResult | undefined => {
  if (!isRecord(value)) return undefined;
  if (value.kind === "agent" && isAgentOutcomeStatus(value.outcome)) {
    return { kind: "agent", outcome: value.outcome };
  }
  if (value.kind === "human" && (value.decision === "approved" || value.decision === "rejected")) {
    return { kind: "human", decision: value.decision };
  }
  return undefined;
};

const isStoredTarget = (value: unknown): value is string | { loop: string } =>
  typeof value === "string"
  || (isRecord(value) && Object.keys(value).length === 1 && typeof value.loop === "string");

const isAgentOutcomeStatus = (value: unknown): value is AgentOutcome["outcome"] =>
  typeof value === "string" && agentOutcomeStatuses.some((candidate) => candidate === value);

const isStoredLoop = (value: unknown): value is ProjectLoop =>
  isRecord(value) && typeof value.id === "string" && typeof value.start === "string" && Array.isArray(value.nodes);

const canonicalStoredTransition = (value: JsonRecord): StepRunTransition | undefined => {
  const signal = storedSignal(value.signal);
  if (!signal || typeof value.action !== "string") return undefined;
  switch (value.action) {
    case "goto": return isCanonicalGoto(value) ? value as unknown as StepRunTransition : undefined;
    case "retry": return isCanonicalRetry(value) ? value as unknown as StepRunTransition : undefined;
    case "wait": return isCanonicalWait(value) ? value as unknown as StepRunTransition : undefined;
    case "terminate": return isCanonicalTerminate(value) ? value as unknown as StepRunTransition : undefined;
    default: return undefined;
  }
};

const isCanonicalGoto = (value: JsonRecord): boolean =>
  isStoredTarget(value.target) && isInputMode(value.input) && isCause(value.cause);

const isCanonicalRetry = (value: JsonRecord): boolean =>
  typeof value.target === "string"
  && isPositiveInteger(value.attempt)
  && isPositiveInteger(value.maxAttempts)
  && typeof value.policyFingerprint === "string"
  && isInputMode(value.input)
  && (value.evidenceFingerprint === undefined || typeof value.evidenceFingerprint === "string");

const isCanonicalWait = (value: JsonRecord): boolean =>
  isWaitResume(value.resume)
  && isInputMode(value.input)
  && isCause(value.cause)
  && (value.resumed === undefined || isStoredResume(value.resumed));

const isCanonicalTerminate = (value: JsonRecord): boolean =>
  isTerminationStatus(value.status) && isTerminationCode(value.code) && isCause(value.cause);

const isStoredResume = (value: unknown): boolean =>
  isRecord(value) && isStoredTarget(value.target) && typeof value.at === "string";

const isInputMode = (value: unknown): boolean =>
  value === undefined || value === "current" || value === "signal" || value === "append-signal";

const isCause = (value: unknown): boolean =>
  value === undefined || value === "condition-not-met" || value === "retry-exhausted" || value === "retry-stalled";

const isWaitResume = (value: unknown): boolean =>
  value === "same-step" || (isRecord(value) && Object.keys(value).length === 1 && isStoredTarget(value.target));

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isTerminationStatus = (
  value: unknown
): value is Extract<StepRunTransition, { action: "terminate" }>["status"] =>
  value === "completed" || value === "blocked" || value === "failed" || value === "cancelled";

const terminationCodes: LoopRunTermination["code"][] = [
  "completed", "cancelled", "configured_termination", "terminal_reached", "execution_failed",
  "orchestration_failed", "retry_exhausted", "retry_stalled", "transition_limit_exceeded",
  "missing_transition", "stale_transition", "invalid_transition"
];

const isTerminationCode = (value: unknown): value is LoopRunTermination["code"] =>
  typeof value === "string" && terminationCodes.some((candidate) => candidate === value);
