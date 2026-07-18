import type { ReactNode } from "react";
import type { AgentExecutionState, AppData, ProjectAutomationConfig, ProjectAutomationIssue, ProjectLoop } from "@shared/api/workspace-contracts";
import { EditorActions, EmptyState } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutomationIssues } from "./AutomationIssues";
import { LoopCreationEditor, LoopEditor } from "./loops/LoopEditor";

export function AutomationEditorWorkspace({ data, agentExecutionStates, draft, candidateConfig, displayedLoop, scheduleState, creating, locked, dirty, valid, saving, error, issues, onSave, onChange }: {
  data: AppData;
  agentExecutionStates: AgentExecutionState[];
  draft: ProjectAutomationConfig;
  candidateConfig: ProjectAutomationConfig;
  displayedLoop?: ProjectLoop;
  scheduleState: AppData["scheduleStates"][number] | undefined;
  creating: boolean;
  locked: boolean;
  dirty: boolean;
  valid: boolean;
  saving: boolean;
  error: string;
  issues: ProjectAutomationIssue[];
  onSave: () => Promise<void>;
  onChange: (loop: ProjectLoop) => void;
}) {
  const editActions = (
    <EditorActions
      saveLabel="Save loop"
      onSave={onSave}
      dirty={dirty}
      valid={valid && !locked}
      pending={saving}
    />
  );

  return (
    <>
      <AutomationIssueBanner issues={issues} />
      {error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {!displayedLoop ? <div className="p-4"><EmptyState title="Loop not found." /></div> : null}
      {displayedLoop && creating ? (
        <LoopCreationEditor config={candidateConfig} loop={displayedLoop} loops={draft.loops} agents={data.agents} theme={data.loopTheme} disabled={saving} canvasControls={editActions} onChange={onChange} />
      ) : null}
      {displayedLoop && !creating ? (
        <LoopEditor config={draft} loop={displayedLoop} loops={draft.loops} agents={data.agents} agentExecutionStates={agentExecutionStates} theme={data.loopTheme} scheduleState={scheduleState} locked={locked} disabled={saving} canvasControls={editActions} onChange={onChange} />
      ) : null}
    </>
  );
}

export function AutomationIssueBanner({ issues }: { issues: ProjectAutomationIssue[] }): ReactNode {
  return issues.length ? <div className="border-b border-divider-strong p-4"><AutomationIssues issues={issues} /></div> : null;
}
