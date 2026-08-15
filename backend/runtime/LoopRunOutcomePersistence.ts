import type { LoopRun, StepOutcome, StepRun } from "../../shared/domain/runtime.js";
import type { LoopRunStore } from "./LoopRunStore.js";

export const persistNonCompletedOutcome = (
  store: LoopRunStore,
  run: LoopRun,
  stepRun: StepRun,
  outcome: StepOutcome,
  error?: string
): boolean => {
  if (outcome.state === "needs_input") {
    store.pauseStepRunForInput(stepRun, outcome);
    store.waitForStepInput(run.runId);
    return true;
  }
  if (outcome.state === "blocked" || outcome.state === "failed") {
    store.finishStepRunWithoutTransition(stepRun, outcome.state, outcome, error);
    store.finishRun(run.runId, outcome.state);
    return true;
  }
  return false;
};
