import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import { generatedPolicyId } from "@shared/policy-actions";

export const nextConfigWithWorkflowStepAction = (
  current: ProjectAutomationConfig,
  workflowId: string,
  stepIndex: number,
  actionId: string
): ProjectAutomationConfig => nextConfigWithWorkflowStepActions(current, workflowId, [stepIndex], actionId);

export const nextConfigWithWorkflowStepActions = (
  current: ProjectAutomationConfig,
  workflowId: string,
  stepIndexes: number[],
  actionId: string
): ProjectAutomationConfig => {
  const workflow = current.workflows.find((candidate) => candidate.id === workflowId);
  const targetAction = current.actions.find((action) => action.id === actionId);
  const uniqueStepIndexes = [...new Set(stepIndexes)].sort((first, second) => first - second);

  if (!workflow || !targetAction || uniqueStepIndexes.length === 0) return current;

  const policyIdsByStepIndex = new Map<number, string>();
  let policies = current.policies;

  uniqueStepIndexes.forEach((stepIndex) => {
    const stepPolicyId = workflow.steps[stepIndex];
    const currentPolicy = stepPolicyId ? current.policies.find((policy) => policy.id === stepPolicyId) : undefined;
    if (!currentPolicy || currentPolicy.action === actionId) return;

    const nextPolicy: ProjectPolicy = {
      ...currentPolicy,
      action: targetAction.id
    };
    const nextPolicyId = generatedPolicyId(nextPolicy);
    const existingPolicy = policies.find((policy) => policy.id === nextPolicyId);
    if (!existingPolicy) policies = [...policies, { ...nextPolicy, id: nextPolicyId }];
    policyIdsByStepIndex.set(stepIndex, nextPolicyId);
  });

  if (policyIdsByStepIndex.size === 0) return current;

  return {
    ...current,
    policies,
    workflows: current.workflows.map((candidate) => candidate.id === workflow.id
      ? {
        ...candidate,
        steps: candidate.steps.map((step, index) => policyIdsByStepIndex.get(index) ?? step)
      }
      : candidate)
  };
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
