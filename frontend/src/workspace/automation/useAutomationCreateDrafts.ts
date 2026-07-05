import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Agent, ProjectAutomationConfig } from "../../../../shared/api/workspace-contracts";
import type { AutomationTab } from "../types";
import { editablePolicyToken } from "./automationUtils";

type SelectAutomationEntity = (tab: AutomationTab, id?: string) => void;

type AutomationCreateDrafts = {
  trigger: { id: string; description: string };
  action: { id: string; description: string; outputIds: string[]; agentIds: string[] };
  output: { id: string; description: string; type: "event" };
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
  const [newOutput, setNewOutput] = useState<{ id: string; description: string; type: "event" }>({ id: "", description: "", type: "event" });
  const [newWorkflow, setNewWorkflow] = useState({ id: "", title: "", steps: [] as string[] });
  const createDraftsRef = useRef<AutomationCreateDrafts>({
    trigger: newTrigger,
    action: newAction,
    output: newOutput,
    workflow: newWorkflow
  });

  const updateNewTrigger = (patch: Partial<typeof newTrigger>) => {
    setNewTrigger((current) => syncDraft(createDraftsRef, "trigger", { ...current, ...patch }));
  };
  const updateNewAction = (patch: Partial<typeof newAction>) => {
    setNewAction((current) => syncDraft(createDraftsRef, "action", { ...current, ...patch }));
  };
  const updateNewOutput = (patch: Partial<typeof newOutput>) => {
    setNewOutput((current) => syncDraft(createDraftsRef, "output", { ...current, ...patch }));
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
    if (!isCreateMode) return saveDraft();
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
    setNewOutput(resetDrafts.output);
    setNewWorkflow(resetDrafts.workflow);
    return true;
  };

  return {
    newTrigger,
    newAction,
    newOutput,
    newWorkflow,
    updateNewTrigger,
    updateNewAction,
    updateNewOutput,
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
  output: { id: "", description: "", type: "event" },
  workflow: { id: "", title: "", steps: [] }
});

const createDraftWithNewEntity = (
  activeTab: AutomationTab,
  draft: ProjectAutomationConfig,
  drafts: AutomationCreateDrafts
): { config: ProjectAutomationConfig; id: string } | undefined => {
  if (activeTab === "triggers") {
    const id = editablePolicyToken(drafts.trigger.id);
    if (!id || draft.triggers.some((trigger) => trigger.id === id)) return undefined;
    return { id, config: { ...draft, triggers: [...draft.triggers, { ...drafts.trigger, id }] } };
  }
  if (activeTab === "actions") {
    const id = editablePolicyToken(drafts.action.id);
    if (!id || draft.actions.some((action) => action.id === id)) return undefined;
    return { id, config: { ...draft, actions: [...draft.actions, { ...drafts.action, id }] } };
  }
  if (activeTab === "outputs") {
    const id = editablePolicyToken(drafts.output.id);
    if (!id || draft.outputs.some((output) => output.id === id)) return undefined;
    return { id, config: { ...draft, outputs: [...draft.outputs, { ...drafts.output, id }] } };
  }
  const id = editablePolicyToken(drafts.workflow.id);
  if (!id || draft.workflows.some((workflow) => workflow.id === id)) return undefined;
  return { id, config: { ...draft, workflows: [...draft.workflows, { ...drafts.workflow, id, title: drafts.workflow.title || id }] } };
};
