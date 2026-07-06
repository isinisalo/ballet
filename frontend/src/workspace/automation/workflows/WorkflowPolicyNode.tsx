import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { WorkflowStepRecord } from "./workflowGraph";
import type { WorkflowNodeContext } from "./WorkflowCanvasTypes";
import { WorkflowPolicySummary } from "./WorkflowPolicySummary";

export function WorkflowPolicyNode({
  context,
  record,
  records = [record]
}: {
  context: WorkflowNodeContext;
  record: WorkflowStepRecord;
  records?: WorkflowStepRecord[];
}) {
  const folded = records.length > 1;
  const stepDragClass = cn(
    "w-full select-none",
    folded ? "cursor-default" : "cursor-grab active:cursor-grabbing",
    !folded && context.draggedStepIndex === record.index && "opacity-60",
    !folded && context.dragOverStepIndex === record.index && context.draggedStepIndex !== record.index && "ring-2 ring-primary/20"
  );
  const selectedActionStepIndexSet = new Set(context.selectedActionStepIndexes);
  const selected = records.some((candidate) => selectedActionStepIndexSet.has(candidate.index));
  const title = record.policy?.action || record.policyId || "No policy";
  const nodeClassName = cn(
    "nodrag nopan flex h-[22px] w-full min-w-0 items-center rounded-md border border-divider-strong bg-card px-1.5 text-left font-mono text-[0.66rem] leading-4 text-foreground transition-colors hover:border-primary/80",
    selected && "border-primary/80 ring-2 ring-primary/20"
  );
  const content = (
    <>
      {record.policy ? (
        <WorkflowPolicySummary
          policy={record.policy}
          actionOptions={context.actionOptions}
          count={records.length}
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
    </>
  );

  return (
    <div
      data-workflow-step-index={folded ? undefined : record.index}
      onPointerDown={folded ? undefined : (event) => context.onStepPointerDown(event, record.index)}
      onPointerMove={context.onStepPointerMove}
      onPointerUp={context.onStepPointerUp}
      onPointerCancel={context.onStepPointerCancel}
      className={stepDragClass}
    >
      {record.policy ? (
        <button
          type="button"
          data-workflow-node
          aria-label={`Policy: ${record.policyId || "No policy"}`}
          title={title}
          className={cn(nodeClassName, "cursor-pointer")}
          onClick={(event) => {
            event.stopPropagation();
            context.onActionStepSelect(records);
          }}
        >
          {content}
        </button>
      ) : (
        <div
          data-workflow-node
          aria-label={`Policy: ${record.policyId || "No policy"}`}
          title={title}
          className={nodeClassName}
        >
          {content}
        </div>
      )}
    </div>
  );
}
