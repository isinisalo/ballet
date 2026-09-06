export const CONTRACT_LIMITS = {
  states: 128,
  actionsPerState: 128,
  actionsTotal: 4_096,
  referencesPerItem: 64,
  agents: 64,
  skillsPerAgent: 64,
  maxRetries: 20,
  text: 20_000,
  instruction: 100_000,
  evidenceItems: 256,
  proposalFiles: 128
} as const;
