import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import { generatedPolicyId } from "@shared/policy-actions";

export const nextConfigWithWorkflowStepAction = (
  current: ProjectAutomationConfig,
  workflowId: string,
  stepIndex: number,
  actionId: string
): ProjectAutomationConfig => nextConfigWithWorkflowHandlerAction(current, workflowId, stepIndex, actionId);

export const nextConfigWithWorkflowHandlerAction = (
  current: ProjectAutomationConfig,
  workflowId: string,
  handlerStepIndex: number,
  actionId: string
): ProjectAutomationConfig => {
  const workflow = current.workflows.find((candidate) => candidate.id === workflowId);
  const targetAction = current.actions.find((action) => action.id === actionId);

  if (!workflow || !targetAction || handlerStepIndex < 0 || handlerStepIndex >= workflow.steps.length) return current;

  const stepPolicyId = workflow.steps[handlerStepIndex];
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
    workflows: current.workflows.map((candidate) => candidate.id === workflow.id
      ? {
        ...candidate,
        steps: candidate.steps.map((step, index) => index === handlerStepIndex ? nextPolicyId : step)
      }
      : candidate)
  };
};

export const nextConfigWithWorkflowStepActions = (
  current: ProjectAutomationConfig,
  workflowId: string,
  stepIndexes: number[],
  actionId: string
): ProjectAutomationConfig => {
  const uniqueStepIndexes = [...new Set(stepIndexes)].sort((first, second) => first - second);

  if (uniqueStepIndexes.length === 0) return current;
  return uniqueStepIndexes.reduce(
    (nextConfig, stepIndex) => nextConfigWithWorkflowHandlerAction(nextConfig, workflowId, stepIndex, actionId),
    current
  );
};

export const nextConfigWithoutWorkflowStepIndexes = (
  current: ProjectAutomationConfig,
  workflowId: string,
  stepIndexes: number[]
): ProjectAutomationConfig => {
  const workflow = current.workflows.find((candidate) => candidate.id === workflowId);
  const stepIndexSet = new Set(stepIndexes);
  if (!workflow || stepIndexSet.size === 0) return current;

  return {
    ...current,
    workflows: current.workflows.map((candidate) => candidate.id === workflow.id
      ? {
        ...candidate,
        steps: candidate.steps.filter((_, index) => !stepIndexSet.has(index))
      }
      : candidate)
  };
};
