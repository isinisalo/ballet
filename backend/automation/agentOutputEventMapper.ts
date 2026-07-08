import type { ProjectAction, ProjectOutputRoute } from "../../shared/domain/automation.js";
import type { RoutedEvent } from "../../shared/domain/events.js";
import type { AgentRunOutput } from "../../shared/domain/runtime.js";
import { actionOutputIds, actionOutputRouteEventType, actionOutputSlotKind, defaultActionOutputIds, normalizeActionToken } from "../../shared/policy-actions.js";

const canonicalOutputStatus = (
  status: string,
  action: Pick<ProjectAction, "id">,
  actions: ProjectAction[]
): string => {
  const allowedOutputIds = actionOutputIds(actions, action.id);
  const normalizedStatus = normalizeActionToken(status);
  if (allowedOutputIds.includes(normalizedStatus)) return normalizedStatus;
  const slot = actionOutputSlotKind(normalizedStatus);
  if (slot === "approval") return allowedOutputIds[0] ?? defaultActionOutputIds[0];
  if (slot === "rework") return allowedOutputIds[1] ?? defaultActionOutputIds[1];
  return allowedOutputIds[0] ?? defaultActionOutputIds[0];
};

export function mapAgentOutputToEvent(
  action: ProjectAction,
  output: AgentRunOutput,
  outputRoutes: ProjectOutputRoute[],
  actions: ProjectAction[] = [],
): RoutedEvent {
  const status = canonicalOutputStatus(output.status, action, actions);
  return {
    id: actionOutputRouteEventType({ ...action, loopId: output.loopId }, status, outputRoutes, actions),
    source: "agentd",
    timestamp: new Date().toISOString(),
    payload: {
      action: action.id,
      status,
      ...(output.agent ? { agent: output.agent } : {}),
      ...(output.outcome ? { outcome: output.outcome } : {}),
      ...(output.summary ? { summary: output.summary } : {}),
      ...(output.runId ? { run_id: output.runId } : {}),
      ...(output.inputEventId ? { input_event_id: output.inputEventId } : {}),
      ...(output.actionId ? { action_id: output.actionId } : {}),
      ...(output.loopId ? { loop_id: output.loopId } : {}),
      ...(output.actionVersion ? { action_version: output.actionVersion } : {}),
      ...(output.payload ? { payload: output.payload } : {})
    }
  };
}
