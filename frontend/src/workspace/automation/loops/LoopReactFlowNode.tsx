import { Route } from "lucide-react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { loopCanvasNodeAnchorY, type LoopCanvasLayoutNode } from "./loopLayout";
import { LoopGhostNode } from "./LoopGhostNode";
import { LoopCompactStepNode } from "./LoopCompactStepNode";
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
  if (node.kind === "first-step-ghost") return renderFirstStepGhost(node, context);
  if (!node.record) return null;
  return <LoopCompactStepNode context={context} record={node.record} records={node.records ?? [node.record]} />;
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
      className="relative flex size-[22px] items-center justify-center rounded border border-divider-strong bg-card text-tertiary"
    >
      <Route className="size-3" aria-hidden="true" />
      <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-sm bg-background/95 px-1 font-mono text-[0.66rem] leading-4">
        {label}
      </span>
    </div>
  );
}

function renderFirstStepGhost(node: LoopCanvasLayoutNode, context: LoopNodeContext) {
  const editable = (node.loopId ?? context.selectedLoopId) === context.selectedLoopId;
  return (
    <LoopGhostNode
      ariaLabel="Add first step"
      onClick={context.onAddFirstStep}
      disabled={!editable || !context.canAddFirstStep}
      className="nodrag"
    />
  );
}
