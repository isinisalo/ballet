import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Library, Palette } from "lucide-react";
import type { AppData, InstalledLoopModuleStatus, ProjectAutomationConfig, ProjectAutomationIssue, ProjectLoop } from "@shared/api/workspace-contracts";
import { EditorActions, EmptyState } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { LoopEngineerLevel } from "../types";
import { automationCompositionPath, automationCreateLoopPath, automationLoopPath, automationThemePath } from "../routing";
import { useWorkspaceNavigationBlocker, type WorkspaceNavigation } from "../useWorkspaceNavigation";
import { LoopEngineerShell } from "./LoopEngineerShell";
import { AutomationIssues } from "./AutomationIssues";
import { useAutomationDraft } from "./useAutomationDraft";
import { LoopCompositionWorkspace } from "./loops/LoopCompositionWorkspace";
import { LoopContextCanvas } from "./loops/LoopContextCanvas";
import { LoopEditor } from "./loops/LoopEditor";
import { LoopLibraryDialog, type LoopModuleActions } from "./loops/LoopLibraryDialog";
import { buildLoopCompositionProjection, buildLoopContextProjection, buildLoopDetailProjection } from "./loops/loopEngineerProjections";
import { createLoopDraft, removeLoopAtIndex, updateLoopAtIndex } from "./loops/loopEditorState";
import { automationDraftIssues } from "./loops/loopFormValidation";
import { isActiveLoopRun } from "./loops/loopRunState";

