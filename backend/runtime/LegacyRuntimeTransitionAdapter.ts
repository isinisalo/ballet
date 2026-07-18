import type { RetryTransitionAction } from "../../shared/domain/automation.js";
import type {
  LoopRunTermination,
  StepRunResult,
  StepRunTransition
} from "../../shared/domain/runtime.js";
import { transitionPolicyFingerprint } from "./LoopTransitionPolicy.js";
import type { StepRunRow } from "./RuntimeDbTypes.js";

type JsonRecord = Record<string, unknown>;

export const migrateLegacyStoredTransition = (
  value: JsonRecord,
  row: StepRunRow,
  signal: StepRunResult
): StepRunTransition | undefined => {
  switch (value.action) {
    case "transition": return legacyGoto(value, signal, signal.kind === "human" ? "append-signal" : undefined);
    case "human": return legacyGoto(value, signal, "signal");
    case "repair": return legacyRepair(value, row, signal);
    case "retry": return legacyRetry(value, row, signal);
    case "wait": return legacyWait(signal);
    case "resume": return legacyResume(value, row, signal);
    case "terminate": return legacyTerminate(value, signal);
    default: return undefined;
  }
};

export const normalizeStoredTerminationCode = (value: unknown): LoopRunTermination["code"] => {
  const code = String(value ?? "configured_termination");
  if (code === "repair_limit_exceeded") return "retry_exhausted";
  if (code === "stalled_repair") return "retry_stalled";
  if (["agent_blocked", "agent_failed", "changes_requested", "needs_input"].includes(code)) {
    return "configured_termination";
  }
  if (["human_approved", "human_rejected"].includes(code)) return "terminal_reached";
  return isTerminationCode(code) ? code : "configured_termination";
};

const legacyGoto = (
  value: JsonRecord,
  signal: StepRunResult,
  input?: "signal" | "append-signal"
): StepRunTransition | undefined => isStoredTarget(value.target) ? {
  version: 1,
  signal,
  action: "goto",
  target: value.target,
  ...(input ? { input } : {})
} : undefined;

const legacyRepair = (
  value: JsonRecord,
  row: StepRunRow,
  signal: StepRunResult
): StepRunTransition | undefined => {
  if (typeof value.target !== "string") return undefined;
  const action: RetryTransitionAction = {
    action: "retry",
    target: value.target,
    ...(signal.kind === "human" ? { input: "append-signal" as const } : {}),
    policy: {
      maxAttempts: 3,
      onExhausted: { action: "terminate", status: "blocked" },
      ...(signal.kind === "agent" ? { stallDetection: "same-evidence" as const } : {})
    }
  };
  return {
    version: 1,
    signal,
    action: "retry",
    target: value.target,
    ...(action.input ? { input: action.input } : {}),
    attempt: typeof value.repairAttempt === "number" ? value.repairAttempt : 1,
    maxAttempts: 3,
    policyFingerprint: transitionPolicyFingerprint(action, row.step_id, signal),
    ...(typeof value.evidenceFingerprint === "string" ? { evidenceFingerprint: value.evidenceFingerprint } : {})
  };
};

const legacyRetry = (
  value: JsonRecord,
  row: StepRunRow,
  signal: StepRunResult
): StepRunTransition | undefined => {
  if (typeof value.target !== "string") return undefined;
  const action: RetryTransitionAction = {
    action: "retry",
    policy: {
      maxAttempts: 1,
      when: { failureClassification: "transient" },
      onExhausted: { action: "terminate", status: "failed" }
    }
  };
  return {
    version: 1,
    signal,
    action: "retry",
    target: value.target,
    attempt: typeof value.retryAttempt === "number" ? value.retryAttempt : 1,
    maxAttempts: 1,
    policyFingerprint: transitionPolicyFingerprint(action, row.step_id, signal)
  };
};

const legacyWait = (signal: StepRunResult): StepRunTransition => ({
  version: 1,
  signal,
  action: "wait",
  resume: "same-step",
  input: "append-signal"
});

const legacyResume = (
  value: JsonRecord,
  row: StepRunRow,
  signal: StepRunResult
): StepRunTransition | undefined => isStoredTarget(value.target) ? {
  version: 1,
  signal,
  action: "wait",
  resume: "same-step",
  input: "append-signal",
  resumed: { target: value.target, at: row.updated_at }
} : undefined;

const legacyTerminate = (
  value: JsonRecord,
  signal: StepRunResult
): StepRunTransition | undefined => isTerminationStatus(value.status) ? {
  version: 1,
  signal,
  action: "terminate",
  status: value.status,
  code: normalizeStoredTerminationCode(value.code)
} : undefined;

const isStoredTarget = (value: unknown): value is string | { loop: string } =>
  typeof value === "string"
  || (isRecord(value) && Object.keys(value).length === 1 && typeof value.loop === "string");

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
