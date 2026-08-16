import type { ReactNode } from "react";
import type { AppData, ProjectAutomationConfig, ProjectAutomationIssue, ProjectLoop } from "@shared/api/workspace-contracts";
import { EditorActions, EmptyState } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutomationIssues } from "./AutomationIssues";
import { LoopCreationEditor } from "./loops/LoopCreationEditor";
import { LoopEditor } from "./loops/LoopEditor";

export function AutomationEditorWorkspace({
  data, draft, displayedLoop, creating, locked, dirty, valid, saving, error, issues,
  onSave, onLoopChange, onConfigChange, onLocalValidityChange
}: {
  data: AppData;
  draft: ProjectAutomationConfig;
  displayedLoop?: ProjectLoop;
  creating: boolean;
  locked: boolean;
  dirty: boolean;
  valid: boolean;
  saving: boolean;
  error: string;
  issues: ProjectAutomationIssue[];
  onSave: () => Promise<void>;
  onLoopChange: (loop: ProjectLoop) => void;
  onConfigChange: (config: ProjectAutomationConfig) => void;
  onLocalValidityChange: (valid: boolean) => void;
}) {
  const controls = <EditorActions saveLabel="Save Loop" onSave={onSave} dirty={dirty} valid={valid && !locked} pending={saving} />;
  const editorProps = displayedLoop ? {
    config: draft,
    loop: displayedLoop,
    executionProfiles: data.executionProfiles,
    instructions: data.instructions,
    skills: data.skills,
    runtime: data.runtime,
    theme: data.loopTheme,
    scheduleStates: data.scheduleStates,
    disabled: saving,
    canvasControls: controls,
    onLoopChange,
    onConfigChange,
    onLocalValidityChange
  } : undefined;
  return (
    <>
      <AutomationIssueBanner issues={issues} />
      {error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {!displayedLoop ? <div className="p-4"><EmptyState title="Loop not found." /></div> : null}
      {editorProps && creating ? <LoopCreationEditor {...editorProps} /> : null}
      {editorProps && !creating ? <LoopEditor {...editorProps} locked={locked} /> : null}
    </>
  );
}

export function AutomationIssueBanner({ issues }: { issues: ProjectAutomationIssue[] }): ReactNode {
  return issues.length
    ? <div className="border-b border-divider-strong p-4"><AutomationIssues issues={issues} /></div>
    : null;
}
