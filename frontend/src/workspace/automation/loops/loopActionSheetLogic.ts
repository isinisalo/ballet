import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import { generatedPolicyId, projectOutputRouteCanTargetTrigger, projectOutputRouteKey } from "@shared/policy-actions";

export const nextConfigWithLoopStepAction = (
  current: ProjectAutomationConfig,
  loopId: string,
  stepIndex: number,
  actionId: string
): ProjectAutomationConfig => nextConfigWithLoopHandlerAction(current, loopId, stepIndex, actionId);

export const nextConfigWithLoopHandlerAction = (
  current: ProjectAutomationConfig,
  loopId: string,
  handlerStepIndex: number,
  actionId: string
): ProjectAutomationConfig => {
  const loop = current.loops.find((candidate) => candidate.id === loopId);
  const targetAction = current.actions.find((action) => action.id === actionId);

  if (!loop || !targetAction || handlerStepIndex < 0 || handlerStepIndex >= loop.steps.length) return current;

  const stepPolicyId = loop.steps[handlerStepIndex];
  const currentPolicy = stepPolicyId ? current.policies.find((policy) => policy.id === stepPolicyId) : undefined;
  if (!currentPolicy || currentPolicy.action === actionId) return current;

  const nextPolicy: ProjectPolicy = {
    ...currentPolicy,
    loopId: loop.id,
    action: targetAction.id
  };
  const nextPolicyId = generatedPolicyId(nextPolicy);
  const existingPolicy = current.policies.find((policy) => policy.id === nextPolicyId);
  const nextLoops = current.loops.map((candidate) => candidate.id === loop.id
    ? {
      ...candidate,
      steps: candidate.steps.map((step, index) => index === handlerStepIndex ? nextPolicyId : step)
    }
    : candidate);
  const oldPolicyStillReferenced = nextLoops.some((candidate) => candidate.steps.includes(currentPolicy.id));
  const policies = (existingPolicy ? current.policies : [...current.policies, { ...nextPolicy, id: nextPolicyId }])
    .filter((policy) => policy.id !== currentPolicy.id || oldPolicyStillReferenced);
  const policyIdMap = new Map([[currentPolicy.id, nextPolicyId]]);
  const policyById = new Map(policies.map((policy) => [policy.id, policy]));
  const outputRouteByKey = new Map(current.outputRoutes.flatMap((route) => {
    const sourcePolicyId = policyIdMap.get(route.sourcePolicyId) ?? route.sourcePolicyId;
    const targetPolicyId = policyIdMap.get(route.target.policyId) ?? route.target.policyId;
    const sourcePolicy = policyById.get(sourcePolicyId);
    if (!sourcePolicy || !policyById.has(targetPolicyId)) return [];
    if (route.sourcePolicyId === currentPolicy.id) {
      if (!targetAction.outputIds.includes(route.outputId)) return [];
      if (projectOutputRouteCanTargetTrigger(sourcePolicy, route.outputId, current.actions)) return [];
    }
    const nextRoute = {
      ...route,
      sourcePolicyId,
      target: {
        ...route.target,
        policyId: targetPolicyId
      }
    };
    return [[projectOutputRouteKey(nextRoute.sourcePolicyId, nextRoute.outputId), nextRoute] as const];
  }));

  return {
    ...current,
    policies,
    loops: nextLoops,
    outputRoutes: [...outputRouteByKey.values()],
    humanGateResponses: current.humanGateResponses.filter((response) => response.policyId !== currentPolicy.id)
  };
};

export const nextConfigWithLoopStepActions = (
  current: ProjectAutomationConfig,
  loopId: string,
  stepIndexes: number[],
  actionId: string
): ProjectAutomationConfig => {
  const uniqueStepIndexes = [...new Set(stepIndexes)].sort((first, second) => first - second);

  if (uniqueStepIndexes.length === 0) return current;
  return uniqueStepIndexes.reduce(
    (nextConfig, stepIndex) => nextConfigWithLoopHandlerAction(nextConfig, loopId, stepIndex, actionId),
    current
  );
};

export const nextConfigWithoutLoopStepIndexes = (
  current: ProjectAutomationConfig,
  loopId: string,
  stepIndexes: number[]
): ProjectAutomationConfig => {
  const loop = current.loops.find((candidate) => candidate.id === loopId);
  const stepIndexSet = new Set(stepIndexes);
  if (!loop || stepIndexSet.size === 0) return current;
  const removedPolicyIds = new Set(loop.steps.filter((_, index) => stepIndexSet.has(index)));

  return {
    ...current,
    loops: current.loops.map((candidate) => candidate.id === loop.id
      ? {
        ...candidate,
        steps: candidate.steps.filter((_, index) => !stepIndexSet.has(index))
      }
      : candidate),
    humanGateResponses: current.humanGateResponses.filter((response) =>
      response.loopId !== loop.id || !removedPolicyIds.has(response.policyId)
    )
  };
};
