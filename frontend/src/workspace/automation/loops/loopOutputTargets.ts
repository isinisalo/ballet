import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import {
  actionOutputIds,
  humanGateApprovalTriggerIdForPolicy,
  projectOutputRouteEventType,
  triggerEventType
} from "@shared/policy-actions";
import type { LoopOutputTarget } from "./loopGraph";

export function loopOutputTargetsForPolicy(
  config: ProjectAutomationConfig,
  policy: ProjectPolicy
): LoopOutputTarget[] {
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

    return {
      outputId,
      eventType: projectOutputRouteEventType(policy, outputId, config.outputRoutes, config.actions, config.policies),
      type: "event"
    };
  });
}
