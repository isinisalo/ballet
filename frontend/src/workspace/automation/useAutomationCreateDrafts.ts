import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Agent, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { automationFieldLimits, automationStringValidationMessage, automationTokenValidationMessage, normalizeAutomationToken } from "@shared/api/automationValidation";
import type { AutomationTab } from "../types";

type SelectAutomationEntity = (tab: AutomationTab, id?: string) => void;

type AutomationCreateDrafts = {
  trigger: { id: string; description: string };
  action: { id: string; description: string; outputIds: string[]; agentIds: string[] };
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
  const [newTrigger, setNewTrigger] = useState({ id: "", description: "" });
  const [newAction, setNewAction] = useState({ id: "", description: "", outputIds: [] as string[], agentIds: [] as string[] });
  const [newWorkflow, setNewWorkflow] = useState({ id: "", title: "", steps: [] as string[] });
  const createDraftsRef = useRef<AutomationCreateDrafts>({
    trigger: newTrigger,
    action: newAction,
    workflow: newWorkflow
  });

  const updateNewTrigger = (patch: Partial<typeof newTrigger>) => {
    setNewTrigger((current) => syncDraft(createDraftsRef, "trigger", { ...current, ...patch }));
  };
  const updateNewAction = (patch: Partial<typeof newAction>) => {
    setNewAction((current) => syncDraft(createDraftsRef, "action", { ...current, ...patch }));
  };
  const updateNewWorkflow = (patch: Partial<typeof newWorkflow>) => {
    setNewWorkflow((current) => syncDraft(createDraftsRef, "workflow", { ...current, ...patch }));
  };

  useEffect(() => {
    updateNewAction({
      outputIds: newAction.outputIds.length > 0 ? newAction.outputIds : draft.outputs.slice(0, 1).map((output) => output.id),
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
    setNewTrigger(resetDrafts.trigger);
    setNewAction(resetDrafts.action);
    setNewWorkflow(resetDrafts.workflow);
    return true;
  };

  return {
    newTrigger,
    newAction,
    newWorkflow,
    updateNewTrigger,
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
  trigger: { id: "", description: "" },
  action: { id: "", description: "", outputIds: draft.outputs.slice(0, 1).map((output) => output.id), agentIds: agents.slice(0, 1).map((agent) => agent.id) },
  workflow: { id: "", title: "", steps: [] }
});

const createDraftWithNewEntity = (
  activeTab: AutomationTab,
  draft: ProjectAutomationConfig,
  drafts: AutomationCreateDrafts
): { config: ProjectAutomationConfig; id: string } | undefined => {
  if (activeTab === "triggers") {
    const id = normalizeAutomationToken(drafts.trigger.id);
    if (automationTokenValidationMessage("Trigger ID", id) || automationStringValidationMessage("Description", drafts.trigger.description, automationFieldLimits.description) || draft.triggers.some((trigger) => trigger.id === id)) return undefined;
    return { id, config: { ...draft, triggers: [...draft.triggers, { ...drafts.trigger, id }] } };
  }
  if (activeTab === "actions") {
    const id = normalizeAutomationToken(drafts.action.id);
    if (automationTokenValidationMessage("Action ID", id) || automationStringValidationMessage("Description", drafts.action.description, automationFieldLimits.description, { required: false }) || draft.actions.some((action) => action.id === id)) return undefined;
    return { id, config: { ...draft, actions: [...draft.actions, { ...drafts.action, id }] } };
  }
  const id = normalizeAutomationToken(drafts.workflow.id);
  if (automationTokenValidationMessage("Workflow ID", id) || automationStringValidationMessage("Title", drafts.workflow.title, automationFieldLimits.name) || draft.workflows.some((workflow) => workflow.id === id)) return undefined;
  return { id, config: { ...draft, workflows: [...draft.workflows, { ...drafts.workflow, id, title: drafts.workflow.title.trim() }] } };
};

const hasAutomationDraftFieldErrors = (activeTab: AutomationTab, draft: ProjectAutomationConfig): boolean => {
  if (activeTab === "triggers") {
    return draft.triggers.some((trigger) =>
      Boolean(automationTokenValidationMessage("Trigger ID", trigger.id)) ||
      Boolean(automationStringValidationMessage("Description", trigger.description, automationFieldLimits.description))
    );
  }
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
