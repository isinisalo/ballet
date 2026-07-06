import { useMemo } from "react";
import { Route, Save } from "lucide-react";
import type { AppData, ProjectAutomationConfig } from "../../../../shared/api/workspace-contracts";
import { HeaderCrudActions, Panel } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import type { AutomationTab } from "../types";
import { ActionsAutomationTab } from "./actions/ActionsAutomationTab";
import { createAutomationEntityControls } from "./automationEntityControls";
import { AutomationIssues } from "./AutomationIssues";
import { TriggersAutomationTab } from "./triggers/TriggersAutomationTab";
import { useAutomationDraft } from "./useAutomationDraft";
import { useAutomationCreateDrafts } from "./useAutomationCreateDrafts";
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
    deleteConfig,
    selectedActionId,
    selectedTriggerId,
    selectedWorkflowId,
    selectAutomationEntity
  } = createAutomationEntityControls({ activeTab, selectedId, draft, agents: data.agents, setDraft, navigate });
  const isCreateMode = useMemo(() => {
    if (activeTab === "triggers") return !selectedTriggerId;
    if (activeTab === "actions") return !selectedActionId;
    return !selectedWorkflowId;
  }, [activeTab, selectedActionId, selectedTriggerId, selectedWorkflowId]);
  const workflowNameEditor = useWorkflowHeaderNameEditor({
    activeTab,
    draft,
    setDraft,
    saveDraft,
    selectedWorkflowId,
    selectAutomationEntity
  });
  const createDrafts = useAutomationCreateDrafts({
    activeTab,
    agents: data.agents,
    draft,
    setDraft,
    saveDraft,
    selectAutomationEntity,
    isCreateMode
  });

  return (
    <div className="grid gap-4">
      <Panel
        title="Automation"
        titleExtra={activeTab === "workflows" && !isCreateMode ? (
          <WorkflowHeaderNameEditor {...workflowNameEditor.editorProps} />
        ) : null}
        icon={<Route data-icon="inline-start" />}
        action={(
          <div className="flex items-center justify-end gap-2">
            <HeaderCrudActions
              saveAction={(
                <Button type="button" size="icon-sm" aria-label="Save automation" title="Save automation" onClick={() => void createDrafts.saveAutomationFromHeader()}>
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
        contentClassName={activeTab === "workflows" ? "p-0" : undefined}
      >
        {activeTab === "workflows" ? (
          <>
            {data.automationIssues.length > 0 ? (
              <div className="px-4 py-4">
                <AutomationIssues issues={data.automationIssues} />
              </div>
            ) : null}
            <WorkflowsAutomationTab agents={data.agents} config={draft} selectedId={selectedWorkflowId} createDraft={createDrafts.newWorkflow} onCreateDraftChange={createDrafts.updateNewWorkflow} onSelect={(id) => selectAutomationEntity("workflows", id)} updateConfig={updateConfig} />
          </>
        ) : (
          <div className="grid gap-4">
            {data.automationIssues.length > 0 ? (
              <AutomationIssues issues={data.automationIssues} />
            ) : null}
            {activeTab === "triggers" ? (
              <TriggersAutomationTab config={draft} selectedId={selectedTriggerId} createDraft={createDrafts.newTrigger} onCreateDraftChange={createDrafts.updateNewTrigger} onSelect={(id) => selectAutomationEntity("triggers", id)} updateConfig={updateConfig} />
            ) : null}
            {activeTab === "actions" ? (
              <ActionsAutomationTab agents={data.agents} config={draft} selectedId={selectedActionId} createDraft={createDrafts.newAction} onCreateDraftChange={createDrafts.updateNewAction} onSelect={(id) => selectAutomationEntity("actions", id)} updateConfig={updateConfig} />
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
