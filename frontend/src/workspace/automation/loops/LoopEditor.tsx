import { useEffect, useRef, useState } from "react";
import type {
  ExecutionProfile,
  LocalRuntime,
  LoopScheduleState,
  LoopTheme,
  ProjectAutomationConfig,
  ProjectInstruction,
  ProjectLoop,
  Skill
} from "@shared/api/workspace-contracts";
import { LockKeyhole, Settings2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoopCanvas } from "./LoopCanvas";
import { LoopDefinitionEditor } from "./LoopDefinitionEditor";
import { WorkLoopNodeEditor } from "./WorkLoopNodeEditor";
import { addWorkLoopNode, createWorkLoopNodeDraft, nextWorkLoopNodeId, removeWorkLoopNode, reorderWorkLoopNodes, replaceWorkLoopNode } from "./loopEditorState";
import { parseInitialState } from "./loopFormValidation";

export function LoopEditor({
  config, loop, executionProfiles, instructions, skills, runtime, theme, scheduleStates,
  locked, disabled = false, onLoopChange, onLocalValidityChange, onBackToComposition
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
  onBackToComposition: () => void;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const initialFingerprint = JSON.stringify(loop.state.initial);
  const lastInitialFingerprint = useRef(initialFingerprint);
  const [initialStateText, setInitialStateText] = useState(() => JSON.stringify(loop.state.initial, null, 2));
  const [initialStateError, setInitialStateError] = useState<string>();
  const selectedNode = loop.nodes.find((node) => node.id === selectedNodeId);
  const editingDisabled = locked || disabled;

  useEffect(() => {
    if (initialFingerprint === lastInitialFingerprint.current) return;
    lastInitialFingerprint.current = initialFingerprint;
    setInitialStateText(JSON.stringify(loop.state.initial, null, 2));
    setInitialStateError(undefined);
    onLocalValidityChange(true);
  }, [initialFingerprint, loop.state.initial, onLocalValidityChange]);
  useEffect(() => {
    if (selectedNodeId && !selectedNode) setSelectedNodeId(undefined);
  }, [selectedNode, selectedNodeId]);
  useEffect(() => () => onLocalValidityChange(true), [onLocalValidityChange]);

  const updateInitialState = (text: string) => {
    setInitialStateText(text);
    const parsed = parseInitialState(text);
    setInitialStateError(parsed.error);
    onLocalValidityChange(!parsed.error);
    if (parsed.value !== undefined) {
      lastInitialFingerprint.current = JSON.stringify(parsed.value);
      onLoopChange({ ...loop, state: { ...loop.state, initial: parsed.value } });
    }
  };
  const insertNode = () => {
    if (editingDisabled) return;
    const next = addWorkLoopNode(loop, createWorkLoopNodeDraft(nextWorkLoopNodeId(config, loop)));
    onLoopChange(next);
    setSelectedNodeId(next.nodes.at(-1)?.id);
  };

  return (
    <div className="grid min-w-0">
      {locked ? <LoopLockedAlert /> : null}
      <header className="flex min-w-0 items-center gap-3 border-b border-divider-strong px-4 py-3">
        <p className="min-w-0 flex-1 truncate font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">Internal graph · Work Loop Nodes and Internal Edges</p>
        <Button type="button" size="sm" variant={selectedNode ? "outline" : "secondary"} onClick={() => setSelectedNodeId(undefined)}><Settings2 /> Loop definition</Button>
      </header>
      <div role="region" aria-label="Work Loop editor workspace" className="grid min-h-[36rem] min-w-0 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,3fr)_minmax(22rem,2fr)]">
        <LoopCanvas
          config={config}
          loop={loop}
          executionProfiles={executionProfiles}
          runtime={runtime}
          theme={theme}
          selectedNodeId={selectedNode?.id}
          readOnly={false}
          onAddFirstNode={insertNode}
          onNodeSelect={setSelectedNodeId}
          onNodeEdgeSelect={(nodeId) => setSelectedNodeId(nodeId)}
          onReorderNode={(fromIndex, toIndex) => {
            if (!editingDisabled) onLoopChange(reorderWorkLoopNodes(loop, fromIndex, toIndex));
          }}
        />
        <aside aria-label={selectedNode ? `Edit Work Loop Node ${selectedNode.id}` : "Edit Loop definition"} className="min-h-0 overflow-y-auto border-t border-divider-strong bg-popover md:max-h-[calc(100vh-9rem)] md:border-t-0 md:border-l">
          {selectedNode ? (
            <WorkLoopNodeEditor
              node={selectedNode}
              loop={loop}
              allLoops={config.loops}
              profiles={executionProfiles}
              instructions={instructions}
              skills={skills}
              runtime={runtime}
              scheduleState={scheduleStates.find((state) => state.loopId === loop.id && state.workLoopNodeId === selectedNode.id)}
              disabled={editingDisabled}
              onChange={(node) => {
                const previousId = selectedNode.id;
                onLoopChange(replaceWorkLoopNode(loop, previousId, node));
                if (node.id !== previousId) setSelectedNodeId(node.id);
              }}
              onMove={(offset) => onLoopChange(reorderWorkLoopNodes(loop, loop.nodes.indexOf(selectedNode), loop.nodes.indexOf(selectedNode) + offset))}
              onRemove={() => { onLoopChange(removeWorkLoopNode(loop, selectedNode.id)); setSelectedNodeId(undefined); }}
            />
          ) : (
            <LoopDefinitionEditor
              config={config}
              loop={loop}
              initialStateText={initialStateText}
              initialStateError={initialStateError}
              disabled={editingDisabled}
              onLoopChange={onLoopChange}
              onInitialStateTextChange={updateInitialState}
              onNodeSelect={setSelectedNodeId}
              onBackToComposition={onBackToComposition}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function LoopLockedAlert() {
  return (
    <Alert className="m-4 mb-0 rounded-lg border-tertiary/40 text-tertiary">
      <LockKeyhole />
      <AlertDescription>This Loop has an active run. Editing is locked until it finishes or is cancelled.</AlertDescription>
    </Alert>
  );
}
