import type { ProjectPolicy } from "../../shared/domain/automation.js";
import type { RoutedEvent } from "../../shared/domain/events.js";
import type { AgentRunOutput } from "../../shared/domain/runtime.js";
import { policyOutputEventType } from "../../shared/policy-actions.js";

export function mapAgentOutputToEvent(
  policy: ProjectPolicy,
  output: AgentRunOutput
): RoutedEvent {
  return {
    id: policyOutputEventType(policy, output.status),
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
