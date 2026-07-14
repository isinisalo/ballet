import type { AppData, LoopTheme } from "@shared/api/workspace-contracts";
import { ArrowLeft, Palette } from "lucide-react";
import { useId, type FormEvent } from "react";
import { EditorActions, Panel } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { automationAllLoopsPath } from "../../routing";
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
  updateTheme,
  navigate,
  setNavigationBlocker
}: {
  data: AppData;
  updateTheme: (theme: LoopTheme) => Promise<LoopTheme>;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  const editor = useLoopThemeEditor({
    source: data.loopTheme,
    updateTheme,
    forceDirty: data.loopThemeIssues.length > 0
  });
  const formId = useId();
  const controlProps = {
    theme: editor.draft,
    previewTheme: editor.previewTheme,
    errors: editor.errors,
    disabled: editor.saving,
    onChange: editor.setDraft,
    onColorChange: editor.setColor
  };

  useWorkspaceNavigationBlocker(setNavigationBlocker, editor.dirty, "Discard unsaved Loop theme changes?");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void editor.save();
  };

  return (
    <Panel
      title="Theme editor"
      description="Project-wide Loop visualization theme"
      icon={<Palette />}
      contentClassName="p-0"
      action={<div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={editor.saving} onClick={() => navigate(automationAllLoopsPath())}><ArrowLeft /> All loops</Button>
        <EditorActions saveLabel="Save" formId={formId} dirty={editor.dirty} valid={editor.valid} pending={editor.saving} />
      </div>}
    >
      <form id={formId} aria-label="Loop theme" aria-busy={editor.saving} onSubmit={submit}>
        {data.loopThemeIssues.length > 0 ? (
          <Alert variant="destructive" className="m-4 mb-0">
            <AlertDescription>{data.loopThemeIssues.map((issue) => `${issue.path}: ${issue.message}`).join(" · ")}</AlertDescription>
          </Alert>
        ) : null}
        {editor.error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{editor.error}</AlertDescription></Alert> : null}
        <div className="border-b border-divider-strong p-4"><LoopThemePreview theme={editor.previewTheme} /></div>
        <div className="grid lg:grid-cols-3">
          <LoopThemeNodeControls {...controlProps} />
          <LoopThemeEdgeControls {...controlProps} />
          <LoopThemeConnectionControls {...controlProps} />
        </div>
      </form>
    </Panel>
  );
}
