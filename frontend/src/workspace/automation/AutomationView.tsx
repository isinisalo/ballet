import { Plus, Route, Save } from "lucide-react";
import type { AppData, ProjectAutomationConfig } from "../../../../shared/api/workspace-contracts";
import { HeaderCrudActions, Panel } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import type { AutomationTab } from "../types";
import { ActionsAutomationTab } from "./actions/ActionsAutomationTab";
import { createAutomationEntityControls } from "./automationEntityControls";
import { AutomationIssues } from "./AutomationIssues";
import { OutputsAutomationTab } from "./outputs/OutputsAutomationTab";
import { TriggersAutomationTab } from "./triggers/TriggersAutomationTab";
import { useAutomationDraft } from "./useAutomationDraft";
import { useWorkflowHeaderNameEditor } from "./workflows/useWorkflowHeaderNameEditor";
import { WorkflowHeaderNameEditor } from "./workflows/WorkflowHeaderNameEditor";
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

  const {
    addConfig,
    deleteConfig,
    selectedActionId,
    selectedOutputId,
    selectedTriggerId,
    selectedWorkflowId,
    selectAutomationEntity
  } = createAutomationEntityControls({ activeTab, selectedId, draft, agents: data.agents, setDraft, navigate });
  const workflowNameEditor = useWorkflowHeaderNameEditor({
    activeTab,
    draft,
    setDraft,
    saveDraft,
    selectedWorkflowId,
    selectAutomationEntity
  });

  return (
    <div className="grid gap-4">
      <Panel
        title="Automation"
        titleExtra={activeTab === "workflows" ? (
          <WorkflowHeaderNameEditor {...workflowNameEditor.editorProps} />
        ) : null}
        icon={<Route data-icon="inline-start" />}
        action={(
          <div className="flex items-center justify-end gap-2">
            <Button type="button" size="icon-sm" variant="outline" aria-label={addConfig.label} title={addConfig.label} onClick={activeTab === "workflows" ? workflowNameEditor.beginCreate : addConfig.onAdd}>
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
          {activeTab === "outputs" ? (
            <OutputsAutomationTab config={draft} selectedId={selectedOutputId} onSelect={(id) => selectAutomationEntity("outputs", id)} updateConfig={updateConfig} />
          ) : null}
          {activeTab === "workflows" ? (
            <WorkflowsAutomationTab config={draft} selectedId={selectedWorkflowId} onSelect={(id) => selectAutomationEntity("workflows", id)} updateConfig={updateConfig} saveDraft={saveDraft} />
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
