import {
  defaultAgentStepTransitions,
  type ProjectAgentStepTransitions,
  type StepTransitionTarget
} from "@shared/api/workspace-contracts";

export const agentTransitions = (
  success: StepTransitionTarget,
  options: { repair?: string; human?: string; wait?: boolean } = {}
): ProjectAgentStepTransitions => ({
  ...defaultAgentStepTransitions(),
  ready: success,
  approved: success,
  "changes-requested": options.repair ? { repair: options.repair } : { terminate: "blocked" },
  needs_input: options.human ? { human: options.human } : { wait: true }
});
