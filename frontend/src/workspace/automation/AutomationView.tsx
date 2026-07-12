import { useEffect, useState } from "react";
import { Plus, Route, Save } from "lucide-react";
import type { AgentExecutionState, AppData, ProjectAutomationConfig, ProjectAutomationIssue, ProjectLoop } from "@shared/api/workspace-contracts";
import { EmptyState, HeaderCrudActions, Panel } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import type { AutomationLoopView } from "../types";
import { automationLoopPath, automationThemePath } from "../routing";
import { AutomationIssues } from "./AutomationIssues";
import { useAutomationDraft } from "./useAutomationDraft";
import { AllLoopsCanvas } from "./loops/AllLoopsCanvas";
import { LoopCreationEditor, LoopEditor } from "./loops/LoopEditor";
import { createLoopDraft, removeLoopAtIndex, updateLoopAtIndex } from "./loops/loopEditorState";
import { isActiveLoopRun } from "./loops/loopRunState";
import { useWorkspaceNavigationBlocker, type WorkspaceNavigation } from "../useWorkspaceNavigation";

export function AutomationView({ data, agentExecutionStates, selectedId, loopView, saveAutomation, navigate, setNavigationBlocker }: {
  data: AppData;
  agentExecutionStates: AgentExecutionState[];
  selectedId?: string;
  loopView?: AutomationLoopView;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  const { draft, setDraft, saveDraft, isDirty } = useAutomationDraft({ automation: data.automation, saveAutomation });
  const [createDraft, setCreateDraft] = useState<ProjectLoop>(() => createLoopDraft(data.agents));
  const savedIndex = data.automation.loops.findIndex((loop) => loop.id === selectedId);
  const selectedIndex = savedIndex >= 0 ? savedIndex : -1;
  const selectedLoop = selectedIndex >= 0 ? draft.loops[selectedIndex] : undefined;
  const savedLoop = savedIndex >= 0 ? data.automation.loops[savedIndex] : undefined;
  const creating = !selectedId && loopView !== "all";
  const displayedLoop = creating ? createDraft : selectedLoop;
  const scheduleState = data.scheduleStates.find((state) => state.loopId === displayedLoop?.id && state.stepId === displayedLoop.start);
  const locked = isActiveLoopRun(data.loopRuns.find((run) => run.loopId === savedLoop?.id));
  const createDirty = creating && JSON.stringify(createDraft) !== JSON.stringify(createLoopDraft(data.agents));
  useWorkspaceNavigationBlocker(setNavigationBlocker, isDirty || createDirty, "Discard unsaved Loop changes?");

  useEffect(() => {
    if (creating && !createDraft.id && createDraft.steps.length === 1) setCreateDraft(createLoopDraft(data.agents));
  }, [creating, createDraft.id, createDraft.steps.length, data.agents]);

  const issues = [...data.automationIssues, ...data.loopThemeIssues];
  if (loopView === "all") return <AutomationOverview draft={draft} issues={issues} navigate={navigate} />;

  const updateLoop = (loop: ProjectLoop) => {
    if (creating) setCreateDraft(loop);
    else if (selectedIndex >= 0) setDraft((config) => updateLoopAtIndex(config, selectedIndex, loop));
  };
  const save = async () => {
    if (!displayedLoop || locked) return;
    if (creating) {
      const next = { ...draft, loops: [...draft.loops, displayedLoop] };
      await saveDraft(next);
      setCreateDraft(createLoopDraft(data.agents));
      navigate(automationLoopPath(displayedLoop.id), { bypassBlocker: true });
      return;
    }
    await saveDraft();
    navigate(automationLoopPath(displayedLoop.id), { bypassBlocker: true });
  };
  const remove = async () => {
    if (selectedIndex < 0 || locked) return;
    const nextId = draft.loops.find((_, index) => index !== selectedIndex)?.id;
    await saveDraft(removeLoopAtIndex(draft, selectedIndex));
    navigate(automationLoopPath(nextId), { bypassBlocker: true });
  };

  const editActions = (
    <HeaderCrudActions
      saveAction={<Button type="button" size="icon-sm" disabled={locked} aria-label="Save loop" onClick={() => void save().catch(() => undefined)}><Save /></Button>}
      deleteLabel="Delete loop"
      deleteType="loop"
      resourceName={selectedLoop?.id}
      canDelete={Boolean(selectedLoop) && !locked}
      onDelete={() => remove().catch(() => undefined)}
    />
  );

  return (
    <Panel title="Automation" titleExtra={displayedLoop?.id ? <span className="truncate text-muted-foreground">{displayedLoop.id}</span> : null} icon={<Route />} contentClassName="p-0" action={<div className="flex items-center gap-2">{creating ? editActions : null}</div>}>
      <AutomationIssueBanner issues={issues} />
      {!displayedLoop ? <div className="p-4"><EmptyState title="Loop not found." /></div> : null}
      {displayedLoop && creating ? <LoopCreationEditor loop={displayedLoop} loops={draft.loops} agents={data.agents} themes={data.loopThemes} onChange={updateLoop} /> : null}
      {displayedLoop && !creating ? <LoopEditor config={draft} loop={displayedLoop} loops={draft.loops} agents={data.agents} agentExecutionStates={agentExecutionStates} themes={data.loopThemes} scheduleState={scheduleState} locked={locked} canvasControls={editActions} onChange={updateLoop} /> : null}
    </Panel>
  );
}

function AutomationOverview({ draft, issues, navigate }: { draft: ProjectAutomationConfig; issues: ProjectAutomationIssue[]; navigate: WorkspaceNavigation["navigate"] }) {
  return (
    <Panel title="Automation" icon={<Route />} contentClassName="p-0" action={<Button size="sm" onClick={() => navigate(automationLoopPath())}><Plus /> Add loop</Button>}>
      <AutomationIssueBanner issues={issues} />
      <AllLoopsCanvas config={draft} onOpenLoop={(id) => navigate(automationLoopPath(id))} onEditTheme={(loopId, themeId) => navigate(automationThemePath(themeId, loopId))} />
    </Panel>
  );
}

function AutomationIssueBanner({ issues }: { issues: ProjectAutomationIssue[] }) {
  return issues.length ? <div className="border-b border-divider-strong p-4"><AutomationIssues issues={issues} /></div> : null;
}
