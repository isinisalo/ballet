import type { ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { actionOutputSlotCount, actionOutputSlotKind, generatedPolicyId, humanGateResponseId, normalizeActionOutputSlots, projectOutputRouteKey, policyOutputEventType } from "@shared/policy-actions";
import { editablePolicyToken } from "../automationUtils";

export const normalizeActionDraft = (action: ProjectAction): ProjectAction => {
  const normalized = {
    ...action,
    id: editablePolicyToken(action.id),
    outputIds: normalizeActionOutputSlots(action.outputIds),
    agentIds: action.humanGate ? [] : [...new Set(action.agentIds)].slice(0, 5)
  };
  if (normalized.agentIds.length === 0 && !normalized.humanGate) normalized.outputIds = [];
  return normalized;
};

const previousOutputSlotIndex = (outputId: string, index: number, outputCount: number): number | undefined => {
  if (outputCount <= actionOutputSlotCount) return index;
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
  const outputIdMap = new Map<string, string>();
  if (previousId !== normalized.id || previousAction.outputIds.join("\0") !== normalized.outputIds.join("\0")) {
    previousAction.outputIds.forEach((outputId, outputIndex) => {
      const slotIndex = previousOutputSlotIndex(outputId, outputIndex, previousAction.outputIds.length);
      const nextOutputId = slotIndex === undefined ? undefined : normalized.outputIds[slotIndex];
      if (!nextOutputId) return;
      outputIdMap.set(outputId, nextOutputId);
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
  const policyById = new Map(policies.map((policy) => [policy.id, policy]));
  const actionById = new Map(nextActions.map((action) => [action.id, action]));
  const outputRouteByKey = new Map(current.outputRoutes.flatMap((route) => {
    const previousPolicy = current.policies.find((policy) => policy.id === route.sourcePolicyId);
    const sourcePolicyId = policyIdMap.get(route.sourcePolicyId) ?? route.sourcePolicyId;
    const outputId = previousPolicy?.action === previousId ? outputIdMap.get(route.outputId) ?? route.outputId : route.outputId;
    const nextPolicy = policyById.get(sourcePolicyId);
    const nextAction = nextPolicy ? actionById.get(nextPolicy.action) : undefined;
    if (!nextAction?.outputIds.includes(outputId)) return [];
    const nextRoute = { ...route, sourcePolicyId, outputId };
    return [[projectOutputRouteKey(nextRoute.sourcePolicyId, nextRoute.outputId), nextRoute] as const];
  }));
  const humanGateResponses = current.humanGateResponses.flatMap((response) => {
    const previousPolicy = current.policies.find((policy) => policy.id === response.policyId);
    const policyId = policyIdMap.get(response.policyId) ?? response.policyId;
    const nextPolicy = policyById.get(policyId);
    const actionId = response.actionId === previousId ? normalized.id : response.actionId;
    const nextAction = actionById.get(actionId);
    const outputId = previousPolicy?.action === previousId ? outputIdMap.get(response.outputId) ?? response.outputId : response.outputId;
    if (!nextPolicy || !nextAction?.humanGate || !nextAction.outputIds.includes(outputId)) return [];
    const nextResponse = { ...response, policyId, actionId, outputId };
    return [{ ...nextResponse, id: humanGateResponseId(nextResponse) }];
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
      })),
      outputRoutes: [...outputRouteByKey.values()],
      humanGateResponses
    }
  };
};
