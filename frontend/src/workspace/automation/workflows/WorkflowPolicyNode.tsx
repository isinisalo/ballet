import { Route } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { WorkflowStepRecord } from "./workflowGraph";
import type { WorkflowCanvasLayoutNode } from "./workflowLayout";
import type { WorkflowNodeContext } from "./WorkflowCanvasTypes";
import { WorkflowPolicySummary } from "./WorkflowPolicySummary";

export function WorkflowPolicyNode({
  node,
  context,
  record
}: {
  node: WorkflowCanvasLayoutNode;
  context: WorkflowNodeContext;
  record: WorkflowStepRecord;
}) {
  const stepDragClass = cn(
    "cursor-grab select-none active:cursor-grabbing",
    context.draggedStepIndex === record.index && "opacity-60",
    context.dragOverStepIndex === record.index && context.draggedStepIndex !== record.index && "ring-2 ring-primary/20"
  );
  const title = record.policy?.action || record.policyId || "No policy";

  return (
    <div
      data-workflow-step-index={record.index}
      onPointerDown={(event) => context.onStepPointerDown(event, record.index)}
      onPointerMove={context.onStepPointerMove}
      onPointerUp={context.onStepPointerUp}
      onPointerCancel={context.onStepPointerCancel}
      className={stepDragClass}
    >
      <div
        data-workflow-node
        aria-label={`Policy: ${record.policyId || "No policy"}`}
        title={title}
        className="nodrag nopan flex h-[22px] w-full min-w-0 items-center gap-1.5 rounded-md border border-divider-strong bg-card px-1.5 text-left font-mono text-[0.66rem] leading-4 text-foreground transition-colors hover:border-primary/80"
      >
        <Route className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
        {record.policy ? (
          <WorkflowPolicySummary
            policy={record.policy}
            editing={Boolean(node.isEditingPolicy)}
            actionOptions={context.actionOptions}
            noSelectionValue={context.noSelectionValue}
            onActionChange={(action) => context.onActionChange(record, action)}
          />
        ) : (
          <Select value={record.policyId || context.noSelectionValue} onValueChange={(value) => context.onPolicyChange(record.index, value === context.noSelectionValue ? "" : value)}>
            <SelectTrigger className="nodrag h-[18px] min-h-[18px] w-full min-w-0 border-0 bg-transparent px-0 py-0 font-mono text-[0.62rem] shadow-none focus-visible:ring-0" title={record.policyId || "No policy"} onDragStart={(event) => event.stopPropagation()}>
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
        )}
      </div>
    </div>
  );
}
