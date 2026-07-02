import { Activity, Pencil, Route, Save, Trash2, Zap } from "lucide-react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { workflowTriggerLabel, type WorkflowStepRecord } from "./workflowGraph";
import { workflowCanvasLayoutConfig, type WorkflowCanvasLayoutNode } from "./workflowLayout";
import { WorkflowCanvasNode } from "./WorkflowCanvasNode";
import { WorkflowGhostNode } from "./WorkflowGhostNode";
import { WorkflowPolicySummary } from "./WorkflowPolicySummary";
import type { WorkflowNodeContext, WorkflowReactFlowNode } from "./WorkflowCanvasTypes";

export function WorkflowReactFlowNodeComponent({ data }: NodeProps<WorkflowReactFlowNode>) {
  const { layoutNode, context } = data;

  return (
    <div className="workflow-react-flow-node nopan flex h-full w-full items-center">
      <WorkflowNodeHandles layoutNode={layoutNode} />
      {renderNodeContent(layoutNode, context)}
    </div>
  );
}

function WorkflowNodeHandles({ layoutNode }: { layoutNode: WorkflowCanvasLayoutNode }) {
  const anchorTop = layoutNode.kind === "policy"
    ? workflowCanvasLayoutConfig.policyAnchorY
    : layoutNode.height / 2;

  return (
    <>
      <Handle id="left" type="target" position={Position.Left} isConnectable={false} className="workflow-react-flow-handle" style={{ top: anchorTop }} />
      <Handle id="right" type="source" position={Position.Right} isConnectable={false} className="workflow-react-flow-handle" style={{ top: anchorTop }} />
    </>
  );
}

function renderNodeContent(node: WorkflowCanvasLayoutNode, context: WorkflowNodeContext) {
  if (node.kind === "trigger") return renderTriggerNode(context);
  if (node.kind === "first-policy-ghost") return renderFirstPolicyGhost(context);
  if (!node.record) return null;
  if (node.kind === "save-policy" || node.kind === "edit-policy" || node.kind === "delete-policy") return renderPolicyActionNode(node, context, node.record);
  if (node.kind === "handled-event-ghost" || node.kind === "event-ghost") return renderEventNode(node, context);
  return renderPolicyNode(node, context, node.record);
}

function renderTriggerNode(context: WorkflowNodeContext) {
  return (
    <WorkflowCanvasNode
      label="Trigger"
      value={workflowTriggerLabel(context.firstPolicy)}
      tone="trigger"
      icon={Zap}
      dashed={!context.firstPolicy}
      className="w-44"
    />
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

function renderPolicyActionNode(node: WorkflowCanvasLayoutNode, context: WorkflowNodeContext, record: WorkflowStepRecord) {
  if (node.kind === "save-policy") {
    return (
      <Button type="button" size="icon-sm" aria-label="Save workflow policy" title="Save workflow policy" onClick={context.onSavePolicy} className="nodrag">
        <Save data-icon="inline-start" />
      </Button>
    );
  }

  if (node.kind === "edit-policy") {
    return (
      <Button type="button" size="icon-sm" variant="outline" aria-label="Edit workflow policy" title="Edit workflow policy" onClick={() => context.onEditPolicy(record.index)} className="nodrag">
        <Pencil data-icon="inline-start" />
      </Button>
    );
  }

  return (
    <Button type="button" size="icon-sm" variant="destructive" aria-label="Remove workflow step" title="Remove workflow step" onClick={() => context.onDeleteStep(record.index)} className="nodrag">
      <Trash2 data-icon="inline-start" />
    </Button>
  );
}

function renderEventNode(node: WorkflowCanvasLayoutNode, context: WorkflowNodeContext) {
  if (node.kind === "handled-event-ghost" && node.eventType) {
    return <WorkflowCanvasNode label="Event" value={node.eventType} tone="event" icon={Activity} dashed className="w-60" />;
  }

  if (node.kind !== "event-ghost" || !node.eventType) return null;
  const sourcePolicy = node.sourcePolicyId ? context.policyById.get(node.sourcePolicyId) : undefined;

  return (
    <WorkflowGhostNode
      value={node.eventType}
      icon={Activity}
      ariaLabel={`Add policy step for ${node.eventType}`}
      onClick={() => context.onAddPolicyStep(node.eventType, sourcePolicy)}
      disabled={!context.canAddPolicyForEvent(sourcePolicy)}
      className="nodrag w-60"
    />
  );
}

function renderPolicyNode(node: WorkflowCanvasLayoutNode, context: WorkflowNodeContext, record: WorkflowStepRecord) {
  const stepDragClass = cn(
    "cursor-grab select-none active:cursor-grabbing",
    context.draggedStepIndex === record.index && "opacity-60",
    context.dragOverStepIndex === record.index && context.draggedStepIndex !== record.index && "ring-2 ring-primary/20"
  );

  return (
    <div
      data-workflow-step-index={record.index}
      onPointerDown={(event) => context.onStepPointerDown(event, record.index)}
      onPointerMove={context.onStepPointerMove}
      onPointerUp={context.onStepPointerUp}
      onPointerCancel={context.onStepPointerCancel}
      className={stepDragClass}
    >
      <WorkflowCanvasNode label="Policy" tone="policy" icon={Route} value={record.policyId || "No policy"} dashed={!record.policy} className="h-[5.75rem] w-60 max-w-none items-start py-2">
        {record.policy ? renderPolicySummary(node, context, record) : renderMissingPolicySelect(context, record)}
      </WorkflowCanvasNode>
    </div>
  );
}

function renderPolicySummary(node: WorkflowCanvasLayoutNode, context: WorkflowNodeContext, record: WorkflowStepRecord) {
  if (!record.policy) return null;

  return (
    <WorkflowPolicySummary
      policy={record.policy}
      editing={Boolean(node.isEditingPolicy)}
      agentOptions={context.agentOptions}
      actionOptions={context.actionOptions}
      noSelectionValue={context.noSelectionValue}
      onAgentChange={(agent) => context.onAgentChange(record, agent)}
      onActionChange={(action) => context.onActionChange(record, action)}
    />
  );
}

function renderMissingPolicySelect(context: WorkflowNodeContext, record: WorkflowStepRecord) {
  return (
    <Select value={record.policyId || context.noSelectionValue} onValueChange={(value) => context.onPolicyChange(record.index, value === context.noSelectionValue ? "" : value)}>
      <SelectTrigger className="nodrag h-6 w-full min-w-0 px-1.5 font-mono text-[0.64rem]" title={record.policyId || "No policy"} onDragStart={(event) => event.stopPropagation()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {context.policyOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
