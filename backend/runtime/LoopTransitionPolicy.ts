import { createHash } from "node:crypto";
import type {
  TransitionAction,
  TransitionFallbackAction,
  TransitionInputMode
} from "../../shared/domain/automation.js";
import type {
  AgentOutcome,
  LoopRunTermination,
  StepRun,
  StepRunResult,
  StepRunTransition,
  TransitionResolutionCause
} from "../../shared/domain/runtime.js";

export type TransitionDecision =
  | {
      kind: "goto";
      transition: Extract<StepRunTransition, { action: "goto" }>;
      target: Extract<StepRunTransition, { action: "goto" }>["target"];
      inputMode: TransitionInputMode;
    }
  | {
      kind: "retry";
      transition: Extract<StepRunTransition, { action: "retry" }>;
      target: string;
      inputMode: TransitionInputMode;
    }
  | {
      kind: "wait";
      transition: Extract<StepRunTransition, { action: "wait" }>;
    }
  | {
      kind: "terminate";
      transition: Extract<StepRunTransition, { action: "terminate" }>;
      termination: LoopRunTermination;
    };

export const interpretTransitionAction = (input: {
  action: TransitionAction;
  signal: StepRunResult;
  stepRun: StepRun;
  history: StepRun[];
  outcome?: AgentOutcome;
  responseInput?: string;
}): TransitionDecision => {
  if (input.action.action !== "retry") return resolveAction(input.action, input);

  const { action, outcome, history, stepRun } = input;
  const policyFingerprint = transitionPolicyFingerprint(action, stepRun.stepId, input.signal);
  const policyHistory = action.target === undefined
    ? retryChain(history, stepRun)
    : history.filter((candidate) => candidate.loopId === stepRun.loopId && candidate.stepId === stepRun.stepId);
  const previous = policyHistory.filter((candidate) => candidate.loopId === stepRun.loopId
    && candidate.stepId === stepRun.stepId
    && candidate.transition?.action === "retry"
    && candidate.transition.policyFingerprint === policyFingerprint);
  const attempt = previous.length + 1;
  const condition = action.policy.when?.failureClassification;
  if (condition && outcome?.failure?.classification !== condition) {
    return resolveAction(action.policy.onExhausted, input, {
      cause: "condition-not-met",
      attempt,
      maxAttempts: action.policy.maxAttempts
    });
  }

  const evidenceFingerprint = action.policy.stallDetection === "same-evidence"
    ? fingerprintEvidence(input.signal, outcome, input.responseInput)
    : undefined;

  if (evidenceFingerprint && previous.some((candidate) => candidate.transition?.action === "retry"
    && candidate.transition.evidenceFingerprint === evidenceFingerprint)) {
    return resolveAction(action.policy.onExhausted, input, {
      cause: "retry-stalled",
      attempt,
      maxAttempts: action.policy.maxAttempts,
      evidenceFingerprint
    });
  }
  if (attempt > action.policy.maxAttempts) {
    return resolveAction(action.policy.onExhausted, input, {
      cause: "retry-exhausted",
      attempt,
      maxAttempts: action.policy.maxAttempts
    });
  }

  const target = action.target ?? stepRun.stepId;
  return {
    kind: "retry",
    target,
    inputMode: action.input ?? "current",
    transition: {
      version: 1,
      signal: input.signal,
      action: "retry",
      target,
      ...(action.input ? { input: action.input } : {}),
      attempt,
      maxAttempts: action.policy.maxAttempts,
      policyFingerprint,
      ...(evidenceFingerprint ? { evidenceFingerprint } : {})
    }
  };
};

const retryChain = (history: StepRun[], stepRun: StepRun): StepRun[] => {
  const byId = new Map(history.map((candidate) => [candidate.stepRunId, candidate]));
  const chain: StepRun[] = [];
  let parentId = stepRun.retryOfStepRunId;
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent) break;
    chain.push(parent);
    parentId = parent.retryOfStepRunId;
  }
  return chain;
};

const resolveAction = (
  action: TransitionFallbackAction,
  input: Parameters<typeof interpretTransitionAction>[0],
  resolution?: {
    cause: TransitionResolutionCause;
    attempt: number;
    maxAttempts: number;
    evidenceFingerprint?: string;
  }
): TransitionDecision => {
  const cause = resolution?.cause;
  if (action.action === "goto") {
    return {
      kind: "goto",
      target: action.target,
      inputMode: action.input ?? "current",
      transition: {
        version: 1,
        signal: input.signal,
        action: "goto",
        target: action.target,
        ...(action.input ? { input: action.input } : {}),
        ...(cause ? { cause } : {})
      }
    };
  }
  if (action.action === "wait") {
    return {
      kind: "wait",
      transition: {
        version: 1,
        signal: input.signal,
        action: "wait",
        resume: action.resume,
        ...(action.input ? { input: action.input } : {}),
        ...(cause ? { cause } : {})
      }
    };
  }

  const code = cause === "retry-exhausted" ? "retry_exhausted"
    : cause === "retry-stalled" ? "retry_stalled"
      : "configured_termination";
  const message = cause === "retry-exhausted"
    ? "The configured retry attempt limit was reached."
    : cause === "retry-stalled"
      ? "The configured retry policy detected repeated evidence."
      : cause === "condition-not-met"
        ? "The configured retry condition did not match; its fallback terminated the Run."
        : `The configured transition terminated the Run as ${action.status}.`;
  const termination: LoopRunTermination = {
    status: action.status,
    code,
    message,
    stepRunId: input.stepRun.stepRunId,
    stepId: input.stepRun.stepId,
    signal: input.signal,
    ...(cause && input.action.action === "retry"
      ? { target: input.action.target ?? input.stepRun.stepId }
      : {}),
    ...(resolution ? {
      count: resolution.attempt,
      limit: resolution.maxAttempts,
      ...(resolution.evidenceFingerprint ? { evidenceFingerprint: resolution.evidenceFingerprint } : {})
    } : {})
  };
  return {
    kind: "terminate",
    termination,
    transition: {
      version: 1,
      signal: input.signal,
      action: "terminate",
      status: action.status,
      code,
      ...(cause ? { cause } : {})
    }
  };
};

export const fingerprintTransitionEvidence = (outcome: AgentOutcome): string =>
  fingerprintEvidence({ kind: "agent", outcome: outcome.outcome }, outcome);

export const transitionPolicyFingerprint = (
  action: Extract<TransitionAction, { action: "retry" }>,
  sourceStepId: string,
  signal: StepRunResult
): string => fingerprint({ sourceStepId, signal, action });

const fingerprintEvidence = (
  signal: StepRunResult,
  outcome?: AgentOutcome,
  responseInput?: string
): string => {
  if (signal.kind === "human") return fingerprint({ responseInput: responseInput ?? "" });
  const checks = (outcome?.checks ?? [])
    .filter((check) => check.status === "failed")
    .map((check) => ({ name: check.name, status: check.status, details: check.details ?? "" }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.details.localeCompare(right.details));
  return fingerprint({ checks, artifacts: outcome?.artifacts ?? {} });
};

const fingerprint = (value: unknown): string => createHash("sha256")
  .update(stableJson(value))
  .digest("hex");

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};
