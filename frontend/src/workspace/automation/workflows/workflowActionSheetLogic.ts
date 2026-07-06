import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import { generatedPolicyId } from "@shared/policy-actions";

export const nextConfigWithWorkflowStepAction = (
  current: ProjectAutomationConfig,
  workflowId: string,
  stepIndex: number,
  actionId: string
): ProjectAutomationConfig => {
  const workflow = current.workflows.find((candidate) => candidate.id === workflowId);
  const stepPolicyId = workflow?.steps[stepIndex];
  const currentPolicy = stepPolicyId ? current.policies.find((policy) => policy.id === stepPolicyId) : undefined;
  const targetAction = current.actions.find((action) => action.id === actionId);

  if (!workflow || !currentPolicy || !targetAction || currentPolicy.action === actionId) return current;

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
        steps: candidate.steps.map((step, index) => index === stepIndex ? nextPolicyId : step)
      }
      : candidate)
  };
};
