import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { LoopStepRecord } from "./loopGraph";
import type { LoopNodeContext } from "./LoopCanvasTypes";
import { LoopPolicySummary } from "./LoopPolicySummary";

export function LoopPolicyNode({
  context,
  record,
  records = [record]
}: {
  context: LoopNodeContext;
  record: LoopStepRecord;
  records?: LoopStepRecord[];
}) {
  const folded = records.length > 1;
  const loopId = record.loopId ?? context.selectedLoopId;
  const editable = loopId === context.selectedLoopId;
  const stepDragClass = cn(
    "w-full select-none",
    folded || !editable ? "cursor-default" : "cursor-grab active:cursor-grabbing",
    !folded && editable && context.draggedStepIndex === record.index && "opacity-60",
    !folded && editable && context.dragOverStepIndex === record.index && context.draggedStepIndex !== record.index && "ring-2 ring-primary/20"
  );
  const selectedActionStepIndexSet = new Set(context.selectedActionStepIndexes);
  const selected = editable && records.some((candidate) => selectedActionStepIndexSet.has(candidate.index));
  const title = record.policy?.action || record.policyId || "No policy";
  const humanGate = Boolean(record.policy ? context.actionById.get(record.policy.action)?.humanGate : false);
  const nodeClassName = cn(
    "nodrag nopan flex h-[22px] w-full min-w-0 items-center rounded-md border border-divider-strong bg-card px-1.5 text-left font-mono text-[0.66rem] leading-4 text-foreground transition-colors hover:border-primary/80",
    humanGate && "border-tertiary/60",
    selected && "border-primary/80 ring-2 ring-primary/20"
  );
  const content = (
    <>
      {record.policy ? (
        <LoopPolicySummary
          policy={record.policy}
          actionOptions={context.actionOptions}
          count={records.length}
          humanGate={humanGate}
        />
      ) : editable ? (
        <Select value={record.policyId || context.noSelectionValue} onValueChange={(value) => context.onPolicyChange(loopId, record.index, value === context.noSelectionValue ? "" : value)}>
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
      ) : (
        <span className="block min-w-0 truncate">{record.policyId || "No policy"}</span>
      )}
    </>
  );

  return (
    <div
      data-loop-id={folded || !editable ? undefined : loopId}
      data-loop-step-index={folded || !editable ? undefined : record.index}
      onPointerDown={folded || !editable ? undefined : (event) => context.onStepPointerDown(event, loopId, record.index)}
      onPointerMove={context.onStepPointerMove}
      onPointerUp={context.onStepPointerUp}
      onPointerCancel={context.onStepPointerCancel}
      className={stepDragClass}
    >
      {record.policy && editable ? (
        <button
          type="button"
          data-loop-node
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
          data-loop-node
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
