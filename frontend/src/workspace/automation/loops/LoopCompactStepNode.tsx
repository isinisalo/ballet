import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LoopStepRecord } from "./loopGraph";
import type { LoopNodeContext } from "./LoopCanvasTypes";
import { loopReasoningGlowLevel } from "./loopReasoningGlow";

const stepRunStatusClass: Record<string, string> = {
  queued: "border-tertiary/70 text-tertiary",
  running: "border-secondary text-secondary ring-2 ring-secondary/20",
  waiting_for_human: "border-tertiary text-tertiary ring-2 ring-tertiary/20",
  completed: "border-secondary/75 text-secondary ring-2 ring-secondary/15",
  failed: "border-destructive text-destructive ring-2 ring-destructive/20",
  cancelled: "border-destructive text-destructive ring-2 ring-destructive/20"
};

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

  return (
    <div
      data-loop-id={folded || !editable ? undefined : loopId}
      data-loop-step-index={folded || !editable ? undefined : record.index}
      onPointerDown={draggable ? (event) => context.onStepPointerDown(event, loopId, record.index) : undefined}
      onPointerMove={context.onStepPointerMove}
      onPointerUp={context.onStepPointerUp}
      onPointerCancel={context.onStepPointerCancel}
      className={cn(
        "h-full w-full select-none",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        draggable && context.draggedStepIndex === record.index && "opacity-60",
        draggable && context.dragOverStepIndex === record.index && context.draggedStepIndex !== record.index && "ring-2 ring-primary/20"
      )}
    >
      <CelestialStepButton context={context} record={record} records={records} selected={selected} />
    </div>
  );
}

function CelestialStepButton({ context, record, records, selected }: {
  context: LoopNodeContext;
  record: LoopStepRecord;
  records: LoopStepRecord[];
  selected: boolean;
}) {
  const title = record.step?.displayId || record.stepKey || "Missing step";
  const humanGate = record.step?.humanGate ?? false;
  const nodeStyle = humanGate ? "luna" : record.step?.nodeStyle ?? "terra";
  const reasoningGlow = humanGate ? 0 : loopReasoningGlowLevel(record.step?.reasoningEffort);
  const statusClass = record.step?.stepRun?.status ? stepRunStatusClass[record.step.stepRun.status] : undefined;

  return (
    <button
      type="button"
      data-loop-node
      data-loop-node-kind={humanGate ? "human" : "agent"}
      data-loop-node-style={nodeStyle}
      data-loop-reasoning-effort={record.step?.reasoningEffort}
      data-loop-reasoning-glow={reasoningGlow}
      aria-label={`${context.readOnly ? "View" : "Edit"} step ${title}`}
      title={title}
      className={cn(
        "loop-celestial-node nodrag nopan inline-flex h-full w-full items-center justify-center rounded-full border border-transparent transition-[border-color,box-shadow,filter]",
        humanGate && "border-tertiary/60",
        statusClass,
        selected && "border-primary/80 ring-2 ring-primary/20"
      )}
      onClick={(event) => {
        event.stopPropagation();
        context.onStepSelect(records);
      }}
    >
      <span aria-hidden="true" className="loop-celestial-reasoning-glow" />
      <span aria-hidden="true" className={`loop-celestial-surface loop-celestial-surface--${nodeStyle}`} />
      {humanGate ? <Shield aria-hidden="true" className="relative z-10 size-3.5 text-tertiary" strokeWidth={1.8} /> : null}
      <span
        aria-hidden="true"
        data-loop-node-label={title}
        className="pointer-events-none absolute top-full left-1/2 mt-2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-background/95 px-1 font-mono text-[0.66rem] leading-4 text-tertiary"
      >
        {title}
      </span>
    </button>
  );
}
