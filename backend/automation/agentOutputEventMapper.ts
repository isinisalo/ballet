import type { ProjectAction, ProjectOutputRoute, ProjectPolicy } from "../../shared/domain/automation.js";
import type { RoutedEvent } from "../../shared/domain/events.js";
import type { AgentRunOutput } from "../../shared/domain/runtime.js";
import { actionOutputIds, actionOutputSlotKind, defaultPolicyOutputIds, normalizePolicyToken, projectOutputRouteEventType } from "../../shared/policy-actions.js";

const canonicalOutputStatus = (
  status: string,
  policy: Pick<ProjectPolicy, "action">,
  actions: ProjectAction[]
): string => {
  const allowedOutputIds = actionOutputIds(actions, policy.action);
  const normalizedStatus = normalizePolicyToken(status);
  if (allowedOutputIds.includes(normalizedStatus)) return normalizedStatus;
  const slot = actionOutputSlotKind(normalizedStatus);
  if (slot === "approval") return allowedOutputIds[0] ?? defaultPolicyOutputIds[0];
  if (slot === "rework") return allowedOutputIds[1] ?? defaultPolicyOutputIds[1];
  return allowedOutputIds[0] ?? defaultPolicyOutputIds[0];
};

export function mapAgentOutputToEvent(
  policy: ProjectPolicy,
  output: AgentRunOutput,
  outputRoutes: ProjectOutputRoute[],
  actions: ProjectAction[] = [],
  policies: ProjectPolicy[] = []
): RoutedEvent {
  const status = canonicalOutputStatus(output.status, policy, actions);
  return {
    id: projectOutputRouteEventType(policy, status, outputRoutes, actions, policies),
    source: "agentd",
    timestamp: new Date().toISOString(),
    payload: {
      action: policy.action,
      status,
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
