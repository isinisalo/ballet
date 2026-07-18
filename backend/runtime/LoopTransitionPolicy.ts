import { createHash } from "node:crypto";
import type { ProjectAgentBackedStep, StepTransitionTarget } from "../../shared/domain/automation.js";
import type {
  AgentOutcome,
  LoopRunTermination,
  StepRun,
  StepRunResult,
  StepRunTransition
} from "../../shared/domain/runtime.js";

export const MAX_REPAIR_ATTEMPTS = 3;

export type AgentTransitionDecision =
  | { transition: StepRunTransition; target: StepTransitionTarget }
  | { transition: StepRunTransition; retry: true }
  | { transition: StepRunTransition; wait: true }
  | { transition: StepRunTransition; termination: LoopRunTermination };

export const decideAgentTransition = (input: {
  step: ProjectAgentBackedStep;
  stepRun: StepRun;
  outcome: AgentOutcome;
  history: StepRun[];
}): AgentTransitionDecision => {
  const { step, stepRun, outcome, history } = input;
  const signal = { kind: "agent", outcome: outcome.outcome } as const satisfies StepRunResult;

  if (outcome.outcome === "ready" || outcome.outcome === "approved") {
    const target = step.on[outcome.outcome];
    return { transition: { signal, action: "transition", target }, target };
  }

  if (outcome.outcome === "blocked") {
    return terminate(signal, stepRun, "blocked", "agent_blocked", outcome.summary);
  }

  if (outcome.outcome === "failed") {
    const retry = step.on.failed.retry;
    if (outcome.failure?.classification === "transient" && retry
      && !stepRun.retryOfStepRunId && stepRun.attempt <= retry.limit) {
      return {
        transition: { signal, action: "retry", target: step.id, retryAttempt: stepRun.attempt },
        retry: true
      };
    }
    const code = outcome.failure?.code === "execution_failed" ? "execution_failed" : "agent_failed";
    return terminate(signal, stepRun, "failed", code, outcome.summary);
  }

  if (outcome.outcome === "needs_input") {
    const route = step.on.needs_input;
    if ("human" in route) {
      return { transition: { signal, action: "human", target: route.human }, target: route.human };
    }
    return { transition: { signal, action: "wait", reason: "needs_input" }, wait: true };
  }

  const route = step.on["changes-requested"];
  if ("terminate" in route) {
    return terminate(signal, stepRun, "blocked", "changes_requested", "No repair step is configured for changes-requested.");
  }
  const repairs = history.filter((candidate) => candidate.loopId === stepRun.loopId
    && candidate.stepId === stepRun.stepId
    && candidate.transition?.action === "repair"
    && candidate.transition.target === route.repair);
  const repairAttempt = repairs.length + 1;
  const evidenceFingerprint = fingerprintRepairEvidence(outcome);
  if (repairs.some((candidate) => candidate.transition?.action === "repair"
    && candidate.transition.evidenceFingerprint === evidenceFingerprint)) {
    return terminate(signal, stepRun, "blocked", "stalled_repair",
      "The same failing evidence was returned after repair without material change.", {
        target: route.repair,
        evidenceFingerprint
      });
  }
  if (repairAttempt > MAX_REPAIR_ATTEMPTS) {
    return terminate(signal, stepRun, "blocked", "repair_limit_exceeded",
      `The repair loop reached its limit of ${MAX_REPAIR_ATTEMPTS}.`, {
        target: route.repair,
        limit: MAX_REPAIR_ATTEMPTS,
        count: repairAttempt
      });
  }
  return {
    transition: {
      signal,
      action: "repair",
      target: route.repair,
      repairAttempt,
      evidenceFingerprint
    },
    target: route.repair
  };
};

export const fingerprintRepairEvidence = (outcome: AgentOutcome): string => {
  const checks = outcome.checks
    .filter((check) => check.status === "failed")
    .map((check) => ({ name: check.name, status: check.status, details: check.details ?? "" }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.details.localeCompare(right.details));
  return createHash("sha256")
    .update(stableJson({ checks, artifacts: outcome.artifacts ?? {} }))
    .digest("hex");
};

const terminate = (
  signal: StepRunResult,
  stepRun: StepRun,
  status: "blocked" | "failed",
  code: LoopRunTermination["code"],
  message: string,
  detail: Partial<LoopRunTermination> = {}
): AgentTransitionDecision => {
  const termination: LoopRunTermination = {
    status,
    code,
    message,
    stepRunId: stepRun.stepRunId,
    stepId: stepRun.stepId,
    signal,
    ...detail
  };
  return { transition: { signal, action: "terminate", status, code }, termination };
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};
