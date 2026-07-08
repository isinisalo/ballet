import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Agent, ProjectAutomationConfig, ProjectPolicy, ProjectLoop } from "@shared/api/workspace-contracts";
import { automationFieldLimits, automationStringValidationMessage, automationTokenValidationMessage, normalizeAutomationToken } from "@shared/api/automationValidation";
import { defaultPolicyOutputIds, loopIdForPolicy } from "@shared/policy-actions";
import type { AutomationTab } from "../types";

type SelectAutomationEntity = (tab: AutomationTab, id?: string) => void;

type AutomationCreateDrafts = {
  action: { id: string; description: string; outputIds: string[]; agentIds: string[]; humanGate: boolean };
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
  const [newAction, setNewAction] = useState({ id: "", description: "", outputIds: [] as string[], agentIds: [] as string[], humanGate: false });
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
      outputIds: newAction.outputIds.length > 0 ? newAction.outputIds : defaultActionOutputIds(draft),
      agentIds: newAction.agentIds.length > 0 ? newAction.agentIds : agents.slice(0, 1).map((agent) => agent.id)
    });
  }, [agents, draft.outputs]);

  useEffect(() => {
    setNewLoop((current) => syncDraft(createDraftsRef, "loop", loopCreateDraftWithDefaultTrigger(draft, current)));
  }, [draft.policies, draft.loops]);

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
  action: { id: "", description: "", outputIds: defaultActionOutputIds(draft), agentIds: agents.slice(0, 1).map((agent) => agent.id), humanGate: false },
  loop: loopCreateDraftWithDefaultTrigger(draft, { id: "", steps: [] })
});

const loopStartingTriggerPolicy = (draft: ProjectAutomationConfig, loop: Pick<ProjectLoop, "steps">): ProjectPolicy | undefined => {
  const firstPolicyId = loop.steps[0] ?? "";
  return draft.policies.find((policy) => policy.id === firstPolicyId && policy.source === "trigger" && Boolean(policy.trigger));
};

const usedLoopTriggerPolicyIds = (draft: ProjectAutomationConfig): Set<string> => {
  const policyById = new Map(draft.policies.map((policy) => [policy.id, policy]));
  return new Set(draft.loops.flatMap((loop) => {
    const firstPolicy = policyById.get(loop.steps[0] ?? "");
    return firstPolicy?.source === "trigger" ? [firstPolicy.id] : [];
  }));
};

const firstUnusedTriggerPolicy = (draft: ProjectAutomationConfig): ProjectPolicy | undefined => {
  const usedPolicyIds = usedLoopTriggerPolicyIds(draft);
  return draft.policies.find((policy) =>
    policy.source === "trigger" &&
    Boolean(policy.trigger) &&
    !usedPolicyIds.has(policy.id)
  );
};

const loopCreateDraftWithDerivedId = (draft: ProjectAutomationConfig, loop: ProjectLoop): ProjectLoop => {
  const triggerPolicy = loopStartingTriggerPolicy(draft, loop);
  const id = loopIdForPolicy(triggerPolicy);
  return {
    ...loop,
    id,
    steps: triggerPolicy ? [triggerPolicy.id] : []
  };
};

const loopCreateDraftWithDefaultTrigger = (draft: ProjectAutomationConfig, loop: ProjectLoop): ProjectLoop => {
  const selectedPolicy = loopStartingTriggerPolicy(draft, loop);
  if (selectedPolicy && !usedLoopTriggerPolicyIds(draft).has(selectedPolicy.id)) {
    return loopCreateDraftWithDerivedId(draft, loop);
  }
  const triggerPolicy = firstUnusedTriggerPolicy(draft);
  return loopCreateDraftWithDerivedId(draft, {
    ...loop,
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
  const triggerPolicy = loopStartingTriggerPolicy(draft, drafts.loop);
  const id = loopIdForPolicy(triggerPolicy);
  if (!triggerPolicy || !id || draft.loops.some((loop) => loop.id === id)) return undefined;
  return { id, config: { ...draft, loops: [...draft.loops, { id, steps: [triggerPolicy.id] }] } };
};

const hasAutomationDraftFieldErrors = (activeTab: AutomationTab, draft: ProjectAutomationConfig): boolean => {
  if (activeTab === "actions") {
    return draft.actions.some((action) =>
      Boolean(automationTokenValidationMessage("Action ID", action.id)) ||
      Boolean(automationStringValidationMessage("Description", action.description, automationFieldLimits.description, { required: false }))
    );
  }
  const policyById = new Map(draft.policies.map((policy) => [policy.id, policy]));
  return draft.loops.some((loop) => {
    const startingPolicy = policyById.get(loop.steps[0] ?? "");
    return loop.id !== loopIdForPolicy(startingPolicy);
  });
};
