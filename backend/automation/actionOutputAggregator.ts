import type { ProjectAction, ProjectOutput, ProjectPolicy } from "../../shared/domain/automation.js";
import type { AgentOutcome, AgentOutputEventStatus, AgentRun } from "../../shared/domain/runtime.js";
import { actionOutputIds, policyOutputEventType } from "../../shared/policy-actions.js";

const terminalRunStatuses = new Set(["completed", "failed", "blocked", "needs_input", "cancelled"]);

const firstAllowedOutput = (
  allowedOutputIds: string[],
  preferred: string[],
  fallback: string
): AgentOutputEventStatus => preferred.find((outputId) => allowedOutputIds.includes(outputId)) ?? fallback;

export const allPolicyRunsTerminal = (runs: AgentRun[]): boolean =>
  runs.length > 0 && runs.every((run) => terminalRunStatuses.has(run.status));

export const outcomeToOutputEventStatus = (
  outcome: AgentOutcome,
  policy: Pick<ProjectPolicy, "action">,
  actions: Array<Pick<ProjectAction, "id" | "outputIds">>
): AgentOutputEventStatus => {
  const allowedOutputIds = actionOutputIds(actions, policy.action);
  switch (outcome.outcome) {
    case "failed":
      return firstAllowedOutput(allowedOutputIds, ["failed"], "failed");
    case "blocked":
    case "needs_input":
      return firstAllowedOutput(allowedOutputIds, ["blocked", "failed"], "blocked");
    case "changes_requested":
      return firstAllowedOutput(allowedOutputIds, ["changes_requested", "rejected", "blocked"], "changes_requested");
    case "approved":
      return firstAllowedOutput(allowedOutputIds, ["approved", "accepted", "complete", "completed"], "approved");
    case "ready":
      return firstAllowedOutput(
        allowedOutputIds,
        policy.action === "deploy" ? ["deployed", "ready", "complete", "completed"] : ["ready", "complete", "completed"],
        "ready"
      );
  }
};

export const aggregateActionOutputStatus = (
  runs: AgentRun[],
  policy: Pick<ProjectPolicy, "action">,
  actions: Array<Pick<ProjectAction, "id" | "outputIds">>
): AgentOutputEventStatus => {
  const allowedOutputIds = actionOutputIds(actions, policy.action);
  const outcomes = runs.map((run) => run.outcome?.outcome).filter(Boolean);
  if (runs.some((run) => run.status === "failed" || run.status === "cancelled" || run.outcome?.outcome === "failed")) {
    return firstAllowedOutput(allowedOutputIds, ["failed"], "failed");
  }
  if (runs.some((run) => run.status === "blocked" || run.status === "needs_input" || run.outcome?.outcome === "blocked" || run.outcome?.outcome === "needs_input")) {
    return firstAllowedOutput(allowedOutputIds, ["blocked", "failed"], "blocked");
  }
  if (outcomes.includes("changes_requested")) {
    return firstAllowedOutput(allowedOutputIds, ["changes_requested", "rejected", "blocked"], "changes_requested");
  }
  if (outcomes.length > 0 && outcomes.every((outcome) => outcome === "approved")) {
    return firstAllowedOutput(allowedOutputIds, ["approved", "accepted", "complete", "completed"], "approved");
  }
  return firstAllowedOutput(
    allowedOutputIds,
    policy.action === "deploy" ? ["deployed", "ready", "complete", "completed"] : ["ready", "complete", "completed"],
    "ready"
  );
};

export const actionOutputType = (
  policy: Pick<ProjectPolicy, "action">,
  actions: Array<Pick<ProjectAction, "id" | "outputIds">>,
  outputs: Array<Pick<ProjectOutput, "id" | "type">>,
  outputId: string
) => {
  const allowedOutputIds = actionOutputIds(actions, policy.action);
  if (!allowedOutputIds.includes(outputId)) return undefined;
  return outputs.find((output) => output.id === outputId)?.type ?? "event";
};

export const actionOutputEventType = (
  policy: Pick<ProjectPolicy, "action">,
  outputId: AgentOutputEventStatus
): string => policyOutputEventType(policy, outputId);
