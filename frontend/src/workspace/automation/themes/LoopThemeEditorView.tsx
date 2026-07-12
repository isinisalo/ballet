import type { CreateLoopThemeResponse, LoopTheme, AppData } from "@shared/api/workspace-contracts";
import { ArrowLeft, CopyPlus, LoaderCircle, Palette, Save } from "lucide-react";
import { EmptyState, Panel, TextField } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { automationAllLoopsPath, automationNewThemePath, automationThemePath } from "../../routing";
import { useWorkspaceNavigationBlocker, type WorkspaceNavigation } from "../../useWorkspaceNavigation";
import {
  LoopThemeConnectionControls,
  LoopThemeEdgeControls,
  LoopThemeNodeControls
} from "./LoopThemeControls";
import { LoopThemePreview } from "./LoopThemePreview";
import { useLoopThemeEditor } from "./useLoopThemeEditor";

export function LoopThemeEditorView({
  data,
  themeId,
  sourceThemeId,
  loopId,
  updateTheme,
  createTheme,
  navigate,
  setNavigationBlocker
}: {
  data: AppData;
  themeId?: string;
  sourceThemeId?: string;
  loopId?: string;
  updateTheme: (theme: LoopTheme) => Promise<LoopTheme>;
  createTheme: (theme: LoopTheme, loopId: string) => Promise<CreateLoopThemeResponse>;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  const creating = !themeId && Boolean(sourceThemeId);
  const sourceId = themeId ?? sourceThemeId;
  const loop = data.automation.loops.find((candidate) => candidate.id === loopId);
  const sourceIssues = data.loopThemeIssues.filter((issue) => issue.themeId === sourceId);
  const storedSource = data.loopThemes.find((theme) => theme.id === sourceId);
  const fallback = data.loopThemes.find((theme) => theme.id === "default");
  const source = storedSource ?? (sourceId && fallback && sourceIssues.length > 0
    ? { ...structuredClone(fallback), id: sourceId, label: sourceId }
    : undefined);
  const repairing = !creating && sourceIssues.length > 0;
  const repairMissing = repairing && !storedSource && !sourceIssues.some((issue) => issue.path.startsWith(".ballet/themes/"));
  if (!source || !loop || (!themeId && !sourceThemeId)) {
    return (
      <Panel title="Theme editor" icon={<Palette />} contentClassName="p-4">
        <EmptyState title="Loop theme not found." action="Open the editor from an existing Loop card." />
      </Panel>
    );
  }
  return (
    <LoopThemeEditorWorkspace
      data={data}
      source={source}
      loopId={loop.id}
      creating={creating}
      repairing={repairing}
      repairMissing={repairMissing}
      updateTheme={updateTheme}
      createTheme={createTheme}
      navigate={navigate}
      setNavigationBlocker={setNavigationBlocker}
    />
  );
}

function LoopThemeEditorWorkspace({
  data,
  source,
  loopId,
  creating,
  repairing,
  repairMissing,
  updateTheme,
  createTheme,
  navigate,
  setNavigationBlocker
}: {
  data: AppData;
  source: LoopTheme;
  loopId: string;
  creating: boolean;
  repairing: boolean;
  repairMissing: boolean;
  updateTheme: (theme: LoopTheme) => Promise<LoopTheme>;
  createTheme: (theme: LoopTheme, loopId: string) => Promise<CreateLoopThemeResponse>;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  const editor = useLoopThemeEditor({
    source,
    themes: data.loopThemes,
    creating,
    assignToLoopId: loopId,
    updateTheme,
    createTheme,
    repairMissing,
    forceDirty: repairing
  });
  const usageCount = data.automation.loops.filter((loop) => loop.theme === editor.draft.id).length;
  const sourceIssues = data.loopThemeIssues.filter((issue) => issue.themeId === source.id);
  const controlProps = {
    theme: editor.draft,
    previewTheme: editor.previewTheme,
    errors: editor.errors,
    onChange: editor.setDraft,
    onColorChange: editor.setColor
  };

  useWorkspaceNavigationBlocker(setNavigationBlocker, editor.dirty, "Discard unsaved Loop theme changes?");

  const save = async () => {
    const saved = await editor.save();
    if (!saved) return;
    if (creating) navigate(automationThemePath(saved.id, loopId), { bypassBlocker: true });
  };

  return (
    <Panel
      title="Theme editor"
      titleExtra={<><span className="truncate text-muted-foreground">{editor.draft.id}</span><Badge variant="outline">{usageCount} {usageCount === 1 ? "Loop" : "Loops"}</Badge></>}
      description={`Project-shared Loop visualization theme · source Loop ${loopId}`}
      icon={<Palette />}
      contentClassName="p-0"
      action={<div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(automationAllLoopsPath())}><ArrowLeft /> All loops</Button>
        {!creating ? <Button type="button" variant="outline" size="sm" onClick={() => navigate(automationNewThemePath(source.id, loopId))}><CopyPlus /> New theme</Button> : null}
        <Button type="button" size="sm" disabled={!editor.dirty || !editor.valid || editor.saving} onClick={() => void save()}>
          {editor.saving ? <LoaderCircle className="animate-spin" /> : <Save />} {editor.saving ? "Saving…" : "Save"}
        </Button>
      </div>}
    >
      {sourceIssues.length > 0 ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{sourceIssues.map((issue) => `${issue.path}: ${issue.message}`).join(" · ")}</AlertDescription></Alert> : null}
      {editor.error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{editor.error}</AlertDescription></Alert> : null}
      <div className="grid gap-4 border-b border-divider-strong bg-card p-4 sm:grid-cols-2">
        <TextField label="Theme ID" value={editor.draft.id} disabled={!creating} required maxLength={64} error={editor.errors.id} onChange={(id) => editor.setDraft({ ...editor.draft, id })} />
        <TextField label="Name" value={editor.draft.label} required error={editor.errors.label} onChange={(label) => editor.setDraft({ ...editor.draft, label })} />
      </div>
      <div className="border-b border-divider-strong p-4"><LoopThemePreview theme={editor.previewTheme} /></div>
      <div className="grid lg:grid-cols-3">
        <LoopThemeNodeControls {...controlProps} />
        <LoopThemeEdgeControls {...controlProps} />
        <LoopThemeConnectionControls {...controlProps} />
      </div>
    </Panel>
  );
}
