import type { Dispatch, SetStateAction } from "react";
import type { ProjectAutomationConfig } from "../../../../shared/api/workspace-contracts";
import { automationSectionPath } from "../routing";
import type { AutomationTab } from "../types";
import { uniqueAutomationId } from "./automationUtils";

type DraftSetter = Dispatch<SetStateAction<ProjectAutomationConfig>>;

type ControlsInput = {
  activeTab: AutomationTab;
  selectedId?: string;
  draft: ProjectAutomationConfig;
  setDraft: DraftSetter;
  navigate: (path: string) => void;
};

type SelectAutomationEntity = (tab: AutomationTab, id?: string) => void;

const selectedCollectionId = <T extends { id: string }>(isActive: boolean, selectedId: string | undefined, items: T[]) =>
  isActive ? selectedId ?? items[0]?.id ?? "" : items[0]?.id ?? "";

const selectedEntityIds = (activeTab: AutomationTab, selectedId: string | undefined, draft: ProjectAutomationConfig) => ({
  selectedTriggerId: selectedCollectionId(activeTab === "triggers", selectedId, draft.triggers),
  selectedActionId: selectedCollectionId(activeTab === "actions", selectedId, draft.actions),
  selectedOutputId: selectedCollectionId(activeTab === "outputs", selectedId, draft.outputs),
  selectedWorkflowId: selectedCollectionId(activeTab === "workflows", selectedId, draft.workflows)
});

const addEntityConfig = (
  activeTab: AutomationTab,
  draft: ProjectAutomationConfig,
  setDraft: DraftSetter,
  selectAutomationEntity: SelectAutomationEntity
) => {
  switch (activeTab) {
    case "triggers":
      return {
        label: "Add trigger",
        onAdd: () => {
          const id = uniqueAutomationId("new-trigger", draft.triggers.map((trigger) => trigger.id));
          setDraft((current) => ({ ...current, triggers: [...current.triggers, { id, description: "New trigger" }] }));
          selectAutomationEntity("triggers", id);
        }
      };
    case "actions":
      return {
        label: "Add action",
        onAdd: () => {
          const id = uniqueAutomationId("new-action", draft.actions.map((action) => action.id));
          setDraft((current) => ({ ...current, actions: [...current.actions, { id, description: "New action" }] }));
          selectAutomationEntity("actions", id);
        }
      };
    case "outputs":
      return {
        label: "Add output",
        onAdd: () => {
          const id = uniqueAutomationId("new-output", draft.outputs.map((output) => output.id));
          setDraft((current) => ({ ...current, outputs: [...current.outputs, { id, description: "New output" }] }));
          selectAutomationEntity("outputs", id);
        }
      };
    case "workflows":
      return {
        label: "Add workflow",
        onAdd: () => {
          const id = uniqueAutomationId("new-workflow", draft.workflows.map((workflow) => workflow.id));
          setDraft((current) => ({ ...current, workflows: [...current.workflows, { id, title: "New workflow", steps: [] }] }));
          selectAutomationEntity("workflows", id);
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
    case "triggers": {
      const selected = draft.triggers.find((trigger) => trigger.id === ids.selectedTriggerId) ?? draft.triggers[0];
      return {
        label: "Delete trigger",
        type: "trigger",
        resourceName: selected?.id,
        canDelete: Boolean(selected),
        onDelete: () => {
          if (!selected) return;
          const nextId = draft.triggers.find((trigger) => trigger.id !== selected.id)?.id;
          setDraft((current) => ({ ...current, triggers: current.triggers.filter((trigger) => trigger.id !== selected.id) }));
          selectAutomationEntity("triggers", nextId);
        }
      };
    }
    case "actions": {
      const selected = draft.actions.find((action) => action.id === ids.selectedActionId) ?? draft.actions[0];
      return {
        label: "Delete action",
        type: "action",
        resourceName: selected?.id,
        canDelete: Boolean(selected),
        onDelete: () => {
          if (!selected) return;
          const nextId = draft.actions.find((action) => action.id !== selected.id)?.id;
          setDraft((current) => ({ ...current, actions: current.actions.filter((action) => action.id !== selected.id) }));
          selectAutomationEntity("actions", nextId);
        }
      };
    }
    case "outputs": {
      const selected = draft.outputs.find((output) => output.id === ids.selectedOutputId) ?? draft.outputs[0];
      return {
        label: "Delete output",
        type: "output",
        resourceName: selected?.id,
        canDelete: Boolean(selected),
        onDelete: () => {
          if (!selected) return;
          const nextId = draft.outputs.find((output) => output.id !== selected.id)?.id;
          setDraft((current) => ({ ...current, outputs: current.outputs.filter((output) => output.id !== selected.id) }));
          selectAutomationEntity("outputs", nextId);
        }
      };
    }
    case "workflows": {
      const selected = draft.workflows.find((workflow) => workflow.id === ids.selectedWorkflowId) ?? draft.workflows[0];
      return {
        label: "Delete workflow",
        type: "workflow",
        resourceName: selected?.title || selected?.id,
        canDelete: Boolean(selected),
        onDelete: () => {
          if (!selected) return;
          const nextId = draft.workflows.find((workflow) => workflow.id !== selected.id)?.id;
          setDraft((current) => ({ ...current, workflows: current.workflows.filter((workflow) => workflow.id !== selected.id) }));
          selectAutomationEntity("workflows", nextId);
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
    addConfig: addEntityConfig(activeTab, draft, setDraft, selectAutomationEntity),
    deleteConfig: deleteEntityConfig(input, ids, selectAutomationEntity),
    ...ids,
    selectAutomationEntity
  };
};
