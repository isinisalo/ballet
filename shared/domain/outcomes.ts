export const agentOutcomeStatuses = [
  "ready",
  "approved",
  "changes-requested",
  "needs_input",
  "blocked",
  "failed"
] as const;

export type AgentOutcomeStatus = (typeof agentOutcomeStatuses)[number];

export const humanDecisions = ["approved", "rejected"] as const;

export type HumanDecision = (typeof humanDecisions)[number];
