import { Plus, Route, Save } from "lucide-react";
import type { AppData, ProjectAutomationConfig } from "../../../../shared/api/workspace-contracts";
import { HeaderCrudActions, Panel } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { automationSectionPath } from "../routing";
import type { AutomationTab } from "../types";
import { uniqueAutomationId } from "./automationUtils";
import { ActionsAutomationTab } from "./actions/ActionsAutomationTab";
import { AutomationIssues } from "./AutomationIssues";
import { TriggersAutomationTab } from "./triggers/TriggersAutomationTab";
import { useAutomationDraft } from "./useAutomationDraft";
import { WorkflowsAutomationTab } from "./workflows/WorkflowsAutomationTab";

export function AutomationView({
  data,
  activeTab,
  selectedId,
  saveAutomation,
  navigate
}: {
  data: AppData;
  activeTab: AutomationTab;
  selectedId?: string;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  navigate: (path: string) => void;
}) {
  const { draft, setDraft, updateConfig, saveDraft } = useAutomationDraft({
    automation: data.automation,
    saveAutomation
  });

  const selectedTriggerId = activeTab === "triggers" ? selectedId ?? draft.triggers[0]?.id ?? "" : draft.triggers[0]?.id ?? "";
  const selectedActionId = activeTab === "actions" ? selectedId ?? draft.actions[0]?.id ?? "" : draft.actions[0]?.id ?? "";
  const selectedWorkflowId = activeTab === "workflows" ? selectedId ?? draft.workflows[0]?.id ?? "" : draft.workflows[0]?.id ?? "";
  const selectedTrigger = draft.triggers.find((trigger) => trigger.id === selectedTriggerId) ?? draft.triggers[0];
  const selectedAction = draft.actions.find((action) => action.id === selectedActionId) ?? draft.actions[0];
  const selectedWorkflow = draft.workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? draft.workflows[0];
  const selectAutomationEntity = (tab: AutomationTab, id?: string) => navigate(automationSectionPath(tab, id));

  const addTrigger = () => {
    const id = uniqueAutomationId("new-trigger", draft.triggers.map((trigger) => trigger.id));
    setDraft((current) => ({
      ...current,
      triggers: [...current.triggers, { id, description: "New trigger" }]
    }));
    selectAutomationEntity("triggers", id);
  };

  const addAction = () => {
    const id = uniqueAutomationId("new-action", draft.actions.map((action) => action.id));
    setDraft((current) => ({
      ...current,
      actions: [...current.actions, { id, description: "New action" }]
    }));
    selectAutomationEntity("actions", id);
  };

  const addWorkflow = () => {
    const id = uniqueAutomationId("new-workflow", draft.workflows.map((workflow) => workflow.id));
    setDraft((current) => ({
      ...current,
      workflows: [...current.workflows, { id, title: "New workflow", steps: [] }]
    }));
    selectAutomationEntity("workflows", id);
  };

  const removeSelectedTrigger = () => {
    if (!selectedTrigger) return;
    const nextId = draft.triggers.find((trigger) => trigger.id !== selectedTrigger.id)?.id;
    setDraft((current) => ({
      ...current,
      triggers: current.triggers.filter((trigger) => trigger.id !== selectedTrigger.id)
    }));
    selectAutomationEntity("triggers", nextId);
  };

  const removeSelectedAction = () => {
    if (!selectedAction) return;
    const nextId = draft.actions.find((action) => action.id !== selectedAction.id)?.id;
    setDraft((current) => ({
      ...current,
      actions: current.actions.filter((action) => action.id !== selectedAction.id)
    }));
    selectAutomationEntity("actions", nextId);
  };

  const removeSelectedWorkflow = () => {
    if (!selectedWorkflow) return;
    const nextId = draft.workflows.find((workflow) => workflow.id !== selectedWorkflow.id)?.id;
    setDraft((current) => ({
      ...current,
      workflows: current.workflows.filter((workflow) => workflow.id !== selectedWorkflow.id)
    }));
    selectAutomationEntity("workflows", nextId);
  };

  const addConfig = {
    triggers: {
      label: "Add trigger",
      onAdd: addTrigger
    },
    actions: {
      label: "Add action",
      onAdd: addAction
    },
    workflows: {
      label: "Add workflow",
      onAdd: addWorkflow
    }
  }[activeTab];

  const deleteConfig = {
    triggers: {
      label: "Delete trigger",
      type: "trigger",
      resourceName: selectedTrigger?.id,
      canDelete: Boolean(selectedTrigger),
      onDelete: removeSelectedTrigger
    },
    actions: {
      label: "Delete action",
      type: "action",
      resourceName: selectedAction?.id,
      canDelete: Boolean(selectedAction),
      onDelete: removeSelectedAction
    },
    workflows: {
      label: "Delete workflow",
      type: "workflow",
      resourceName: selectedWorkflow?.title || selectedWorkflow?.id,
      canDelete: Boolean(selectedWorkflow),
      onDelete: removeSelectedWorkflow
    }
  }[activeTab];

  return (
    <div className="grid gap-4">
      <Panel
        title="Automation"
        icon={<Route data-icon="inline-start" />}
        action={(
          <div className="flex items-center justify-end gap-2">
            <Button type="button" size="icon-sm" variant="outline" aria-label={addConfig.label} title={addConfig.label} onClick={addConfig.onAdd}>
              <Plus data-icon="inline-start" />
            </Button>
            <HeaderCrudActions
              saveAction={(
                <Button type="button" size="icon-sm" aria-label="Save automation" title="Save automation" onClick={() => void saveDraft()}>
                  <Save data-icon="inline-start" />
                </Button>
              )}
              deleteLabel={deleteConfig.label}
              deleteType={deleteConfig.type}
              resourceName={deleteConfig.resourceName}
              canDelete={deleteConfig.canDelete}
              onDelete={deleteConfig.onDelete}
            />
          </div>
        )}
      >
        <div className="grid gap-4">
          <AutomationIssues issues={data.automationIssues} />
          {activeTab === "triggers" ? (
            <TriggersAutomationTab config={draft} selectedId={selectedTriggerId} onSelect={(id) => selectAutomationEntity("triggers", id)} updateConfig={updateConfig} />
          ) : null}
          {activeTab === "actions" ? (
            <ActionsAutomationTab agents={data.agents} config={draft} selectedId={selectedActionId} onSelect={(id) => selectAutomationEntity("actions", id)} updateConfig={updateConfig} />
          ) : null}
          {activeTab === "workflows" ? (
            <WorkflowsAutomationTab data={data} config={draft} selectedId={selectedWorkflowId} onSelect={(id) => selectAutomationEntity("workflows", id)} updateConfig={updateConfig} saveDraft={saveDraft} />
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
