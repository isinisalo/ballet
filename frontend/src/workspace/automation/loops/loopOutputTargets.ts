import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import {
  actionOutputIds,
  projectOutputRouteEventType
} from "@shared/policy-actions";
import type { LoopOutputTarget } from "./loopGraph";

export function loopOutputTargetsForPolicy(
  config: ProjectAutomationConfig,
  policy: ProjectPolicy
): LoopOutputTarget[] {
  return actionOutputIds(config.actions, policy.action).map((outputId) => {
    return {
      outputId,
      eventType: projectOutputRouteEventType(policy, outputId, config.outputRoutes, config.actions, config.policies),
      type: "event"
    };
  });
}
