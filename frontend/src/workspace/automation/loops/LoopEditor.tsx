import { useEffect, useRef, useState } from "react";
import type {
  ExecutionProfile,
  LocalRuntime,
  LoopScheduleState,
  LoopTheme,
  ProjectAutomationConfig,
  ProjectInstruction,
  ProjectLoop,
  ProjectFailEdge,
  ProjectPassEdge,
  Skill
} from "@shared/api/workspace-contracts";
import { LockKeyhole, Settings2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { JobNodeEditor } from "./JobNodeEditor";
import { LoopCanvas, type WorkflowCanvasSelection } from "./LoopCanvas";
import { LoopDefinitionEditor } from "./LoopDefinitionEditor";
import { ValidationNodeEditor } from "./ValidationNodeEditor";
import { WorkflowEdgeEditor } from "./WorkflowEdgeEditor";
import {
  addJobPair,
  canRemoveJobPair,
  createJobNodeDraft,
  nextJobNodeId,
  removeJobPair,
  reorderJobNodes,
  replaceFailEdge,
  replaceJobNode,
  replacePassEdge,
  replaceValidationNode
} from "./loopEditorState";
import { parseInitialState } from "./loopFormValidation";

export function LoopEditor({
  config, loop, executionProfiles, instructions, skills, runtime, theme, scheduleStates,
  locked, disabled = false, onLoopChange, onLocalValidityChange, onBackToGraph
}: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  executionProfiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  theme: LoopTheme;
  scheduleStates: LoopScheduleState[];
  locked: boolean;
  disabled?: boolean;
  onLoopChange: (loop: ProjectLoop) => void;
  onLocalValidityChange: (valid: boolean) => void;
  onBackToGraph: () => void;
}) {
  const [selection, setSelection] = useState<WorkflowCanvasSelection>();
  const initialState = useLoopInitialState(loop, onLoopChange, onLocalValidityChange);
  const editingDisabled = locked || disabled;
  const { selectedJob, selectedValidation, selectedPassEdge, selectedFailEdge, selectionExists } =
    resolveSelection(loop, selection);

  useEffect(() => {
    if (!selectionExists) setSelection(undefined);
  }, [selectionExists]);
  const insertJob = () => {
    if (editingDisabled) return;
    const job = createJobNodeDraft(nextJobNodeId(config, loop));
    onLoopChange(addJobPair(loop, job));
    setSelection({ kind: "job", id: job.id });
  };

  return (
    <div className="grid min-w-0">
      {locked ? <LoopLockedAlert /> : null}
      <header className="flex min-w-0 items-center gap-3 border-b border-divider-strong px-4 py-3">
        <p className="min-w-0 flex-1 truncate font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">Workflow · Job Nodes, Validation Nodes, Pass Edges, and Fail Edges</p>
        <Button type="button" size="sm" variant={selection ? "outline" : "secondary"} onClick={() => setSelection(undefined)}><Settings2 /> Loop definition</Button>
      </header>
      <div role="region" aria-label="Workflow editor workspace" className="grid min-h-[36rem] min-w-0 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,3fr)_minmax(22rem,2fr)]">
        <LoopCanvas config={config} loop={loop} executionProfiles={executionProfiles} runtime={runtime} theme={theme} selection={selection} readOnly={false} onAddFirstNode={insertJob} onSelection={setSelection} onReorderNode={(fromIndex, toIndex) => { if (!editingDisabled) onLoopChange(reorderJobNodes(loop, fromIndex, toIndex)); }} />
        <aside aria-label={selection ? `Edit Workflow element ${selection.id}` : "Edit Loop definition"} className="min-h-0 overflow-y-auto border-t border-divider-strong bg-popover md:max-h-[calc(100vh-9rem)] md:border-t-0 md:border-l">
          {selectedJob ? <JobNodeEditor
            node={selectedJob}
            loop={loop}
            allLoops={config.loops}
            profiles={executionProfiles}
            instructions={instructions}
            skills={skills}
            runtime={runtime}
            scheduleState={scheduleStates.find((state) => state.loopId === loop.id && state.jobNodeId === selectedJob.id)}
            disabled={editingDisabled}
            removable={canRemoveJobPair(loop, selectedJob.id)}
            removeBlockedReason={jobRemovalBlockedReason(loop, selectedJob.id)}
            onChange={(job) => {
              const previousId = selectedJob.id;
              onLoopChange(replaceJobNode(loop, previousId, job));
              if (job.id !== previousId) setSelection({ kind: "job", id: job.id });
            }}
            onMove={(offset) => onLoopChange(reorderJobNodes(loop, loop.workflow.jobNodes.indexOf(selectedJob), loop.workflow.jobNodes.indexOf(selectedJob) + offset))}
            onRemove={() => { onLoopChange(removeJobPair(loop, selectedJob.id)); setSelection(undefined); }}
          /> : selectedValidation ? <ValidationNodeEditor
            node={selectedValidation}
            loop={loop}
            allLoops={config.loops}
            profiles={executionProfiles}
            instructions={instructions}
            skills={skills}
            runtime={runtime}
            disabled={editingDisabled}
            onChange={(validation) => {
              const previousId = selectedValidation.id;
              onLoopChange(replaceValidationNode(loop, previousId, validation));
              if (validation.id !== previousId) setSelection({ kind: "validation", id: validation.id });
            }}
          /> : selectedPassEdge ? <WorkflowEdgeEditor
            edge={selectedPassEdge}
            loop={loop}
            disabled={editingDisabled}
            onChange={(edge) => {
              if (!("jobNodeId" in edge.target || edge.target.workflowResult === "PASS")) return;
              const previousId = selectedPassEdge.id;
              onLoopChange(replacePassEdge(loop, previousId, edge as ProjectPassEdge));
              if (edge.id !== previousId) setSelection({ kind: "pass-edge", id: edge.id });
            }}
          /> : selectedFailEdge ? <WorkflowEdgeEditor
            edge={selectedFailEdge}
            loop={loop}
            disabled={editingDisabled}
            onChange={(edge) => {
              if ("jobNodeId" in edge.target || edge.target.workflowResult !== "FAIL") return;
              const previousId = selectedFailEdge.id;
              onLoopChange(replaceFailEdge(loop, previousId, edge as ProjectFailEdge));
              if (edge.id !== previousId) setSelection({ kind: "fail-edge", id: edge.id });
            }}
          /> : <LoopDefinitionEditor config={config} loop={loop} initialStateText={initialState.text} initialStateError={initialState.error} disabled={editingDisabled} onLoopChange={onLoopChange} onInitialStateTextChange={initialState.update} onSelection={setSelection} onBackToGraph={onBackToGraph} />}
        </aside>
      </div>
    </div>
  );
}

