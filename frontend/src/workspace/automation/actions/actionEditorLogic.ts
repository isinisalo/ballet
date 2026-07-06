import type { ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { generatedPolicyId, policyOutputEventType } from "@shared/policy-actions";
import { editablePolicyToken } from "../automationUtils";
import { uniqueOutputIds } from "../outputs/outputSelectorUtils";

export const normalizeActionDraft = (action: ProjectAction): ProjectAction => {
  const normalized = {
    ...action,
    id: editablePolicyToken(action.id),
    outputIds: uniqueOutputIds(action.outputIds, 3),
    agentIds: [...new Set(action.agentIds)].slice(0, 5)
  };
  if (normalized.agentIds.length === 0) normalized.outputIds = [];
  return normalized;
};

export const nextConfigWithActionPatch = (
  current: ProjectAutomationConfig,
  actionId: string,
  patch: Partial<ProjectAction>
): { config: ProjectAutomationConfig; action: ProjectAction } => {
  const selectedIndex = current.actions.findIndex((action) => action.id === actionId);
  const previousAction = current.actions[selectedIndex];
  if (!previousAction) return { config: current, action: normalizeActionDraft({ id: actionId, description: "", outputIds: [], agentIds: [] }) };

  const normalized = normalizeActionDraft({ ...previousAction, ...patch });
  const previousId = previousAction.id;
  const nextActions = current.actions.map((action, index) => index === selectedIndex ? normalized : action);
  const eventIdMap = new Map<string, string>();
  if (previousId !== normalized.id) {
    previousAction.outputIds.forEach((outputId) => {
      eventIdMap.set(
        policyOutputEventType({ action: previousId }, outputId),
        policyOutputEventType({ action: normalized.id }, outputId)
      );
    });
  }

  const policyIdMap = new Map<string, string>();
  const policies = current.policies.map((policy) => {
    const nextAction = policy.action === previousId ? normalized.id : policy.action;
    const nextEvent = policy.source === "event" && policy.event ? eventIdMap.get(policy.event) ?? policy.event : policy.event;
    if (nextAction === policy.action && nextEvent === policy.event) return policy;
    const nextPolicy = { ...policy, action: nextAction, event: nextEvent };
    const nextPolicyId = generatedPolicyId(nextPolicy);
    policyIdMap.set(policy.id, nextPolicyId);
    return { ...nextPolicy, id: nextPolicyId };
  });

  return {
    action: normalized,
    config: {
      ...current,
      actions: nextActions,
      policies,
      workflows: current.workflows.map((workflow) => ({
        ...workflow,
        steps: workflow.steps.map((step) => policyIdMap.get(step) ?? step)
      }))
    }
  };
};
