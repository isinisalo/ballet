import type { StepOutcome } from "../../shared/domain/runtime.js";

export const failedRuntimeOutcome = (message: string): StepOutcome & { state: "failed" } => ({
  state: "failed",
  summary: message,
  checks: []
});
