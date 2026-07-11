import { Bot, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LoopStepRecord } from "./loopGraph";
import type { LoopNodeContext } from "./LoopCanvasTypes";

export function LoopCompactStepNode({
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
  const editable = !context.readOnly && loopId === context.selectedLoopId;
  const draggable = !folded && editable;
  const selectedStepIndexSet = new Set(context.selectedStepIndexes);
  const selected = records.some((candidate) => selectedStepIndexSet.has(candidate.index));
  const title = record.step?.displayId || record.stepKey || "Missing step";
  const stepRun = record.step?.stepRun;
  const ariaLabel = `${context.readOnly ? "View" : "Edit"} step ${title}`;

  return (
    <div
      data-loop-id={folded || !editable ? undefined : loopId}
      data-loop-step-index={folded || !editable ? undefined : record.index}
      onPointerDown={draggable ? (event) => context.onStepPointerDown(event, loopId, record.index) : undefined}
      onPointerMove={context.onStepPointerMove}
      onPointerUp={context.onStepPointerUp}
      onPointerCancel={context.onStepPointerCancel}
      className={cn(
        "w-full select-none",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        draggable && context.draggedStepIndex === record.index && "opacity-60",
        draggable && context.dragOverStepIndex === record.index && context.draggedStepIndex !== record.index && "ring-2 ring-primary/20"
      )}
    >
      <button
        type="button"
        data-loop-node
        aria-label={ariaLabel}
        title={title}
        className={cn(
          "nodrag nopan inline-flex size-[22px] items-center justify-center rounded border border-divider-strong bg-card transition-colors hover:border-primary/80",
          record.step?.humanGate && "border-tertiary/60",
          stepRun?.status === "queued" && "border-tertiary/70 text-tertiary",
          stepRun?.status === "running" && "border-secondary text-secondary ring-2 ring-secondary/20",
          stepRun?.status === "waiting_for_human" && "border-tertiary text-tertiary ring-2 ring-tertiary/20",
          stepRun?.status === "completed" && "border-secondary/75 text-secondary ring-2 ring-secondary/15",
          (stepRun?.status === "failed" || stepRun?.status === "cancelled") && "border-destructive text-destructive ring-2 ring-destructive/20",
          selected && "border-primary/80 ring-2 ring-primary/20"
        )}
        onClick={(event) => {
          event.stopPropagation();
          context.onStepSelect(records);
        }}
      >
        {record.step?.humanGate
          ? <Shield aria-hidden="true" className="size-3 text-tertiary" strokeWidth={1.8} />
          : <Bot aria-hidden="true" className="size-3 text-primary/85" strokeWidth={1.8} />}
      </button>
    </div>
  );
}
