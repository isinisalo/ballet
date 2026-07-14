import { useEffect, useRef, useState } from "react";
import { Palette, Route } from "lucide-react";
import type { AgentExecutionState, AppData, ProjectAutomationConfig, ProjectAutomationIssue, ProjectLoop } from "@shared/api/workspace-contracts";
import { Panel } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import type { AutomationLoopView } from "../types";
import { automationLoopPath, automationThemePath } from "../routing";
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
  if (loopView === "all") return <AutomationOverview draft={draft} issues={issues} navigate={navigate} />;

  const updateLoop = (loop: ProjectLoop) => {
    if (operationRef.current) return;
    if (creating) setCreateDraft(loop);
    else if (selectedIndex >= 0) setDraft((config) => updateLoopAtIndex(config, selectedIndex, loop));
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
  const remove = async () => {
    if (selectedIndex < 0 || locked || operationRef.current) return;
    operationRef.current = true;
    try {
      const nextId = draft.loops.find((_, index) => index !== selectedIndex)?.id;
      if (!await saveDraft(removeLoopAtIndex(draft, selectedIndex))) return;
      navigate(automationLoopPath(nextId), { bypassBlocker: true });
    } finally {
      operationRef.current = false;
    }
  };

  return (
    <AutomationEditorWorkspace
      data={data}
      agentExecutionStates={agentExecutionStates}
      draft={draft}
      candidateConfig={candidateConfig}
      displayedLoop={displayedLoop}
      selectedLoop={selectedLoop}
      scheduleState={scheduleState}
      creating={creating}
      locked={locked}
      dirty={creating ? createDirty : isDirty}
      valid={valid}
      saving={saving}
      error={error}
      issues={issues}
      onSave={save}
      onRemove={remove}
      onChange={updateLoop}
    />
  );
}

function AutomationOverview({ draft, issues, navigate }: { draft: ProjectAutomationConfig; issues: ProjectAutomationIssue[]; navigate: WorkspaceNavigation["navigate"] }) {
  return (
    <Panel title="Automation" icon={<Route />} contentClassName="p-0" action={<div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => navigate(automationThemePath())}><Palette /> Edit theme</Button>
    </div>}>
      <AutomationIssueBanner issues={issues} />
      <AllLoopsCanvas config={draft} onAddLoop={() => navigate(automationLoopPath())} onOpenLoop={(id) => navigate(automationLoopPath(id))} />
    </Panel>
  );
}
