import { Route, Zap } from "lucide-react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { loopInputEventLabel } from "./loopGraph";
import { loopAddActionGhostLabel, loopCanvasNodeAnchorY, type LoopCanvasLayoutNode } from "./loopLayout";
import { LoopGhostNode } from "./LoopGhostNode";
import { LoopPolicyNode } from "./LoopPolicyNode";
import type { LoopNodeContext, LoopReactFlowNode } from "./LoopCanvasTypes";

export function LoopReactFlowNodeComponent({ data }: NodeProps<LoopReactFlowNode>) {
  const { layoutNode, context, activeHandleIds } = data;

  return (
    <div className="loop-react-flow-node nopan flex h-full w-full items-center">
      <LoopNodeHandles activeHandleIds={activeHandleIds} layoutNode={layoutNode} />
      {renderNodeContent(layoutNode, context)}
    </div>
  );
}

function LoopNodeHandles({ activeHandleIds, layoutNode }: { activeHandleIds: string[]; layoutNode: LoopCanvasLayoutNode }) {
  const anchorTop = loopCanvasNodeAnchorY(layoutNode);
  const activeHandleIdSet = new Set(activeHandleIds);

  return (
    <>
      {activeHandleIdSet.has("left") ? <Handle id="left" type="target" position={Position.Left} isConnectable={false} className="loop-react-flow-handle" style={{ top: anchorTop }} /> : null}
      {activeHandleIdSet.has("right") ? <Handle id="right" type="source" position={Position.Right} isConnectable={false} className="loop-react-flow-handle" style={{ top: anchorTop }} /> : null}
      {activeHandleIdSet.has("top") ? (
        <>
          <Handle id="top" type="source" position={Position.Top} isConnectable={false} className="loop-react-flow-handle" style={{ left: "50%" }} />
          <Handle id="top" type="target" position={Position.Top} isConnectable={false} className="loop-react-flow-handle" style={{ left: "50%" }} />
        </>
      ) : null}
      {activeHandleIdSet.has("bottom") ? (
        <>
          <Handle id="bottom" type="source" position={Position.Bottom} isConnectable={false} className="loop-react-flow-handle" style={{ left: "50%" }} />
          <Handle id="bottom" type="target" position={Position.Bottom} isConnectable={false} className="loop-react-flow-handle" style={{ left: "50%" }} />
        </>
      ) : null}
    </>
  );
}

function renderNodeContent(node: LoopCanvasLayoutNode, context: LoopNodeContext) {
  if (node.kind === "loop") return renderLoopNode(node);
  if (node.kind === "input-event") return renderInputEventNode(node, context);
  if (node.kind === "first-policy-ghost") return renderFirstPolicyGhost(node, context);
  if (node.kind === "output-event") return renderOutputEventNode(node, context);
  if (!node.record) return null;
  return <LoopPolicyNode context={context} record={node.record} records={node.records ?? [node.record]} />;
}

function renderLoopNode(node: LoopCanvasLayoutNode) {
  const summary = node.loopSummary;
  const label = summary?.loopId ?? "Loop";

  return (
    <div
      data-loop-node
      data-loop-summary={summary?.loopId}
      aria-label={`Loop: ${label}`}
      title={label}
      className="flex h-[22px] w-full min-w-0 items-center gap-1 rounded-md border border-divider-strong bg-card px-1.5 text-left font-mono text-[0.66rem] leading-4 text-foreground"
    >
      <Route className="size-3 shrink-0 text-tertiary" aria-hidden="true" />
      <span className="block min-w-0 truncate text-tertiary">{label}</span>
    </div>
  );
}

function renderInputEventNode(node: LoopCanvasLayoutNode, context: LoopNodeContext) {
  const value = loopInputEventLabel(node.inputEventPolicy ?? context.firstPolicy);

  return (
    <div
      data-loop-node
      aria-label={`Input event: ${value}`}
      title={value}
      className={cn(
        "flex h-[22px] w-full min-w-0 items-center justify-center rounded-md border border-divider-strong bg-card text-foreground",
        !context.firstPolicy && "border-dashed border-muted-foreground/70 bg-background/80 text-muted-foreground"
      )}
    >
      <Zap className="size-3.5 shrink-0 text-tertiary" aria-hidden="true" />
    </div>
  );
}

function renderFirstPolicyGhost(node: LoopCanvasLayoutNode, context: LoopNodeContext) {
  const editable = (node.loopId ?? context.selectedLoopId) === context.selectedLoopId;
  return (
    <LoopGhostNode
      value="Add first policy"
      icon={Route}
      ariaLabel="Add first policy"
      onClick={() => context.onAddPolicyStep()}
      disabled={!editable || !context.canAddFirstPolicy}
      className="nodrag w-60"
    />
  );
}

function renderOutputEventNode(node: LoopCanvasLayoutNode, context: LoopNodeContext) {
  const outputEvent = node.outputEvent;
  const eventType = outputEvent?.eventType ?? "Output event";
  const sourcePolicy = node.sourcePolicyId ? context.policyById.get(node.sourcePolicyId) : undefined;
  const editable = (node.loopId ?? context.selectedLoopId) === context.selectedLoopId;

  return (
    <button
      type="button"
      data-loop-output-event={eventType}
      aria-label={`Add policy step for ${eventType}`}
      title={`Add action for ${eventType}`}
      disabled={!editable || !context.canAddPolicyForEvent(sourcePolicy)}
      onClick={() => context.onAddPolicyStep(eventType, sourcePolicy)}
      className="nodrag nopan flex h-[22px] w-full min-w-0 items-center rounded-md border border-dashed border-muted-foreground/50 bg-background/60 px-1.5 text-left font-mono text-[0.66rem] leading-4 text-muted-foreground opacity-60 transition-colors hover:border-primary/65 hover:bg-card hover:text-foreground hover:opacity-85 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-muted-foreground/50 disabled:hover:bg-background/60"
    >
      <span className="block min-w-0 truncate">{loopAddActionGhostLabel}</span>
    </button>
  );
}
