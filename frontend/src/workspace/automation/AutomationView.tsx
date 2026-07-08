import { useMemo } from "react";
import { Route, Save } from "lucide-react";
import type { AppData, EventIntakeRequest, EventRecord, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { HeaderCrudActions, Panel } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import type { AutomationTab, AutomationLoopView } from "../types";
import { ActionsAutomationTab } from "./actions/ActionsAutomationTab";
import { createAutomationEntityControls } from "./automationEntityControls";
import { AutomationIssues } from "./AutomationIssues";
import { useAutomationDraft } from "./useAutomationDraft";
import { useAutomationCreateDrafts } from "./useAutomationCreateDrafts";
import { LoopsAutomationTab } from "./loops/LoopsAutomationTab";

export function AutomationView({
  data,
  activeTab,
  selectedId,
  loopView,
  saveAutomation,
  createEvent,
  navigate
}: {
  data: AppData;
  activeTab: AutomationTab;
  selectedId?: string;
  loopView?: AutomationLoopView;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  createEvent: (event: EventIntakeRequest) => Promise<EventRecord>;
  navigate: (path: string) => void;
}) {
  const { draft, setDraft, updateConfig, saveDraft } = useAutomationDraft({
    automation: data.automation,
    saveAutomation
  });
  const {
    deleteConfig,
    selectedActionId,
    selectedLoopId,
    selectAutomationEntity
  } = createAutomationEntityControls({ activeTab, selectedId, draft, agents: data.agents, setDraft, navigate });
  const showAllLoops = activeTab === "loops" && loopView === "all";
  const isCreateMode = useMemo(() => {
    if (activeTab === "actions") return !selectedActionId;
    return !showAllLoops && !selectedLoopId;
  }, [activeTab, selectedActionId, selectedLoopId, showAllLoops]);
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
        titleExtra={activeTab === "loops" && !isCreateMode && !showAllLoops ? (
          <span className="min-w-0 truncate rounded px-1 py-0.5 font-mono text-xs font-medium text-muted-foreground" title={selectedLoopId}>
            {selectedLoopId}
          </span>
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
        contentClassName={activeTab === "loops" ? "p-0" : undefined}
      >
        {activeTab === "loops" ? (
          <>
            {data.automationIssues.length > 0 ? (
              <div className="px-4 py-4">
                <AutomationIssues issues={data.automationIssues} />
              </div>
            ) : null}
            <LoopsAutomationTab agents={data.agents} projectId={data.projects[0]?.id ?? "project"} config={draft} selectedId={selectedLoopId} createDraft={createDrafts.newLoop} showAll={showAllLoops} onCreateDraftChange={createDrafts.updateNewLoop} onSelect={(id) => selectAutomationEntity("loops", id)} updateConfig={updateConfig} saveDraft={saveDraft} createEvent={createEvent} />
          </>
        ) : (
          <div className="grid gap-4">
            {data.automationIssues.length > 0 ? (
              <AutomationIssues issues={data.automationIssues} />
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