function useLoopInitialState(
  loop: ProjectLoop,
  onLoopChange: (loop: ProjectLoop) => void,
  onLocalValidityChange: (valid: boolean) => void
) {
  const fingerprint = JSON.stringify(loop.state.initial);
  const lastFingerprint = useRef(fingerprint);
  const [text, setText] = useState(() => JSON.stringify(loop.state.initial, null, 2));
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (fingerprint === lastFingerprint.current) return;
    lastFingerprint.current = fingerprint;
    setText(JSON.stringify(loop.state.initial, null, 2));
    setError(undefined);
    onLocalValidityChange(true);
  }, [fingerprint, loop.state.initial, onLocalValidityChange]);
  useEffect(() => () => onLocalValidityChange(true), [onLocalValidityChange]);

  const update = (next: string) => {
    setText(next);
    const parsed = parseInitialState(next);
    setError(parsed.error);
    onLocalValidityChange(!parsed.error);
    if (parsed.value === undefined) return;
    lastFingerprint.current = JSON.stringify(parsed.value);
    onLoopChange({ ...loop, state: { ...loop.state, initial: parsed.value } });
  };
  return { text, error, update };
}

function resolveSelection(loop: ProjectLoop, selection?: WorkflowCanvasSelection) {
  const selectedJob = selection?.kind === "job"
    ? loop.workflow.jobNodes.find((node) => node.id === selection.id) : undefined;
  const selectedValidation = selection?.kind === "validation"
    ? loop.workflow.validationNodes.find((node) => node.id === selection.id) : undefined;
  const selectedPassEdge = selection?.kind === "pass-edge"
    ? loop.workflow.passEdges.find((edge) => edge.id === selection.id) : undefined;
  const selectedFailEdge = selection?.kind === "fail-edge"
    ? loop.workflow.failEdges.find((edge) => edge.id === selection.id) : undefined;
  return {
    selectedJob,
    selectedValidation,
    selectedPassEdge,
    selectedFailEdge,
    selectionExists: !selection || Boolean(selectedJob || selectedValidation || selectedPassEdge || selectedFailEdge)
  };
}

function jobRemovalBlockedReason(loop: ProjectLoop, jobNodeId: string) {
  if (loop.workflow.startJobNodeId === jobNodeId) return "Change the Workflow start before removing this Job/Validation pair.";
  if (loop.workflow.passEdges.some((edge) => "jobNodeId" in edge.target && edge.target.jobNodeId === jobNodeId)) return "Retarget incoming Pass Edges before removing this Job/Validation pair.";
  return undefined;
}

function LoopLockedAlert() {
  return <Alert className="m-4 mb-0 rounded-lg border-tertiary/40 text-tertiary"><LockKeyhole /><AlertDescription>This Loop has an active Run. Editing is locked until it finishes or is cancelled.</AlertDescription></Alert>;
}
