import { cn } from "@/lib/utils";
import type { LoopStepRecord } from "./loopGraph";
import type { LoopNodeContext } from "./LoopCanvasTypes";

export function LoopActionNode({
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
  const stepDragClass = loopStepDragClassName({ context, record, folded, editable });
  const selectedActionStepIndexSet = new Set(context.selectedActionStepIndexes);
  const selected = editable && records.some((candidate) => selectedActionStepIndexSet.has(candidate.index));
  const title = record.action?.id || record.actionId || "No action";
  const nodeClassName = loopActionNodeClassName({ missing: !record.action, humanGate: Boolean(record.action?.humanGate), selected });
  const ariaLabel = `Action: ${title}${records.length > 1 ? ` x${records.length}` : ""}`;

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
      {record.action && editable ? (
        <button
          type="button"
          data-loop-node
          aria-label={ariaLabel}
          title={title}
          className={cn(nodeClassName, "cursor-pointer")}
          onClick={(event) => {
            event.stopPropagation();
            context.onActionStepSelect(records);
          }}
        />
      ) : (
        <div
          data-loop-node
          aria-label={ariaLabel}
          title={title}
          className={nodeClassName}
        />
      )}
    </div>
  );
}

function loopStepDragClassName({
  context,
  record,
  folded,
  editable
}: {
  context: LoopNodeContext;
  record: LoopStepRecord;
  folded: boolean;
  editable: boolean;
}) {
  const draggable = !folded && editable;
  return cn(
    "w-full select-none",
    draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
    draggable && context.draggedStepIndex === record.index && "opacity-60",
    draggable && context.dragOverStepIndex === record.index && context.draggedStepIndex !== record.index && "ring-2 ring-primary/20"
  );
}

function loopActionNodeClassName({ missing, humanGate, selected }: { missing: boolean; humanGate: boolean; selected: boolean }) {
  return cn(
    "nodrag nopan block size-[22px] rounded border border-divider-strong bg-card transition-colors hover:border-primary/80",
    missing && "border-dashed border-muted-foreground/50 bg-background/60",
    humanGate && "border-tertiary/60",
    selected && "border-primary/80 ring-2 ring-primary/20"
  );
}
