import type { ProjectAction, ProjectOutputRoute, ProjectPolicy } from "../../shared/domain/automation.js";
import type { RoutedEvent } from "../../shared/domain/events.js";
import type { AgentRunOutput } from "../../shared/domain/runtime.js";
import { projectOutputRouteEventType } from "../../shared/policy-actions.js";

export function mapAgentOutputToEvent(
  policy: ProjectPolicy,
  output: AgentRunOutput,
  outputRoutes: ProjectOutputRoute[],
  actions: ProjectAction[] = []
): RoutedEvent {
  return {
    id: projectOutputRouteEventType(policy, output.status, outputRoutes, actions),
    source: "agentd",
    timestamp: new Date().toISOString(),
    payload: {
      action: policy.action,
      status: output.status,
      ...(output.agent ? { agent: output.agent } : {}),
      ...(output.outcome ? { outcome: output.outcome } : {}),
      ...(output.summary ? { summary: output.summary } : {}),
      ...(output.runId ? { run_id: output.runId } : {}),
      ...(output.triggerEventId ? { trigger_event_id: output.triggerEventId } : {}),
      ...(output.policyId ? { policy_id: output.policyId } : {}),
      ...(output.policyVersion ? { policy_version: output.policyVersion } : {}),
      ...(output.payload ? { payload: output.payload } : {})
    }
  };
}
