import type { StepTransitionTarget } from "../../shared/domain/automation.js";
import type { StepOutcome, StepRun, StepRunResult } from "../../shared/domain/runtime.js";
import { LoopRunIntegrityError } from "./LoopRunErrors.js";

export const isLoopTarget = (target: StepTransitionTarget): target is { loop: string } =>
  typeof target === "object" && "loop" in target;

export const isActiveLoopConstraint = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const code = "code" in error ? String((error as Error & { code?: unknown }).code ?? "") : "";
  return code.startsWith("SQLITE_CONSTRAINT")
    && (error.message.includes("loop_runs.loop_id") || error.message.includes("idx_loop_runs_one_active"));
};

export const persistedTransitionResult = (stepRun: StepRun): StepRunResult => {
  if (stepRun.status !== "completed" || !stepRun.result) {
    throw new LoopRunIntegrityError(
      `Step Run ${stepRun.stepRunId} cannot transition with persisted status/result ${stepRun.status}/${stepRun.result ?? "null"}.`
    );
  }
  if (stepRun.outcome && (stepRun.outcome.state !== "completed" || stepRun.outcome.result !== stepRun.result)) {
    throw new LoopRunIntegrityError(
      `Step Run ${stepRun.stepRunId} has inconsistent persisted outcome and canonical result.`
    );
  }
  return stepRun.result;
};

export const forwardedStepInput = (previous: string | undefined, response: string): string =>
  previous ? `${previous}\n\n${response}` : response;

export const failedStepOutcome = (message: string): StepOutcome & { state: "failed" } => ({
  state: "failed",
  summary: message,
  checks: []
});