export function AutomationView({
  data,
  selectedId,
  level,
  creating = false,
  saveAutomation,
  refreshWorkspace,
  loopModules,
  navigate,
  setNavigationBlocker
}: {
  data: AppData;
  selectedId?: string;
  level: LoopEngineerLevel;
  creating?: boolean;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  refreshWorkspace?: () => Promise<void>;
  loopModules?: LoopModuleActions;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  const { draft, setDraft, saveDraft, isDirty, saving, error } = useAutomationDraft({ automation: data.automation, saveAutomation });
  const [createDraft, setCreateDraft] = useState<ProjectLoop>(createLoopDraft);
  const [localEditorValid, setLocalEditorValid] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [moduleStatuses, setModuleStatuses] = useState<InstalledLoopModuleStatus[]>([]);
  const [moduleError, setModuleError] = useState("");
  const operationRef = useRef(false);
  const isCreatingDetail = level === "detail" && creating;
  const savedIndex = data.automation.loops.findIndex((loop) => loop.id === selectedId);
  const selectedIndex = savedIndex >= 0 ? savedIndex : draft.loops.findIndex((loop) => loop.id === selectedId);
  const selectedLoop = selectedIndex >= 0 ? draft.loops[selectedIndex] : undefined;
  const displayedLoop = isCreatingDetail ? createDraft : selectedLoop;
  const createDirty = isCreatingDetail && JSON.stringify(createDraft) !== JSON.stringify(createLoopDraft());
  const candidateConfig = isCreatingDetail ? { ...draft, loops: [...draft.loops, createDraft] } : draft;
  const draftIssues = automationDraftIssues(candidateConfig, data.executionProfiles, data.instructions, data.skills, data.runtime);
  const valid = draftIssues.length === 0 && localEditorValid;
  const issues = [...draftIssues, ...data.loopThemeIssues];
  const lockedLoopIds = new Set(data.loopRuns.filter((run) => isActiveLoopRun(run)).map((run) => run.loopId));
  const selectedModule = moduleStatuses.find((module) => module.loopId === displayedLoop?.id);

  useWorkspaceNavigationBlocker(setNavigationBlocker, isDirty || createDirty, "Discard unsaved Work Loop changes?");
  useEffect(() => {
    if (!isCreatingDetail) setCreateDraft(createLoopDraft());
    setLocalEditorValid(true);
  }, [isCreatingDetail, selectedId]);

  const loadStatuses = async () => {
    if (!loopModules) return;
    try {
      setModuleStatuses(await loopModules.statuses());
      setModuleError("");
    } catch (reason) {
      setModuleError(reason instanceof Error ? reason.message : "Unable to load Loop module status.");
    }
  };
  useEffect(() => { void loadStatuses(); }, [loopModules]);

  const updateLoop = (loop: ProjectLoop) => {
    if (operationRef.current) return;
    if (isCreatingDetail) {
      const next = updateLoopAtIndex(candidateConfig, candidateConfig.loops.length - 1, loop);
      setCreateDraft(next.loops.at(-1) ?? loop);
    } else if (selectedIndex >= 0) {
      setDraft((config) => updateLoopAtIndex(config, selectedIndex, loop));
    }
  };
  const saveDetail = async () => {
    if (!displayedLoop || !valid || operationRef.current || lockedLoopIds.has(displayedLoop.id)) return;
    operationRef.current = true;
    try {
      if (!await saveDraft(candidateConfig)) return;
      if (isCreatingDetail) setCreateDraft(createLoopDraft());
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
      navigate(automationCompositionPath(), { bypassBlocker: true });
    } finally {
      operationRef.current = false;
    }
  };
  const exportLoop = async (loopId: string) => {
    if (!loopModules) return;
    try {
      const result = await loopModules.exportLoop({ loopId });
      downloadJson(result.canonicalJson, result.filename);
      setModuleError("");
    } catch (reason) {
      setModuleError(reason instanceof Error ? reason.message : "Unable to export Loop module.");
    }
  };
  const removeInstalled = async (loopId: string) => {
    if (!loopModules) return;
    try {
      await loopModules.remove(loopId);
      await loadStatuses();
      navigate(automationCompositionPath(), { bypassBlocker: true });
    } catch (reason) {
      setModuleError(reason instanceof Error ? reason.message : "Unable to remove installed Loop.");
    }
  };
  const openLibraryOrCreate = () => loopModules ? setLibraryOpen(true) : navigate(automationCreateLoopPath());
  const notices = <><AutomationIssueBanner issues={issues} />{error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{error}</AlertDescription></Alert> : null}{moduleError ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{moduleError}</AlertDescription></Alert> : null}</>;

  let actions: ReactNode;
  let content: ReactNode;
  if (level === "context") {
    const projection = buildLoopContextProjection({ project: data.project, config: draft, installedModules: moduleStatuses, activeLoopIds: lockedLoopIds });
    actions = <Button type="button" size="sm" onClick={() => draft.loops.length ? navigate(automationCompositionPath()) : openLibraryOrCreate()}>{draft.loops.length ? "Open Level 1" : "Add first Loop"}</Button>;
    content = <>{notices}<div className="p-4"><LoopContextCanvas projection={projection} /></div></>;
  } else if (level === "composition") {
    const projection = buildLoopCompositionProjection({ config: draft, installedModules: moduleStatuses, lockedLoopIds });
    actions = <>
      <Button type="button" size="sm" onClick={openLibraryOrCreate}><Library /> Add Loop</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => navigate(automationThemePath())}><Palette /> Edit theme</Button>
      <EditorActions saveLabel="Save Loop composition" onSave={async () => { await saveDraft(); }} dirty={isDirty} valid={draftIssues.length === 0} pending={saving} />
    </>;
    content = <>{notices}{draft.loops.length ? <LoopCompositionWorkspace
      config={draft}
      projection={projection}
      selectedLoopId={selectedId}
      installedModules={moduleStatuses}
      executionProfiles={data.executionProfiles}
      instructions={data.instructions}
      skills={data.skills}
      runtime={data.runtime}
      theme={data.loopTheme}
      disabled={saving}
      lockedLoopIds={lockedLoopIds}
      onSelectLoop={(id) => navigate(automationCompositionPath(id), { bypassBlocker: true })}
      onOpenLoop={(id) => navigate(automationLoopPath(id))}
      onConfigChange={setDraft}
      onDeleteLoop={removeLoop}
      onExportLoop={loopModules ? exportLoop : undefined}
      onRemoveInstalledLoop={loopModules ? removeInstalled : undefined}
    /> : <div className="p-4"><EmptyState title="No Loops yet." action="Use Add Loop to install a module, import a package, or create a blank Loop." /></div>}</>;
  } else {
    const detail = displayedLoop ? buildLoopDetailProjection(candidateConfig, displayedLoop.id) : undefined;
    actions = <>
      <Button type="button" size="sm" variant="outline" onClick={() => navigate(automationCompositionPath(displayedLoop?.id))}><ArrowLeft /> Back to Level 1</Button>
      {detail ? <EditorActions saveLabel="Save Loop" onSave={saveDetail} dirty={createDirty || isDirty} valid={valid && !lockedLoopIds.has(detail.loop.id)} pending={saving} /> : null}
    </>;
    content = <>{notices}{detail ? <LoopEditor
      config={candidateConfig}
      loop={detail.loop}
      executionProfiles={data.executionProfiles}
      instructions={data.instructions}
      skills={data.skills}
      runtime={data.runtime}
      theme={data.loopTheme}
      scheduleStates={data.scheduleStates}
      locked={lockedLoopIds.has(detail.loop.id)}
      disabled={saving}
      onLoopChange={updateLoop}
      onLocalValidityChange={setLocalEditorValid}
      onBackToComposition={() => navigate(automationCompositionPath(detail.loop.id))}
    /> : <div className="p-4"><EmptyState title="Loop not found." action="The selected Loop ID does not exist in the current project." /></div>}</>;
  }

  return (
    <LoopEngineerShell level={level} selectedLoopId={displayedLoop?.id} selectedLoopTitle={selectedModule?.title} selectedLoopDescription={displayedLoop?.description} actions={actions} navigate={navigate}>
      {content}
      {loopModules ? <LoopLibraryDialog
        open={libraryOpen}
        actions={loopModules}
        onOpenChange={setLibraryOpen}
        onCreateBlank={() => { setLibraryOpen(false); navigate(automationCreateLoopPath()); }}
        onInstalled={async (installed) => {
          await refreshWorkspace?.();
          await loadStatuses();
          navigate(automationCompositionPath(installed.loopId), { bypassBlocker: true });
        }}
      /> : null}
    </LoopEngineerShell>
  );
}

export function AutomationIssueBanner({ issues }: { issues: ProjectAutomationIssue[] }): ReactNode {
  return issues.length ? <div className="border-b border-divider-strong p-4"><AutomationIssues issues={issues} /></div> : null;
}

const downloadJson = (source: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([source], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
