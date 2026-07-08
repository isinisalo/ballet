import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Agent, ProjectAutomationConfig, ProjectPolicy, ProjectWorkflow } from "@shared/api/workspace-contracts";
import { automationFieldLimits, automationStringValidationMessage, automationTokenValidationMessage, normalizeAutomationToken } from "@shared/api/automationValidation";
import { defaultPolicyOutputIds, workflowIdForPolicy } from "@shared/policy-actions";
import type { AutomationTab } from "../types";

type SelectAutomationEntity = (tab: AutomationTab, id?: string) => void;

type AutomationCreateDrafts = {
  action: { id: string; description: string; outputIds: string[]; agentIds: string[]; humanGate: boolean };
  workflow: ProjectWorkflow;
};

export function useAutomationCreateDrafts({
  activeTab,
  agents,
  draft,
  setDraft,
  saveDraft,
  selectAutomationEntity,
  isCreateMode
}: {
  activeTab: AutomationTab;
  agents: Agent[];
  draft: ProjectAutomationConfig;
  setDraft: Dispatch<SetStateAction<ProjectAutomationConfig>>;
  saveDraft: (nextDraft?: ProjectAutomationConfig) => Promise<boolean>;
  selectAutomationEntity: SelectAutomationEntity;
  isCreateMode: boolean;
}) {
  const [newAction, setNewAction] = useState({ id: "", description: "", outputIds: [] as string[], agentIds: [] as string[], humanGate: false });
  const [newWorkflow, setNewWorkflow] = useState({ id: "", steps: [] as string[] });
  const createDraftsRef = useRef<AutomationCreateDrafts>({
    action: newAction,
    workflow: newWorkflow
  });

  const updateNewAction = (patch: Partial<typeof newAction>) => {
    setNewAction((current) => syncDraft(createDraftsRef, "action", { ...current, ...patch }));
  };
  const updateNewWorkflow = (patch: Partial<typeof newWorkflow>) => {
    setNewWorkflow((current) => syncDraft(createDraftsRef, "workflow", workflowCreateDraftWithDerivedId(draft, { ...current, ...patch })));
  };

  useEffect(() => {
    updateNewAction({
      outputIds: newAction.outputIds.length > 0 ? newAction.outputIds : defaultActionOutputIds(draft),
      agentIds: newAction.agentIds.length > 0 ? newAction.agentIds : agents.slice(0, 1).map((agent) => agent.id)
    });
  }, [agents, draft.outputs]);

  useEffect(() => {
    setNewWorkflow((current) => syncDraft(createDraftsRef, "workflow", workflowCreateDraftWithDefaultTrigger(draft, current)));
  }, [draft.policies, draft.workflows]);

  const saveAutomationFromHeader = async () => {
    if (!isCreateMode) {
      if (hasAutomationDraftFieldErrors(activeTab, draft)) return false;
      return saveDraft();
    }
    const nextDraft = createDraftWithNewEntity(activeTab, draft, createDraftsRef.current);
    if (!nextDraft) return false;
    setDraft(nextDraft.config);
    const saved = await saveDraft(nextDraft.config);
    if (!saved) return false;
    selectAutomationEntity(activeTab, nextDraft.id);
    const resetDrafts = createInitialDrafts(nextDraft.config, agents);
    createDraftsRef.current = resetDrafts;
    setNewAction(resetDrafts.action);
    setNewWorkflow(resetDrafts.workflow);
    return true;
  };

  return {
    newAction,
    newWorkflow,
    updateNewAction,
    updateNewWorkflow,
    saveAutomationFromHeader
  };
}

const syncDraft = <K extends keyof AutomationCreateDrafts>(
  ref: React.MutableRefObject<AutomationCreateDrafts>,
  key: K,
  next: AutomationCreateDrafts[K]
) => {
  ref.current = { ...ref.current, [key]: next };
  return next;
};

const createInitialDrafts = (draft: ProjectAutomationConfig, agents: Agent[]): AutomationCreateDrafts => ({
  action: { id: "", description: "", outputIds: defaultActionOutputIds(draft), agentIds: agents.slice(0, 1).map((agent) => agent.id), humanGate: false },
  workflow: workflowCreateDraftWithDefaultTrigger(draft, { id: "", steps: [] })
});

const workflowStartingTriggerPolicy = (draft: ProjectAutomationConfig, workflow: Pick<ProjectWorkflow, "steps">): ProjectPolicy | undefined => {
  const firstPolicyId = workflow.steps[0] ?? "";
  return draft.policies.find((policy) => policy.id === firstPolicyId && policy.source === "trigger" && Boolean(policy.trigger));
};

