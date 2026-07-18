import { useEffect, useRef, useState } from "react";
import { Palette, Route } from "lucide-react";
import type { AgentExecutionState, AppData, ProjectAutomationConfig, ProjectAutomationIssue, ProjectLoop } from "@shared/api/workspace-contracts";
import { Panel } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AutomationLoopView } from "../types";
import { automationAllLoopsPath, automationLoopPath, automationThemePath } from "../routing";
import { AutomationEditorWorkspace, AutomationIssueBanner } from "./AutomationEditorWorkspace";
import { useAutomationDraft } from "./useAutomationDraft";
import { AllLoopsCanvas } from "./loops/AllLoopsCanvas";
import { createLoopDraft, removeLoopAtIndex, updateLoopAtIndex } from "./loops/loopEditorState";
import { automationDraftIsValid } from "./loops/loopFormValidation";
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
  const { draft, setDraft, saveDraft, isDirty, saving, error } = useAutomationDraft({ automation: data.automation, saveAutomation });
  const [createDraft, setCreateDraft] = useState<ProjectLoop>(createLoopDraft);
  const operationRef = useRef(false);
  const savedIndex = data.automation.loops.findIndex((loop) => loop.id === selectedId);
  const selectedIndex = savedIndex >= 0 ? savedIndex : -1;
  const selectedLoop = selectedIndex >= 0 ? draft.loops[selectedIndex] : undefined;
  const savedLoop = savedIndex >= 0 ? data.automation.loops[savedIndex] : undefined;
  const creating = !selectedId && loopView !== "all";
  const displayedLoop = creating ? createDraft : selectedLoop;
  const scheduleState = data.scheduleStates.find((state) => state.loopId === displayedLoop?.id && state.stepId === displayedLoop.start);
  const locked = isActiveLoopRun(data.loopRuns.find((run) => run.loopId === savedLoop?.id));
  const createDirty = creating && JSON.stringify(createDraft) !== JSON.stringify(createLoopDraft());
  const candidateConfig = creating && displayedLoop ? { ...draft, loops: [...draft.loops, displayedLoop] } : draft;
  const valid = Boolean(displayedLoop) && automationDraftIsValid(candidateConfig);
  useWorkspaceNavigationBlocker(setNavigationBlocker, isDirty || createDirty, "Discard unsaved Loop changes?");
  useEffect(() => {
    if (!creating) setCreateDraft(createLoopDraft());
  }, [creating]);

  const issues = [...data.automationIssues, ...data.loopThemeIssues];
  const lockedLoopIds = new Set(data.loopRuns.filter((run) => isActiveLoopRun(run)).map((run) => run.loopId));

  const updateLoop = (loop: ProjectLoop) => {
    if (operationRef.current) return;
    if (creating) setCreateDraft(loop);
    else if (selectedIndex >= 0) setDraft((config) => updateLoopAtIndex(config, selectedIndex, loop));
  };
  const updateLoopFromOverview = async (loop: ProjectLoop) => {
    if (operationRef.current) return;
    const index = draft.loops.findIndex((candidate) => candidate.id === loop.id);
    if (index < 0 || lockedLoopIds.has(loop.id)) return;
    operationRef.current = true;
    try {
      await saveDraft(updateLoopAtIndex(draft, index, loop));
    } finally {
      operationRef.current = false;
    }
  };
  const save = async () => {
    if (!displayedLoop || locked || operationRef.current) return;
    operationRef.current = true;
    try {
      if (creating) {
        const next = { ...draft, loops: [...draft.loops, displayedLoop] };
        if (!await saveDraft(next)) return;
        setCreateDraft(createLoopDraft());
        navigate(automationLoopPath(displayedLoop.id), { bypassBlocker: true });
        return;
      }
      if (!await saveDraft()) return;
      navigate(automationLoopPath(displayedLoop.id), { bypassBlocker: true });
    } finally {
      operationRef.current = false;
    }
  };
  const removeLoopFromOverview = async (loopId: string) => {
    if (operationRef.current || lockedLoopIds.has(loopId)) return;
    const index = draft.loops.findIndex((loop) => loop.id === loopId);
    if (index < 0) return;
    operationRef.current = true;
    try {
      if (!await saveDraft(removeLoopAtIndex(draft, index))) return;
      navigate(automationAllLoopsPath(), { bypassBlocker: true });
    } finally {
      operationRef.current = false;
    }
  };

  if (loopView === "all") return <AutomationOverview draft={draft} issues={issues} error={error} saving={saving} lockedLoopIds={lockedLoopIds} navigate={navigate} onChangeLoop={updateLoopFromOverview} onDeleteLoop={removeLoopFromOverview} />;

  return (
    <AutomationEditorWorkspace
      data={data}
      agentExecutionStates={agentExecutionStates}
      draft={draft}
      candidateConfig={candidateConfig}
      displayedLoop={displayedLoop}
      scheduleState={scheduleState}
      creating={creating}
      locked={locked}
      dirty={creating ? createDirty : isDirty}
      valid={valid}
      saving={saving}
      error={error}
      issues={issues}
      onSave={save}
      onChange={updateLoop}
    />
  );
}

function AutomationOverview({ draft, issues, error, saving, lockedLoopIds, navigate, onChangeLoop, onDeleteLoop }: {
  draft: ProjectAutomationConfig;
  issues: ProjectAutomationIssue[];
  error: string;
  saving: boolean;
  lockedLoopIds: ReadonlySet<string>;
  navigate: WorkspaceNavigation["navigate"];
  onChangeLoop: (loop: ProjectLoop) => unknown | Promise<unknown>;
  onDeleteLoop: (loopId: string) => unknown | Promise<unknown>;
}) {
  return (
    <Panel title="Automation" icon={<Route />} contentClassName="p-0" action={<div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => navigate(automationThemePath())}><Palette /> Edit theme</Button>
    </div>}>
      <AutomationIssueBanner issues={issues} />
      {error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <AllLoopsCanvas
        config={draft}
        disabled={saving}
        lockedLoopIds={lockedLoopIds}
        onAddLoop={() => navigate(automationLoopPath())}
        onOpenLoop={(id) => navigate(automationLoopPath(id))}
        onChangeLoop={onChangeLoop}
        onDeleteLoop={onDeleteLoop}
      />
    </Panel>
  );
}
