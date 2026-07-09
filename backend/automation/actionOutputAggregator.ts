import type { ProjectAction, ProjectOutputRoute } from "../../shared/domain/automation.js";
import type { AgentOutcome, AgentOutputEventStatus, AgentRun } from "../../shared/domain/runtime.js";
import { actionOutputIds, actionOutputRouteEventType, defaultActionOutputIds } from "../../shared/policy-actions.js";

const terminalRunStatuses = new Set(["completed", "failed", "blocked", "needs_input", "cancelled"]);

const approvalOutput = (allowedOutputIds: string[]): AgentOutputEventStatus =>
  allowedOutputIds[0] ?? defaultActionOutputIds[0];

const reworkOutput = (allowedOutputIds: string[]): AgentOutputEventStatus | undefined =>
  allowedOutputIds[1];

export const allActionRunsTerminal = (runs: AgentRun[]): boolean =>
  runs.length > 0 && runs.every((run) => terminalRunStatuses.has(run.status));

export const outcomeToOutputEventStatus = (
  outcome: AgentOutcome,
  action: Pick<ProjectAction, "id">,
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentId?: string }>
): AgentOutputEventStatus | undefined => {
  const allowedOutputIds = actionOutputIds(actions, action.id);
  switch (outcome.outcome) {
    case "failed":
      return reworkOutput(allowedOutputIds);
    case "blocked":
    case "needs_input":
      return reworkOutput(allowedOutputIds);
    case "changes-requested":
      return reworkOutput(allowedOutputIds);
    case "approved":
      return approvalOutput(allowedOutputIds);
    case "ready":
      return approvalOutput(allowedOutputIds);
  }
};

export const aggregateActionOutputStatus = (
  runs: AgentRun[],
  action: Pick<ProjectAction, "id">,
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentId?: string }>
): AgentOutputEventStatus | undefined => {
  const allowedOutputIds = actionOutputIds(actions, action.id);
  const outcomes = runs.map((run) => run.outcome?.outcome).filter(Boolean);
  if (runs.some((run) => run.status === "failed" || run.status === "cancelled" || run.outcome?.outcome === "failed")) {
    return reworkOutput(allowedOutputIds);
  }
  if (runs.some((run) => run.status === "blocked" || run.status === "needs_input" || run.outcome?.outcome === "blocked" || run.outcome?.outcome === "needs_input")) {
    return reworkOutput(allowedOutputIds);
  }
  if (outcomes.includes("changes-requested")) {
    return reworkOutput(allowedOutputIds);
  }
  if (outcomes.length > 0 && outcomes.every((outcome) => outcome === "approved")) {
    return approvalOutput(allowedOutputIds);
  }
  return approvalOutput(allowedOutputIds);
};

export const actionOutputEventType = (
  action: Pick<ProjectAction, "id"> & { loopId?: string },
  outputId: AgentOutputEventStatus,
  outputRoutes: ProjectOutputRoute[],
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentId?: string }> = [],
): string => actionOutputRouteEventType(action, outputId, outputRoutes, actions);
