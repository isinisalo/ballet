import type { ProjectAutomationConfig, ProjectLoop, ProjectNodeEdgeTarget } from "@shared/api/workspace-contracts";
import { ArrowLeft, Braces, Plus, Settings2 } from "lucide-react";
import { SelectField, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { addWorkLoopNode, createWorkLoopNodeDraft, nextWorkLoopNodeId, updateNodeEdgeTarget } from "./loopEditorState";
import { loopIdError } from "./loopFormValidation";
import { NodeEdgesEditor } from "./NodeEdgesEditor";

export function LoopDefinitionEditor({ config, loop, initialStateText, initialStateError, disabled, onLoopChange, onInitialStateTextChange, onNodeSelect, onBackToGraph }: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  initialStateText: string;
  initialStateError?: string;
  disabled: boolean;
  onLoopChange: (loop: ProjectLoop) => void;
  onInitialStateTextChange: (text: string) => void;
  onNodeSelect: (nodeId: string) => void;
  onBackToGraph: () => void;
}) {
  const updateLoop = (next: ProjectLoop) => onLoopChange(next);
  const addNode = () => {
    const next = addWorkLoopNode(loop, createWorkLoopNodeDraft(nextWorkLoopNodeId(config, loop)));
    updateLoop(next);
    const added = next.nodes.at(-1);
    if (added) onNodeSelect(added.id);
  };
  return (
    <form aria-label="Loop definition" className="@container/loop-form grid gap-4 p-4" onSubmit={(event) => event.preventDefault()}>
      <header className="flex items-start gap-2 border-b border-divider-strong pb-3">
        <Settings2 className="mt-0.5 size-4 text-primary" aria-hidden="true" />
        <div><h2 className="font-mono text-sm font-semibold">Loop definition</h2><p className="mt-1 text-xs text-muted-foreground">Identity, canonical initial state, Work Loop Nodes, and explicit edges.</p></div>
      </header>
      <TextField label="Loop ID" value={loop.id} error={loopIdError(loop, config.loops)} required disabled={disabled} density="compact" maxLength={101} onChange={(id) => updateLoop({ ...loop, id })} />
      <TextAreaField label="Loop description" value={loop.description} error={loop.description.trim() ? undefined : "Loop description is required."} required disabled={disabled} density="compact" rows={3} maxLength={2_000} onChange={(description) => updateLoop({ ...loop, description })} />
      <TextAreaField label="State description" value={loop.state.description} error={loop.state.description.trim() ? undefined : "State description is required."} required disabled={disabled} density="compact" rows={2} maxLength={2_000} onChange={(description) => updateLoop({ ...loop, state: { ...loop.state, description } })} />
      <div className="grid gap-1">
        <span className="flex items-center gap-1 font-mono text-[0.68rem] font-medium text-muted-foreground"><Braces className="size-3" aria-hidden="true" /> JSON state is validated before it enters the domain draft.</span>
        <TextAreaField label="Initial state JSON" value={initialStateText} error={initialStateError} required disabled={disabled} density="compact" rows={8} onChange={onInitialStateTextChange} />
      </div>
      {loop.nodes.length ? (
        <SelectField label="Start Work Loop Node" value={loop.startNodeId} options={loop.nodes.map((node) => ({ value: node.id, label: `${node.id} · ${node.description || "No description"}` }))} required disabled={disabled} density="compact" onChange={(startNodeId) => updateLoop({ ...loop, startNodeId })} />
      ) : null}
      <section aria-labelledby="work-loop-nodes-heading" className="grid gap-2 rounded-lg border border-divider-strong bg-card p-3">
        <div className="flex items-center gap-2"><h3 id="work-loop-nodes-heading" className="font-mono text-xs font-semibold uppercase tracking-[0.08em]">Work Loop Nodes</h3><Button type="button" size="xs" variant="outline" className="ml-auto" disabled={disabled} onClick={addNode}><Plus /> Add node</Button></div>
        {loop.nodes.map((node, index) => <button key={`${node.id}-${index}`} type="button" disabled={disabled} className="flex min-w-0 items-center justify-between rounded border border-divider-strong bg-background px-3 py-2 text-left text-xs hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onNodeSelect(node.id)}><span className="truncate font-mono">{node.id}</span><span className="ml-3 text-muted-foreground">Work + Validation</span></button>)}
        {loop.nodes.length === 0 ? <p className="text-xs text-muted-foreground">Add the first composite node to define the Loop start.</p> : null}
      </section>
      <NodeEdgesEditor loop={loop} disabled={disabled} onChange={(sourceNodeId: string, target: ProjectNodeEdgeTarget) => updateLoop(updateNodeEdgeTarget(loop, sourceNodeId, target))} />
      <div className="flex items-center gap-2 border-t border-divider-strong pt-3 text-xs text-muted-foreground">
        <span className="flex-1">Connections to other Loops are edited in Graph Engineering.</span>
        <Button type="button" size="xs" variant="link" onClick={onBackToGraph}><ArrowLeft /> Open Graph Engineering</Button>
      </div>
    </form>
  );
}
