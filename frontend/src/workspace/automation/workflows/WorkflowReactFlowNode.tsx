import { Route, Zap } from "lucide-react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { workflowTriggerLabel } from "./workflowGraph";
import { workflowAddActionGhostLabel, workflowCanvasNodeAnchorY, type WorkflowCanvasLayoutNode } from "./workflowLayout";
import { WorkflowGhostNode } from "./WorkflowGhostNode";
import { WorkflowPolicyNode } from "./WorkflowPolicyNode";
import type { WorkflowNodeContext, WorkflowReactFlowNode } from "./WorkflowCanvasTypes";

export function WorkflowReactFlowNodeComponent({ data }: NodeProps<WorkflowReactFlowNode>) {
  const { layoutNode, context, activeHandleIds } = data;

  return (
    <div className="workflow-react-flow-node nopan flex h-full w-full items-center">
      <WorkflowNodeHandles activeHandleIds={activeHandleIds} layoutNode={layoutNode} />
      {renderNodeContent(layoutNode, context)}
    </div>
  );
}

function WorkflowNodeHandles({ activeHandleIds, layoutNode }: { activeHandleIds: string[]; layoutNode: WorkflowCanvasLayoutNode }) {
  const anchorTop = workflowCanvasNodeAnchorY(layoutNode);
  const activeHandleIdSet = new Set(activeHandleIds);

  return (
    <>
      {activeHandleIdSet.has("left") ? <Handle id="left" type="target" position={Position.Left} isConnectable={false} className="workflow-react-flow-handle" style={{ top: anchorTop }} /> : null}
      {activeHandleIdSet.has("right") ? <Handle id="right" type="source" position={Position.Right} isConnectable={false} className="workflow-react-flow-handle" style={{ top: anchorTop }} /> : null}
      {activeHandleIdSet.has("top") ? <Handle id="top" type="target" position={Position.Top} isConnectable={false} className="workflow-react-flow-handle" style={{ left: "50%" }} /> : null}
      {activeHandleIdSet.has("bottom") ? <Handle id="bottom" type="source" position={Position.Bottom} isConnectable={false} className="workflow-react-flow-handle" style={{ left: "50%" }} /> : null}
    </>
  );
}

function renderNodeContent(node: WorkflowCanvasLayoutNode, context: WorkflowNodeContext) {
  if (node.kind === "trigger") return renderTriggerNode(context);
  if (node.kind === "first-policy-ghost") return renderFirstPolicyGhost(context);
  if (node.kind === "output-event") return renderOutputEventNode(node, context);
  if (!node.record) return null;
  return <WorkflowPolicyNode context={context} record={node.record} />;
}

function renderTriggerNode(context: WorkflowNodeContext) {
  const value = workflowTriggerLabel(context.firstPolicy);

  return (
    <div
      data-workflow-node
      aria-label={`Trigger: ${value}`}
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

function renderFirstPolicyGhost(context: WorkflowNodeContext) {
  return (
    <WorkflowGhostNode
      value="Add first policy"
      icon={Route}
      ariaLabel="Add first policy"
      onClick={() => context.onAddPolicyStep()}
      disabled={!context.canAddFirstPolicy}
      className="nodrag w-60"
    />
  );
}

function renderOutputEventNode(node: WorkflowCanvasLayoutNode, context: WorkflowNodeContext) {
  const outputEvent = node.outputEvent;
  const eventType = outputEvent?.eventType ?? "Output event";
  const sourcePolicy = node.sourcePolicyId ? context.policyById.get(node.sourcePolicyId) : undefined;

  return (
    <button
      type="button"
      data-workflow-output-event={eventType}
      aria-label={`Add policy step for ${eventType}`}
      title={`Add action for ${eventType}`}
      disabled={!context.canAddPolicyForEvent(sourcePolicy)}
      onClick={() => context.onAddPolicyStep(eventType, sourcePolicy)}
      className="nodrag nopan flex h-[22px] w-full min-w-0 items-center rounded-md border border-dashed border-muted-foreground/50 bg-background/60 px-1.5 text-left font-mono text-[0.66rem] leading-4 text-muted-foreground opacity-60 transition-colors hover:border-primary/65 hover:bg-card hover:text-foreground hover:opacity-85 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-muted-foreground/50 disabled:hover:bg-background/60"
    >
      <span className="block min-w-0 truncate">{workflowAddActionGhostLabel}</span>
    </button>
  );
}
