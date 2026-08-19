// Size exception: this coordinator keeps one authoritative automation draft, save lock, module handoff, and URL-owned engineering view boundary.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Library, Palette } from "lucide-react";
import type { AppData, InstalledLoopModuleStatus, ProjectAutomationConfig, ProjectAutomationIssue, ProjectLoop } from "@shared/api/workspace-contracts";
import { EditorActions, EmptyState } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { EngineeringView, RouteState } from "../types";
import { automationCreateLoopPath, automationGraphPath, automationLoopPath, automationThemePath } from "../routing";
import { useWorkspaceNavigationBlocker, type WorkspaceNavigation } from "../useWorkspaceNavigation";
import { EngineeringShell } from "./EngineeringShell";
import { AutomationIssues } from "./AutomationIssues";
import { useAutomationDraft } from "./useAutomationDraft";
import { GraphEngineeringWorkspace } from "./loops/GraphEngineeringWorkspace";
import { LoopEditor } from "./loops/LoopEditor";
import { LoopLibraryDialog, type LoopModuleActions } from "./loops/LoopLibraryDialog";
import { buildGraphEngineeringProjection, buildLoopEngineeringProjection } from "./loops/engineeringProjections";
import { createLoopDraft, removeLoopAtIndex, updateLoopAtIndex } from "./loops/loopEditorState";
import { automationDraftIssues } from "./loops/loopFormValidation";
import { isActiveLoopRun } from "./loops/loopRunState";

