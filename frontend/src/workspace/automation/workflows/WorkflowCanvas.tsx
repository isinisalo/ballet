import { Activity, Pencil, Route, Save, Trash2, Zap } from "lucide-react";
import type { ProjectPolicy } from "../../../../../shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { workflowTriggerLabel, type WorkflowStepRecord } from "./workflowGraph";
import {
  workflowConnectorPath,
  type WorkflowCanvasEdge,
  type WorkflowCanvasLayout,
  type WorkflowCanvasLayoutNode
} from "./workflowLayout";
import { WorkflowCanvasNode } from "./WorkflowCanvasNode";
import { WorkflowGhostNode } from "./WorkflowGhostNode";
import { WorkflowPolicySummary } from "./WorkflowPolicySummary";

type Option = { value: string; label: string };

export function WorkflowCanvas({
  layout,
  policyById,
  firstPolicy,
  noSelectionValue,
  policyOptions,
  agentOptions,
  actionOptions,
  draggedStepIndex,
  dragOverStepIndex,
  canvasOffset,
  canvasHeight,
  isCanvasPanning,
  workflowCanvasRef,
  canAddFirstPolicy,
  canAddPolicyForEvent,
  onStepPointerDown,
  onStepPointerMove,
  onStepPointerUp,
  onStepPointerCancel,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onCanvasPointerCancel,
  onPolicyChange,
  onAgentChange,
  onActionChange,
  onSavePolicy,
  onEditPolicy,
  onDeleteStep,
  onAddPolicyStep
}: {
  layout: WorkflowCanvasLayout;
  policyById: Map<string, ProjectPolicy>;
  firstPolicy?: ProjectPolicy;
  noSelectionValue: string;
  policyOptions: Option[];
  agentOptions: Option[];
  actionOptions: Option[];
  draggedStepIndex: number | null;
  dragOverStepIndex: number | null;
  canvasOffset: { x: number; y: number };
  canvasHeight: number | null;
  isCanvasPanning: boolean;
  workflowCanvasRef: React.RefObject<HTMLDivElement>;
  canAddFirstPolicy: boolean;
  canAddPolicyForEvent: (policy?: ProjectPolicy) => boolean;
  onStepPointerDown: (event: React.PointerEvent<HTMLDivElement>, index: number) => void;
  onStepPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onStepPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onStepPointerCancel: () => void;
  onCanvasPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerCancel: () => void;
  onPolicyChange: (index: number, policyId: string) => void;
  onAgentChange: (record: WorkflowStepRecord, agent: string) => void;
  onActionChange: (record: WorkflowStepRecord, action: string) => void;
  onSavePolicy: () => void;
  onEditPolicy: (index: number) => void;
  onDeleteStep: (index: number) => void;
  onAddPolicyStep: (eventType?: string, sourcePolicy?: ProjectPolicy) => void;
}) {
  const renderNode = (node: WorkflowCanvasLayoutNode) => (
    <div key={node.key} className="absolute flex items-center" style={{ transform: `translate(${node.x}px, ${node.y}px)`, width: node.width, height: node.height }}>
      {renderNodeContent(node)}
    </div>
  );

  const renderNodeContent = (node: WorkflowCanvasLayoutNode) => {
    if (node.kind === "trigger") {
      return (
        <WorkflowCanvasNode
          label="Trigger"
          value={workflowTriggerLabel(firstPolicy)}
          tone="trigger"
          icon={Zap}
          dashed={!firstPolicy}
          className="w-44"
        />
      );
    }

    if (node.kind === "first-policy-ghost") {
      return <WorkflowGhostNode value="Add first policy" icon={Route} ariaLabel="Add first policy" onClick={() => onAddPolicyStep()} disabled={!canAddFirstPolicy} className="w-60" />;
    }

    if (!node.record) return null;
    const record = node.record;

    if (node.kind === "save-policy") {
      return (
        <Button type="button" size="icon-sm" aria-label="Save workflow policy" title="Save workflow policy" onClick={onSavePolicy}>
          <Save data-icon="inline-start" />
        </Button>
      );
    }

    if (node.kind === "edit-policy") {
      return (
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label="Edit workflow policy"
          title="Edit workflow policy"
          onClick={() => onEditPolicy(record.index)}
        >
          <Pencil data-icon="inline-start" />
        </Button>
      );
    }

    if (node.kind === "delete-policy") {
      return (
        <Button type="button" size="icon-sm" variant="destructive" aria-label="Remove workflow step" title="Remove workflow step" onClick={() => onDeleteStep(record.index)}>
          <Trash2 data-icon="inline-start" />
        </Button>
      );
    }

    if (node.kind === "event-ghost" && node.eventType) {
      const sourcePolicy = node.sourcePolicyId ? policyById.get(node.sourcePolicyId) : undefined;
      return (
        <WorkflowGhostNode
          value={node.eventType}
          icon={Activity}
          ariaLabel={`Add policy step for ${node.eventType}`}
          onClick={() => onAddPolicyStep(node.eventType, sourcePolicy)}
          disabled={!canAddPolicyForEvent(sourcePolicy)}
          className="w-60"
        />
      );
    }

    const stepDragClass = cn(
      "cursor-grab select-none active:cursor-grabbing",
      draggedStepIndex === record.index && "opacity-60",
      dragOverStepIndex === record.index && draggedStepIndex !== record.index && "ring-2 ring-primary/20"
    );

    return (
      <div
        data-workflow-step-index={record.index}
        onPointerDown={(event) => onStepPointerDown(event, record.index)}
        onPointerMove={onStepPointerMove}
        onPointerUp={onStepPointerUp}
        onPointerCancel={onStepPointerCancel}
        className={stepDragClass}
      >
        <WorkflowCanvasNode
          label="Policy"
          tone="policy"
          icon={Route}
          value={record.policyId || "No policy"}
          dashed={!record.policy}
          className="h-[5.75rem] w-60 max-w-none items-start py-2"
        >
          {record.policy ? (
            <WorkflowPolicySummary
              policy={record.policy}
              editing={Boolean(node.isEditingPolicy)}
              agentOptions={agentOptions}
              actionOptions={actionOptions}
              noSelectionValue={noSelectionValue}
              onAgentChange={(agent) => onAgentChange(record, agent)}
              onActionChange={(action) => onActionChange(record, action)}
            />
          ) : (
            <Select value={record.policyId || noSelectionValue} onValueChange={(value) => onPolicyChange(record.index, value === noSelectionValue ? "" : value)}>
              <SelectTrigger className="h-6 w-full min-w-0 px-1.5 font-mono text-[0.64rem]" title={record.policyId || "No policy"} onDragStart={(event) => event.stopPropagation()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {policyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </WorkflowCanvasNode>
      </div>
    );
  };

  return (
    <div
      ref={workflowCanvasRef}
      data-workflow-canvas
      className={cn("relative min-h-[28rem] overflow-hidden rounded-lg border border-divider-strong bg-background", isCanvasPanning ? "cursor-grabbing" : "cursor-grab")}
      style={{ height: canvasHeight ? `${canvasHeight}px` : undefined }}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
      onPointerCancel={onCanvasPointerCancel}
    >
      <div className="pointer-events-none absolute inset-0 opacity-50 bg-[image:linear-gradient(to_right,var(--divider-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--divider-strong)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div
        className="absolute left-0 top-0 min-w-max select-none"
        style={{ transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`, width: layout.width, height: layout.height }}
      >
        <svg className="pointer-events-none absolute inset-0 overflow-visible" width={layout.width} height={layout.height} aria-hidden="true">
          <defs>
            <marker id="workflow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 8 4 L 0 8 z" className="fill-primary/70" />
            </marker>
            <marker id="workflow-arrow-muted" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 8 4 L 0 8 z" className="fill-muted-foreground/70" />
            </marker>
          </defs>
          {layout.edges.map((edge) => <WorkflowCanvasEdgePath key={edge.key} edge={edge} />)}
        </svg>
        {layout.nodes.map(renderNode)}
      </div>
    </div>
  );
}

function WorkflowCanvasEdgePath({ edge }: { edge: WorkflowCanvasEdge }) {
  return (
    <path
      data-workflow-connector
      data-dashed={edge.dashed ? "true" : "false"}
      d={workflowConnectorPath(edge)}
      className={cn("fill-none stroke-primary/70 stroke-2", edge.dashed && "stroke-muted-foreground/70")}
      strokeDasharray={edge.dashed ? "6 5" : undefined}
      markerEnd={edge.dashed ? "url(#workflow-arrow-muted)" : "url(#workflow-arrow)"}
    />
  );
}
