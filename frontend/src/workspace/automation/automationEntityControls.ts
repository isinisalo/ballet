import type { Dispatch, SetStateAction } from "react";
import type { Agent, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { defaultActionOutputIds } from "@shared/policy-actions";
import { automationSectionPath } from "../routing";
import type { AutomationTab } from "../types";
import { uniqueAutomationId } from "./automationUtils";

type DraftSetter = Dispatch<SetStateAction<ProjectAutomationConfig>>;

type ControlsInput = {
  activeTab: AutomationTab;
  selectedId?: string;
  draft: ProjectAutomationConfig;
  agents?: Agent[];
  setDraft: DraftSetter;
  navigate: (path: string) => void;
};

type SelectAutomationEntity = (tab: AutomationTab, id?: string) => void;

const selectedCollectionId = <T extends { id: string }>(isActive: boolean, selectedId: string | undefined, items: T[]) =>
  isActive && items.some((item) => item.id === selectedId) ? selectedId : undefined;

const selectedEntityIds = (activeTab: AutomationTab, selectedId: string | undefined, draft: ProjectAutomationConfig) => ({
  selectedActionId: selectedCollectionId(activeTab === "actions", selectedId, draft.actions),
  selectedLoopId: selectedCollectionId(activeTab === "loops", selectedId, draft.loops)
});

const addEntityConfig = (
  activeTab: AutomationTab,
  draft: ProjectAutomationConfig,
  agents: Agent[] | undefined,
  setDraft: DraftSetter,
  selectAutomationEntity: SelectAutomationEntity
) => {
  switch (activeTab) {
    case "actions":
      return {
        label: "Add action",
        onAdd: () => {
          const id = uniqueAutomationId("new-action", draft.actions.map((action) => action.id));
          setDraft((current) => {
            const availableOutputIds = current.outputs.map((output) => output.id);
            const outputIds = defaultActionOutputIds.filter((outputId) => availableOutputIds.includes(outputId));
            const selectedOutputIds = outputIds.length === defaultActionOutputIds.length ? outputIds : [...defaultActionOutputIds];
            const outputs = [...current.outputs];
            selectedOutputIds.forEach((outputId) => {
              if (!outputs.some((output) => output.id === outputId)) outputs.push({ id: outputId });
            });
            const agentId = agents?.[0]?.id;
            return {
              ...current,
              outputs,
              actions: [...current.actions, {
                id,
                description: "New action",
                outputIds: agentId ? selectedOutputIds : [],
                ...(agentId ? { agentId } : {})
              }]
            };
          });
          selectAutomationEntity("actions", id);
        }
      };
    case "loops":
      return {
        label: "Add loop",
        onAdd: () => {
          selectAutomationEntity("loops");
        }
      };
  }
};

const deleteEntityConfig = (
  input: ControlsInput,
  ids: ReturnType<typeof selectedEntityIds>,
  selectAutomationEntity: SelectAutomationEntity
) => {
  const { activeTab, draft, setDraft } = input;
  switch (activeTab) {
    case "actions": {
      const selected = draft.actions.find((action) => action.id === ids.selectedActionId);
      return {
        label: "Delete action",
        type: "action",
        resourceName: selected?.id,
        canDelete: Boolean(selected),
        onDelete: () => {
          if (!selected) return;
          const nextId = draft.actions.find((action) => action.id !== selected.id)?.id;
          setDraft((current) => ({
            ...current,
            actions: current.actions.filter((action) => action.id !== selected.id),
            outputRoutes: current.outputRoutes.filter((route) =>
              route.sourceActionId !== selected.id && route.targetActionId !== selected.id
            ),
            loops: current.loops.map((loop) => ({
              ...loop,
              steps: loop.steps.filter((step) => step !== selected.id)
            })),
            humanGateResponses: current.humanGateResponses.filter((response) => response.actionId !== selected.id)
          }));
          selectAutomationEntity("actions", nextId);
        }
      };
    }
    case "loops": {
      const selected = draft.loops.find((loop) => loop.id === ids.selectedLoopId);
      return {
        label: "Delete loop",
        type: "loop",
        resourceName: selected?.id,
        canDelete: Boolean(selected),
        onDelete: () => {
          if (!selected) return;
          const nextId = draft.loops.find((loop) => loop.id !== selected.id)?.id;
          setDraft((current) => ({
            ...current,
            loops: current.loops.filter((loop) => loop.id !== selected.id),
            outputRoutes: current.outputRoutes.filter((route) =>
              route.sourceLoopId !== selected.id && route.targetLoopId !== selected.id
            ),
            humanGateResponses: current.humanGateResponses.filter((response) => response.loopId !== selected.id)
          }));
          selectAutomationEntity("loops", nextId);
        }
      };
    }
  }
};

export const createAutomationEntityControls = (input: ControlsInput) => {
  const { activeTab, selectedId, draft, setDraft, navigate } = input;
  const ids = selectedEntityIds(activeTab, selectedId, draft);
  const selectAutomationEntity = (tab: AutomationTab, id?: string) => navigate(automationSectionPath(tab, id));

  return {
    addConfig: addEntityConfig(activeTab, draft, input.agents, setDraft, selectAutomationEntity),
    deleteConfig: deleteEntityConfig(input, ids, selectAutomationEntity),
    ...ids,
    selectAutomationEntity
  };
};