export function AutomationView({
  data,
  selectedId,
  view,
  routeIssue,
  creating = false,
  saveAutomation,
  refreshWorkspace,
  loopModules,
  navigate,
  setNavigationBlocker
}: {
  data: AppData;
  selectedId?: string;
  view: EngineeringView;
  routeIssue?: RouteState["automationRouteIssue"];
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
  const [selectedGraphLoopId, setSelectedGraphLoopId] = useState<string>();
  const [moduleStatuses, setModuleStatuses] = useState<InstalledLoopModuleStatus[]>([]);
  const [moduleError, setModuleError] = useState("");
  const operationRef = useRef(false);
  const isCreatingLoop = view === "loop" && creating;
  const savedIndex = data.automation.loops.findIndex((loop) => loop.id === selectedId);
  const selectedIndex = savedIndex >= 0 ? savedIndex : draft.loops.findIndex((loop) => loop.id === selectedId);
  const selectedLoop = selectedIndex >= 0 ? draft.loops[selectedIndex] : undefined;
  const selectedGraphLoop = draft.loops.find((loop) => loop.id === selectedGraphLoopId);
  const displayedLoop = isCreatingLoop ? createDraft : selectedLoop;
  const createDirty = isCreatingLoop && JSON.stringify(createDraft) !== JSON.stringify(createLoopDraft());
  const candidateConfig = isCreatingLoop ? { ...draft, loops: [...draft.loops, createDraft] } : draft;
  const draftIssues = automationDraftIssues(candidateConfig, data.executionProfiles, data.instructions, data.skills, data.runtime);
  const valid = draftIssues.length === 0 && localEditorValid;
  const issues = [...draftIssues, ...data.loopThemeIssues];
  const lockedLoopIds = new Set(data.loopRuns.filter((run) => isActiveLoopRun(run)).map((run) => run.loopId));
  const activeLoop = view === "graph" ? selectedGraphLoop : displayedLoop;
  const selectedModule = moduleStatuses.find((module) => module.loopId === activeLoop?.id);

  useWorkspaceNavigationBlocker(setNavigationBlocker, isDirty || createDirty, "Discard unsaved Work Loop changes?");
  useEffect(() => {
    if (!isCreatingLoop) setCreateDraft(createLoopDraft());
    setLocalEditorValid(true);
  }, [isCreatingLoop, selectedId]);

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
    if (isCreatingLoop) {
      const next = updateLoopAtIndex(candidateConfig, candidateConfig.loops.length - 1, loop);
      setCreateDraft(next.loops.at(-1) ?? loop);
    } else if (selectedIndex >= 0) {
      setDraft((config) => updateLoopAtIndex(config, selectedIndex, loop));
    }
  };
  const saveLoop = async () => {
    if (!displayedLoop || !valid || operationRef.current || lockedLoopIds.has(displayedLoop.id)) return;
    operationRef.current = true;
    try {
      if (!await saveDraft(candidateConfig)) return;
      if (isCreatingLoop) setCreateDraft(createLoopDraft());
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
      if (selectedGraphLoopId === loopId) setSelectedGraphLoopId(undefined);
      navigate(automationGraphPath(), { bypassBlocker: true });
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
      navigate(automationGraphPath(), { bypassBlocker: true });
    } catch (reason) {
      setModuleError(reason instanceof Error ? reason.message : "Unable to remove installed Loop.");
    }
  };
  const openLibraryOrCreate = () => loopModules ? setLibraryOpen(true) : navigate(automationCreateLoopPath());
  const notices = <><AutomationIssueBanner issues={issues} />{routeIssue ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{routeIssue === "missing-loop-id" ? "Loop Engineering requires a Loop ID." : routeIssue === "non-canonical-graph" ? "Graph Engineering does not accept an ID or create parameter." : "Unknown engineering view. Use view=graph or view=loop."}</AlertDescription></Alert> : null}{error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{error}</AlertDescription></Alert> : null}{moduleError ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{moduleError}</AlertDescription></Alert> : null}</>;

  let actions: ReactNode;
  let content: ReactNode;
  if (view === "graph") {
    const projection = buildGraphEngineeringProjection({ config: draft, installedModules: moduleStatuses, lockedLoopIds });
    actions = <>
      <Button type="button" size="sm" onClick={openLibraryOrCreate}><Library /> Add Loop</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => navigate(automationThemePath())}><Palette /> Edit theme</Button>
      <EditorActions saveLabel="Save graph" onSave={async () => { await saveDraft(); }} dirty={isDirty} valid={draftIssues.length === 0} pending={saving} />
    </>;
    content = <>{notices}{draft.loops.length ? <GraphEngineeringWorkspace
      config={draft}
      projection={projection}
      selectedLoopId={selectedGraphLoopId}
      installedModules={moduleStatuses}
      executionProfiles={data.executionProfiles}
      instructions={data.instructions}
      skills={data.skills}
      runtime={data.runtime}
      theme={data.loopTheme}
      disabled={saving}
      lockedLoopIds={lockedLoopIds}
      onSelectLoop={setSelectedGraphLoopId}
      onOpenLoop={(id) => navigate(automationLoopPath(id))}
      onConfigChange={setDraft}
      onDeleteLoop={removeLoop}
      onExportLoop={loopModules ? exportLoop : undefined}
      onRemoveInstalledLoop={loopModules ? removeInstalled : undefined}
    /> : <div className="p-4"><EmptyState title="No Loops yet." action="Use Add Loop to install a module, import a package, or create a blank Loop." /></div>}</>;
  } else {
    const loopProjection = displayedLoop ? buildLoopEngineeringProjection(candidateConfig, displayedLoop.id) : undefined;
    actions = <>
      <Button type="button" size="sm" variant="outline" onClick={() => navigate(automationGraphPath())}><ArrowLeft /> Back to Graph Engineering</Button>
      {loopProjection ? <EditorActions saveLabel="Save Loop" onSave={saveLoop} dirty={createDirty || isDirty} valid={valid && !lockedLoopIds.has(loopProjection.loop.id)} pending={saving} /> : null}
    </>;
    content = <>{notices}{loopProjection ? <LoopEditor
      config={candidateConfig}
      loop={loopProjection.loop}
      executionProfiles={data.executionProfiles}
      instructions={data.instructions}
      skills={data.skills}
      runtime={data.runtime}
      theme={data.loopTheme}
      scheduleStates={data.scheduleStates}
      locked={lockedLoopIds.has(loopProjection.loop.id)}
      disabled={saving}
      onLoopChange={updateLoop}
      onLocalValidityChange={setLocalEditorValid}
      onBackToGraph={() => navigate(automationGraphPath())}
    /> : <div className="p-4"><EmptyState title="Loop not found." action="The selected Loop ID does not exist in the current project." /></div>}</>;
  }

  return (
    <EngineeringShell view={view} selectedLoopId={activeLoop?.id} selectedLoopTitle={selectedModule?.title} selectedLoopDescription={activeLoop?.description} actions={actions} navigate={navigate}>
      {content}
      {loopModules ? <LoopLibraryDialog
        open={libraryOpen}
        actions={loopModules}
        onOpenChange={setLibraryOpen}
        onCreateBlank={() => { setLibraryOpen(false); navigate(automationCreateLoopPath()); }}
        onInstalled={async (installed) => {
          await refreshWorkspace?.();
          await loadStatuses();
          setSelectedGraphLoopId(installed.loopId);
          navigate(automationGraphPath(), { bypassBlocker: true });
        }}
      /> : null}
    </EngineeringShell>
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
