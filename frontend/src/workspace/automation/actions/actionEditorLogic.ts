import type { ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { actionOutputSlotKind, generatedPolicyId, normalizeActionOutputSlots, policyOutputEventType } from "@shared/policy-actions";
import { editablePolicyToken } from "../automationUtils";

export const normalizeActionDraft = (action: ProjectAction): ProjectAction => {
  const normalized = {
    ...action,
    id: editablePolicyToken(action.id),
    outputIds: normalizeActionOutputSlots(action.outputIds),
    agentIds: [...new Set(action.agentIds)].slice(0, 5)
  };
  if (normalized.agentIds.length === 0) normalized.outputIds = [];
  return normalized;
};

const previousOutputSlotIndex = (outputId: string, index: number): number | undefined => {
  const slot = actionOutputSlotKind(outputId);
  if (slot === "approval") return 0;
  if (slot === "rework") return 1;
  return index < 2 ? index : undefined;
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
  if (previousId !== normalized.id || previousAction.outputIds.join("\0") !== normalized.outputIds.join("\0")) {
    previousAction.outputIds.forEach((outputId, outputIndex) => {
      const slotIndex = previousOutputSlotIndex(outputId, outputIndex);
      const nextOutputId = slotIndex === undefined ? undefined : normalized.outputIds[slotIndex];
      if (!nextOutputId) return;
      eventIdMap.set(
        policyOutputEventType({ action: previousId }, outputId),
        policyOutputEventType({ action: normalized.id }, nextOutputId)
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