const usedWorkflowTriggerPolicyIds = (draft: ProjectAutomationConfig): Set<string> => {
  const policyById = new Map(draft.policies.map((policy) => [policy.id, policy]));
  return new Set(draft.workflows.flatMap((workflow) => {
    const firstPolicy = policyById.get(workflow.steps[0] ?? "");
    return firstPolicy?.source === "trigger" ? [firstPolicy.id] : [];
  }));
};

const firstUnusedTriggerPolicy = (draft: ProjectAutomationConfig): ProjectPolicy | undefined => {
  const usedPolicyIds = usedWorkflowTriggerPolicyIds(draft);
  return draft.policies.find((policy) =>
    policy.source === "trigger" &&
    Boolean(policy.trigger) &&
    !usedPolicyIds.has(policy.id)
  );
};

const workflowCreateDraftWithDerivedId = (draft: ProjectAutomationConfig, workflow: ProjectWorkflow): ProjectWorkflow => {
  const triggerPolicy = workflowStartingTriggerPolicy(draft, workflow);
  const id = workflowIdForPolicy(triggerPolicy);
  return {
    ...workflow,
    id,
    steps: triggerPolicy ? [triggerPolicy.id] : []
  };
};

const workflowCreateDraftWithDefaultTrigger = (draft: ProjectAutomationConfig, workflow: ProjectWorkflow): ProjectWorkflow => {
  const selectedPolicy = workflowStartingTriggerPolicy(draft, workflow);
  if (selectedPolicy && !usedWorkflowTriggerPolicyIds(draft).has(selectedPolicy.id)) {
    return workflowCreateDraftWithDerivedId(draft, workflow);
  }
  const triggerPolicy = firstUnusedTriggerPolicy(draft);
  return workflowCreateDraftWithDerivedId(draft, {
    ...workflow,
    steps: triggerPolicy ? [triggerPolicy.id] : []
  });
};

const defaultActionOutputIds = (draft: ProjectAutomationConfig): string[] => {
  const availableOutputIds = draft.outputs.map((output) => output.id);
  const defaultOutputIds = defaultPolicyOutputIds.filter((outputId) => availableOutputIds.includes(outputId));
  return defaultOutputIds.length === defaultPolicyOutputIds.length ? defaultOutputIds : [...defaultPolicyOutputIds];
};

const createDraftWithNewEntity = (
  activeTab: AutomationTab,
  draft: ProjectAutomationConfig,
  drafts: AutomationCreateDrafts
): { config: ProjectAutomationConfig; id: string } | undefined => {
  if (activeTab === "actions") {
    const id = normalizeAutomationToken(drafts.action.id);
    if (automationTokenValidationMessage("Action ID", id) || automationStringValidationMessage("Description", drafts.action.description, automationFieldLimits.description, { required: false }) || draft.actions.some((action) => action.id === id)) return undefined;
    const outputIds = drafts.action.agentIds.length > 0 || drafts.action.humanGate ? drafts.action.outputIds : [];
    const outputs = [...draft.outputs];
    outputIds.forEach((outputId) => {
      if (!outputs.some((output) => output.id === outputId)) outputs.push({ id: outputId });
    });
    return { id, config: { ...draft, outputs, actions: [...draft.actions, { ...drafts.action, id, outputIds, agentIds: drafts.action.humanGate ? [] : drafts.action.agentIds }] } };
  }
  const triggerPolicy = workflowStartingTriggerPolicy(draft, drafts.workflow);
  const id = workflowIdForPolicy(triggerPolicy);
  if (!triggerPolicy || !id || draft.workflows.some((workflow) => workflow.id === id)) return undefined;
  return { id, config: { ...draft, workflows: [...draft.workflows, { id, steps: [triggerPolicy.id] }] } };
};

const hasAutomationDraftFieldErrors = (activeTab: AutomationTab, draft: ProjectAutomationConfig): boolean => {
  if (activeTab === "actions") {
    return draft.actions.some((action) =>
      Boolean(automationTokenValidationMessage("Action ID", action.id)) ||
      Boolean(automationStringValidationMessage("Description", action.description, automationFieldLimits.description, { required: false }))
    );
  }
  const policyById = new Map(draft.policies.map((policy) => [policy.id, policy]));
  return draft.workflows.some((workflow) => {
    const startingPolicy = policyById.get(workflow.steps[0] ?? "");
    return workflow.id !== workflowIdForPolicy(startingPolicy);
  });
};
