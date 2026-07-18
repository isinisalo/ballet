import {
  defaultAgentStepTransitions,
  gotoTransition,
  terminateTransition,
  type ProjectAgentStepTransitions,
  type StepTransitionTarget
} from "@shared/api/workspace-contracts";

export const agentTransitions = (
  success: StepTransitionTarget,
  options: { repair?: string; human?: string; wait?: boolean } = {}
): ProjectAgentStepTransitions => ({
  ...defaultAgentStepTransitions(),
  ready: gotoTransition(success),
  approved: gotoTransition(success),
  "changes-requested": options.repair ? {
    action: "retry",
    target: options.repair,
    policy: {
      maxAttempts: 3,
      stallDetection: "same-evidence",
      onExhausted: terminateTransition("blocked")
    }
  } : terminateTransition("blocked"),
  needs_input: options.human
    ? gotoTransition(options.human, "signal")
    : { action: "wait", resume: "same-step", input: "append-signal" }
});
