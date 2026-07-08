import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Agent, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { automationFieldLimits, automationStringValidationMessage, automationTokenValidationMessage, normalizeAutomationToken } from "@shared/api/automationValidation";
import { defaultPolicyOutputIds } from "@shared/policy-actions";
import type { AutomationTab } from "../types";

type SelectAutomationEntity = (tab: AutomationTab, id?: string) => void;

type AutomationCreateDrafts = {
  action: { id: string; description: string; outputIds: string[]; agentIds: string[]; humanGate: boolean };
  workflow: { id: string; title: string; steps: string[] };
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
  const [newWorkflow, setNewWorkflow] = useState({ id: "", title: "", steps: [] as string[] });
  const createDraftsRef = useRef<AutomationCreateDrafts>({
    action: newAction,
    workflow: newWorkflow
  });

  const updateNewAction = (patch: Partial<typeof newAction>) => {
    setNewAction((current) => syncDraft(createDraftsRef, "action", { ...current, ...patch }));
  };
  const updateNewWorkflow = (patch: Partial<typeof newWorkflow>) => {
    setNewWorkflow((current) => syncDraft(createDraftsRef, "workflow", { ...current, ...patch }));
  };

  useEffect(() => {
    updateNewAction({
      outputIds: newAction.outputIds.length > 0 ? newAction.outputIds : defaultActionOutputIds(draft),
      agentIds: newAction.agentIds.length > 0 ? newAction.agentIds : agents.slice(0, 1).map((agent) => agent.id)
    });
  }, [agents, draft.outputs]);

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
    const resetDrafts = createInitialDrafts(draft, agents);
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
  workflow: { id: "", title: "", steps: [] }
});

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
  const id = normalizeAutomationToken(drafts.workflow.id);
  if (automationTokenValidationMessage("Workflow ID", id) || automationStringValidationMessage("Title", drafts.workflow.title, automationFieldLimits.name) || draft.workflows.some((workflow) => workflow.id === id)) return undefined;
  return { id, config: { ...draft, workflows: [...draft.workflows, { ...drafts.workflow, id, title: drafts.workflow.title.trim() }] } };
};

const hasAutomationDraftFieldErrors = (activeTab: AutomationTab, draft: ProjectAutomationConfig): boolean => {
  if (activeTab === "actions") {
    return draft.actions.some((action) =>
      Boolean(automationTokenValidationMessage("Action ID", action.id)) ||
      Boolean(automationStringValidationMessage("Description", action.description, automationFieldLimits.description, { required: false }))
    );
  }
  return draft.workflows.some((workflow) =>
    Boolean(automationTokenValidationMessage("Workflow ID", workflow.id)) ||
    Boolean(automationStringValidationMessage("Title", workflow.title, automationFieldLimits.name))
  );
};
