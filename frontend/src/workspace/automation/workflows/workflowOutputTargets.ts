import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import {
  actionOutputIds,
  findProjectOutputRoute,
  humanGateApprovalTriggerIdForPolicy,
  policyOutputEventType,
  triggerEventType
} from "@shared/policy-actions";
import type { WorkflowOutputTarget } from "./workflowGraph";

export function workflowOutputTargetsForPolicy(
  config: ProjectAutomationConfig,
  policy: ProjectPolicy
): WorkflowOutputTarget[] {
  return actionOutputIds(config.actions, policy.action).map((outputId) => {
    const derivedTriggerId = humanGateApprovalTriggerIdForPolicy(policy, outputId, config.actions);
    if (derivedTriggerId) {
      return {
        outputId,
        eventType: triggerEventType(derivedTriggerId),
        type: "trigger",
        trigger: derivedTriggerId
      };
    }

    const route = findProjectOutputRoute(config.outputRoutes, policy.id, outputId);

    return {
      outputId,
      eventType: route?.target.type === "event" && route.target.eventType
        ? route.target.eventType
        : policyOutputEventType(policy, outputId),
      type: "event"
    };
  });
}
