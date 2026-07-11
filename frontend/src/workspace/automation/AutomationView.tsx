import { useEffect, useState } from "react";
import { Plus, Route, Save } from "lucide-react";
import type { AgentExecutionState, AppData, ProjectAutomationConfig, ProjectLoop } from "@shared/api/workspace-contracts";
import { EmptyState, HeaderCrudActions, Panel } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import type { AutomationLoopView } from "../types";
import { automationLoopPath } from "../routing";
import { AutomationIssues } from "./AutomationIssues";
import { useAutomationDraft } from "./useAutomationDraft";
import { AllLoopsCanvas } from "./loops/AllLoopsCanvas";
import { LoopCreationEditor, LoopEditor } from "./loops/LoopEditor";
import { createLoopDraft, removeLoopAtIndex, updateLoopAtIndex } from "./loops/loopEditorState";
import { isActiveLoopRun } from "./loops/loopRunState";
import { useLoopRun } from "./loops/useLoopRun";
import type { RuntimeStreamStatus } from "@/app/useRuntimeStream";

export function AutomationView({ data, agentExecutionStates, selectedId, loopView, runtimeStreamStatus, saveAutomation, navigate }: {
  data: AppData;
  agentExecutionStates: AgentExecutionState[];
  selectedId?: string;
  loopView?: AutomationLoopView;
  runtimeStreamStatus: RuntimeStreamStatus;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  navigate: (path: string) => void;
}) {
  const { draft, setDraft, saveDraft } = useAutomationDraft({ automation: data.automation, saveAutomation });
  const [createDraft, setCreateDraft] = useState<ProjectLoop>(() => createLoopDraft(data.agents));
  const savedIndex = data.automation.loops.findIndex((loop) => loop.id === selectedId);
  const selectedIndex = savedIndex >= 0 ? savedIndex : -1;
  const selectedLoop = selectedIndex >= 0 ? draft.loops[selectedIndex] : undefined;
  const savedLoop = savedIndex >= 0 ? data.automation.loops[savedIndex] : undefined;
  const creating = !selectedId && loopView !== "all";
  const displayedLoop = creating ? createDraft : selectedLoop;
  const loopRunRefreshSignal = JSON.stringify(data.loopRuns.find((run) => run.loopId === savedLoop?.id) ?? null);
  const runController = useLoopRun(savedLoop?.id, loopRunRefreshSignal, runtimeStreamStatus);
  const checkingRun = Boolean(savedLoop) && runController.pendingOperation === "load";
  const locked = checkingRun || isActiveLoopRun(runController.details);

  useEffect(() => {
    if (creating && !createDraft.id && createDraft.steps.length === 1) setCreateDraft(createLoopDraft(data.agents));
  }, [creating, createDraft.id, createDraft.steps.length, data.agents]);

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
      navigate(automationLoopPath(displayedLoop.id));
      return;
    }
    await saveDraft();
    navigate(automationLoopPath(displayedLoop.id));
  };
  const remove = async () => {
    if (selectedIndex < 0 || locked) return;
    const nextId = draft.loops.find((_, index) => index !== selectedIndex)?.id;
    await saveDraft(removeLoopAtIndex(draft, selectedIndex));
    navigate(automationLoopPath(nextId));
  };

  const editActions = loopView !== "all" ? (
    <HeaderCrudActions
      saveAction={<Button type="button" size="icon-sm" disabled={locked} aria-label="Save loop" onClick={() => void save().catch(() => undefined)}><Save /></Button>}
      deleteLabel="Delete loop"
      deleteType="loop"
      resourceName={selectedLoop?.id}
      canDelete={Boolean(selectedLoop) && !locked}
      onDelete={() => remove().catch(() => undefined)}
    />
  ) : null;

  return (
    <Panel title="Automation" titleExtra={displayedLoop?.id ? <span className="truncate text-muted-foreground">{displayedLoop.id}</span> : null} icon={<Route />} contentClassName="p-0" action={<div className="flex items-center gap-2">{creating ? editActions : null}{loopView === "all" ? <Button size="sm" onClick={() => navigate(automationLoopPath())}><Plus /> Add loop</Button> : null}</div>}>
      {data.automationIssues.length > 0 ? <div className="border-b border-divider-strong p-4"><AutomationIssues issues={data.automationIssues} /></div> : null}
      {loopView === "all" ? <AllLoopsCanvas config={draft} onSelect={(id) => navigate(automationLoopPath(id))} /> : null}
      {loopView !== "all" && !displayedLoop ? <div className="p-4"><EmptyState title="Loop not found." /></div> : null}
      {loopView !== "all" && displayedLoop && creating ? <LoopCreationEditor loop={displayedLoop} loops={draft.loops} agents={data.agents} onChange={updateLoop} /> : null}
      {loopView !== "all" && displayedLoop && !creating ? <LoopEditor config={draft} loop={displayedLoop} loops={draft.loops} agents={data.agents} agentExecutionStates={agentExecutionStates} locked={locked} lockMessage={checkingRun ? "Checking for an active run before enabling edits…" : undefined} canvasControls={editActions} onChange={updateLoop} /> : null}
    </Panel>
  );
}
