import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Agent, ProjectAutomationConfig, ProjectAction, ProjectLoop } from "@shared/api/workspace-contracts";
import { automationFieldLimits, automationLoopIdValidationMessage, automationStringValidationMessage, normalizeAutomationLoopId, normalizeAutomationToken } from "@shared/api/automationValidation";
import { defaultActionOutputIds } from "@shared/policy-actions";
import type { AutomationTab } from "../types";

type SelectAutomationEntity = (tab: AutomationTab, id?: string) => void;

type AutomationCreateDrafts = {
  action: ProjectAction;
  loop: ProjectLoop;
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
  const [newAction, setNewAction] = useState<ProjectAction>({
    id: "",
    description: "",
    outputIds: [],
    agentIds: [],
    humanGate: false
  });
  const [newLoop, setNewLoop] = useState({ id: "", steps: [] as string[] });
  const createDraftsRef = useRef<AutomationCreateDrafts>({
    action: newAction,
    loop: newLoop
  });

  const updateNewAction = (patch: Partial<typeof newAction>) => {
    setNewAction((current) => syncDraft(createDraftsRef, "action", { ...current, ...patch }));
  };
  const updateNewLoop = (patch: Partial<typeof newLoop>) => {
    setNewLoop((current) => syncDraft(createDraftsRef, "loop", loopCreateDraftWithDerivedId(draft, { ...current, ...patch })));
  };

  useEffect(() => {
    updateNewAction({
      outputIds: newAction.outputIds.length > 0 ? newAction.outputIds : defaultOutputIdsForDraft(draft),
      agentIds: newAction.agentIds.length > 0 ? newAction.agentIds : agents.slice(0, 1).map((agent) => agent.id)
    });
  }, [agents, draft.outputs]);

  useEffect(() => {
    setNewLoop((current) => syncDraft(createDraftsRef, "loop", loopCreateDraftWithDefaultEvent(draft, current)));
  }, [draft.actions, draft.loops]);

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
    setNewLoop(resetDrafts.loop);
    return true;
  };

  return {
    newAction,
    newLoop,
    updateNewAction,
    updateNewLoop,
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
  action: {
    id: "",
    description: "",
    outputIds: defaultOutputIdsForDraft(draft),
    agentIds: agents.slice(0, 1).map((agent) => agent.id),
    humanGate: false
  },
  loop: loopCreateDraftWithDefaultEvent(draft, { id: "", steps: [] })
});

const loopStartingAction = (draft: ProjectAutomationConfig, loop: Pick<ProjectLoop, "steps">): ProjectAction | undefined => {
  const firstActionId = loop.steps[0] ?? "";
  return draft.actions.find((action) => action.id === firstActionId);
};

const firstUnusedEventAction = (draft: ProjectAutomationConfig): ProjectAction | undefined => {
  return draft.actions[0];
};

const loopCreateDraftWithDerivedId = (draft: ProjectAutomationConfig, loop: ProjectLoop): ProjectLoop => {
  const eventAction = loopStartingAction(draft, loop);
  const id = normalizeAutomationLoopId(loop.id);
  return {
    ...loop,
    id,
    steps: eventAction ? [eventAction.id] : []
  };
};

const loopCreateDraftWithDefaultEvent = (draft: ProjectAutomationConfig, loop: ProjectLoop): ProjectLoop => {
  const selectedAction = loopStartingAction(draft, loop);
  if (selectedAction) {
    return loopCreateDraftWithDerivedId(draft, loop);
  }
  const eventAction = firstUnusedEventAction(draft);
  return loopCreateDraftWithDerivedId(draft, {
    ...loop,
    id: "",
    steps: eventAction ? [eventAction.id] : []
  });
};

const defaultOutputIdsForDraft = (draft: ProjectAutomationConfig): string[] => {
  const availableOutputIds = draft.outputs.map((output) => output.id);
  const defaultOutputIds = defaultActionOutputIds.filter((outputId) => availableOutputIds.includes(outputId));
  return defaultOutputIds.length === defaultActionOutputIds.length ? defaultOutputIds : [...defaultActionOutputIds];
};

const createDraftWithNewEntity = (
  activeTab: AutomationTab,
  draft: ProjectAutomationConfig,
  drafts: AutomationCreateDrafts
): { config: ProjectAutomationConfig; id: string } | undefined => {
  if (activeTab === "actions") {
    const id = normalizeAutomationToken(drafts.action.id);
    if (
      automationStringValidationMessage("Action ID", id, automationFieldLimits.policyId) ||
      automationStringValidationMessage("Description", drafts.action.description, automationFieldLimits.description, { required: false }) ||
      draft.actions.some((action) => action.id === id)
    ) return undefined;
    const agentIds = drafts.action.humanGate ? [] : drafts.action.agentIds.slice(0, 1);
    const outputIds = agentIds.length > 0 || drafts.action.humanGate ? drafts.action.outputIds : [];
    const outputs = [...draft.outputs];
    outputIds.forEach((outputId) => {
      if (!outputs.some((output) => output.id === outputId)) outputs.push({ id: outputId });
    });
    return { id, config: { ...draft, outputs, actions: [...draft.actions, { ...drafts.action, id, outputIds, agentIds }] } };
  }
  const eventAction = loopStartingAction(draft, drafts.loop);
  const id = normalizeAutomationLoopId(drafts.loop.id);
  if (!eventAction || !id || automationLoopIdValidationMessage("Loop", id) || draft.loops.some((loop) => loop.id === id)) return undefined;
  return { id, config: { ...draft, loops: [...draft.loops, { id, steps: [eventAction.id] }] } };
};

const hasAutomationDraftFieldErrors = (activeTab: AutomationTab, draft: ProjectAutomationConfig): boolean => {
  if (activeTab === "actions") {
    return draft.actions.some((action) =>
      Boolean(automationStringValidationMessage("Action ID", action.id, automationFieldLimits.policyId)) ||
      Boolean(automationStringValidationMessage("Description", action.description, automationFieldLimits.description, { required: false }))
    );
  }
  return false;
};
