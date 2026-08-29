export const PROJECT_CONFIG_VERSION = 20 as const;
export const ROOT_SNAPSHOT_VERSION = 13 as const;
export const TASK_ENVELOPE_VERSION = 10 as const;
export const ROLE_OUTCOME_VERSION = 10 as const;
export const PROMPT_COMPOSITION_VERSION = 11 as const;
export const EXECUTION_SPEC_VERSION = 12 as const;
export const FEEDBACK_CONTRACT_VERSION = 1 as const;
export const CRITIC_CONTRACT_VERSION = 1 as const;
export const REFINEMENT_CONTRACT_VERSION = 1 as const;

export const VERSION_MATRIX = {
  projectConfig: PROJECT_CONFIG_VERSION,
  rootSnapshot: ROOT_SNAPSHOT_VERSION,
  taskEnvelope: TASK_ENVELOPE_VERSION,
  roleOutcome: ROLE_OUTCOME_VERSION,
  promptComposition: PROMPT_COMPOSITION_VERSION,
  executionSpec: EXECUTION_SPEC_VERSION,
  feedback: FEEDBACK_CONTRACT_VERSION,
  critic: CRITIC_CONTRACT_VERSION,
  refinement: REFINEMENT_CONTRACT_VERSION
} as const;
