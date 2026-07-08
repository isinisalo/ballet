import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import { generatedPolicyId } from "@shared/policy-actions";

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
    action: targetAction.id
  };
  const nextPolicyId = generatedPolicyId(nextPolicy);
  const existingPolicy = current.policies.find((policy) => policy.id === nextPolicyId);
  const policies = existingPolicy ? current.policies : [...current.policies, { ...nextPolicy, id: nextPolicyId }];

  return {
    ...current,
    policies,
    loops: current.loops.map((candidate) => candidate.id === loop.id
      ? {
        ...candidate,
        steps: candidate.steps.map((step, index) => index === handlerStepIndex ? nextPolicyId : step)
      }
      : candidate)
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
