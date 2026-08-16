import { useEffect, useRef, useState } from "react";
import { Palette, Route } from "lucide-react";
import type { AppData, ProjectAutomationConfig, ProjectAutomationIssue, ProjectLoop } from "@shared/api/workspace-contracts";
import { EditorActions, Panel } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AutomationLoopView } from "../types";
import { automationAllLoopsPath, automationLoopPath, automationThemePath } from "../routing";
import { AutomationEditorWorkspace, AutomationIssueBanner } from "./AutomationEditorWorkspace";
import { useAutomationDraft } from "./useAutomationDraft";
import { AllLoopsCanvas } from "./loops/AllLoopsCanvas";
import { createLoopDraft, removeLoopAtIndex, updateLoopAtIndex } from "./loops/loopEditorState";
import { automationDraftIssues } from "./loops/loopFormValidation";
import { isActiveLoopRun } from "./loops/loopRunState";
import { useWorkspaceNavigationBlocker, type WorkspaceNavigation } from "../useWorkspaceNavigation";

export function AutomationView({ data, selectedId, loopView, saveAutomation, navigate, setNavigationBlocker }: {
  data: AppData;
  selectedId?: string;
  loopView?: AutomationLoopView;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  const { draft, setDraft, saveDraft, isDirty, saving, error } = useAutomationDraft({ automation: data.automation, saveAutomation });
  const [createDraft, setCreateDraft] = useState<ProjectLoop>(createLoopDraft);
  const [localEditorValid, setLocalEditorValid] = useState(true);
  const operationRef = useRef(false);
  const savedIndex = data.automation.loops.findIndex((loop) => loop.id === selectedId);
  const selectedIndex = savedIndex >= 0 ? savedIndex : draft.loops.findIndex((loop) => loop.id === selectedId);
  const selectedLoop = selectedIndex >= 0 ? draft.loops[selectedIndex] : undefined;
  const creating = !selectedId && loopView !== "all";
  const displayedLoop = creating ? createDraft : selectedLoop;
  const createDirty = creating && JSON.stringify(createDraft) !== JSON.stringify(createLoopDraft());
  const candidateConfig = creating && displayedLoop ? { ...draft, loops: [...draft.loops, displayedLoop] } : draft;
  const draftIssues = automationDraftIssues(candidateConfig, data.executionProfiles, data.instructions, data.skills, data.runtime);
  const valid = draftIssues.length === 0 && localEditorValid;
  const issues = [...draftIssues, ...data.loopThemeIssues];
  useWorkspaceNavigationBlocker(setNavigationBlocker, isDirty || createDirty, "Discard unsaved Work Loop changes?");
  useEffect(() => {
    if (!creating) setCreateDraft(createLoopDraft());
    setLocalEditorValid(true);
  }, [creating, selectedId]);
  const lockedLoopIds = new Set(data.loopRuns.filter((run) => isActiveLoopRun(run)).map((run) => run.loopId));

  const updateLoop = (loop: ProjectLoop) => {
    if (operationRef.current) return;
    if (creating) {
      const next = updateLoopAtIndex(candidateConfig, candidateConfig.loops.length - 1, loop);
      setCreateDraft(next.loops.at(-1) ?? loop);
      setDraft((current) => ({ ...current, loopEdges: next.loopEdges }));
    } else if (selectedIndex >= 0) setDraft((config) => updateLoopAtIndex(config, selectedIndex, loop));
  };
  const updateConfig = (config: ProjectAutomationConfig) => {
    if (creating) setDraft((current) => ({ ...current, orchestrator: config.orchestrator, loopEdges: config.loopEdges }));
    else setDraft(config);
  };
  const save = async () => {
    if (!displayedLoop || !valid || operationRef.current || lockedLoopIds.has(displayedLoop.id)) return;
    operationRef.current = true;
    try {
      if (!await saveDraft(candidateConfig)) return;
      if (creating) setCreateDraft(createLoopDraft());
      navigate(automationLoopPath(displayedLoop.id), { bypassBlocker: true });
    } finally {
      operationRef.current = false;
    }
  };
  const removeLoop = async (loopId: string) => {
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

  if (loopView === "all") return (
    <AutomationOverview
      draft={draft}
      issues={issues}
      error={error}
      saving={saving}
      lockedLoopIds={lockedLoopIds}
      data={data}
      navigate={navigate}
      onDeleteLoop={removeLoop}
      onChange={setDraft}
      onSave={() => saveDraft()}
      dirty={isDirty}
      valid={draftIssues.length === 0}
    />
  );

  return <AutomationEditorWorkspace
    data={data}
    draft={candidateConfig}
    displayedLoop={displayedLoop}
    creating={creating}
    locked={Boolean(displayedLoop && lockedLoopIds.has(displayedLoop.id))}
    dirty={creating ? createDirty || isDirty : isDirty}
    valid={valid}
    saving={saving}
    error={error}
    issues={issues}
    onSave={save}
    onLoopChange={updateLoop}
    onConfigChange={updateConfig}
    onLocalValidityChange={setLocalEditorValid}
  />;
}

function AutomationOverview({ draft, data, issues, error, saving, dirty, valid, lockedLoopIds, navigate, onDeleteLoop, onChange, onSave }: {
  draft: ProjectAutomationConfig;
  data: AppData;
  issues: ProjectAutomationIssue[];
  error: string;
  saving: boolean;
  dirty: boolean;
  valid: boolean;
  lockedLoopIds: ReadonlySet<string>;
  navigate: WorkspaceNavigation["navigate"];
  onDeleteLoop: (loopId: string) => unknown | Promise<unknown>;
  onChange: (config: ProjectAutomationConfig) => void;
  onSave: () => Promise<boolean>;
}) {
  return (
    <Panel title="Automation" icon={<Route />} contentClassName="p-0" action={<div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => navigate(automationThemePath())}><Palette /> Edit theme</Button>
      <EditorActions saveLabel="Save automation" onSave={async () => { await onSave(); }} dirty={dirty} valid={valid} pending={saving} />
    </div>}>
      <AutomationIssueBanner issues={issues} />
      {error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <AllLoopsCanvas
        config={draft}
        disabled={saving}
        lockedLoopIds={lockedLoopIds}
        executionProfiles={data.executionProfiles}
        instructions={data.instructions}
        skills={data.skills}
        runtime={data.runtime}
        theme={data.loopTheme}
        onOrchestratorChange={(orchestrator) => onChange({ ...draft, orchestrator })}
        onAddLoop={() => navigate(automationLoopPath())}
        onOpenLoop={(id) => navigate(automationLoopPath(id))}
        onDeleteLoop={onDeleteLoop}
      />
    </Panel>
  );
}
