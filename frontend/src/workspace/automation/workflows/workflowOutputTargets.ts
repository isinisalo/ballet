import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import {
  actionOutputIds,
  findProjectOutputRoute,
  policyOutputEventType,
  triggerEventType
} from "@shared/policy-actions";
import type { WorkflowOutputTarget } from "./workflowGraph";

export function workflowOutputTargetsForPolicy(
  config: ProjectAutomationConfig,
  policy: ProjectPolicy
): WorkflowOutputTarget[] {
  return actionOutputIds(config.actions, policy.action).map((outputId) => {
    const route = findProjectOutputRoute(config.outputRoutes, policy.id, outputId);

    if (route?.target.type === "trigger") {
      return {
        outputId,
        eventType: triggerEventType(route.target.trigger),
        type: "trigger",
        trigger: route.target.trigger,
        workflowId: route.target.workflowId
      };
    }

    return {
      outputId,
      eventType: route?.target.type === "event" && route.target.eventType
        ? route.target.eventType
        : policyOutputEventType(policy, outputId),
      type: "event"
    };
  });
}
