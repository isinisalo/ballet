import type { CSSProperties } from "react";
import { CalendarClock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LoopStepRecord } from "./loopGraph";
import type { LoopNodeContext } from "./LoopCanvasTypes";
import { loopReasoningGlowLevel } from "./loopReasoningGlow";
import { loopThemeNodeGlow } from "./loopTheme";
import { AgentAvatarIcon } from "../../agents/agentAvatars";
const stepRunStatusClass: Record<string, string> = {
  queued: "border-tertiary/70 text-tertiary",
  running: "border-secondary text-secondary ring-2 ring-secondary/20",
  waiting_for_human: "border-tertiary text-tertiary ring-2 ring-tertiary/20",
  completed: "border-secondary/75 text-secondary ring-2 ring-secondary/15",
  failed: "border-destructive text-destructive ring-2 ring-destructive/20",
  cancelled: "border-destructive text-destructive ring-2 ring-destructive/20"
};
const stepRunPulseClass: Record<string, string> = {
  running: "loop-run-node-pulse--running",
  waiting_for_human: "loop-run-node-pulse--waiting"
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
  const draggable = !folded && editable && !record.step?.scheduled;
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
      <StepNodeButton context={context} record={record} records={records} selected={selected} />
    </div>
  );
}

function StepNodeButton({ context, record, records, selected }: {
  context: LoopNodeContext;
  record: LoopStepRecord;
  records: LoopStepRecord[];
  selected: boolean;
}) {
  const model = stepNodeModel(record, context);
  const className = cn(
    "loop-step-node nodrag nopan inline-flex h-full w-full items-center justify-center rounded-full border border-transparent transition-[border-color,box-shadow,filter]",
    model.borderClass,
    model.statusClass,
    model.pulseClass,
    selected && "border-primary/80 ring-2 ring-primary/20"
  );
  const content = (
    <>
      <span aria-hidden="true" className="loop-node-reasoning-glow" />
      <span aria-hidden="true" className={`loop-node-surface loop-node-surface--${model.renderer}`} />
      <StepNodeMark kind={model.kind} avatar={model.showAvatar ? model.avatar : undefined} />
      <StepNodeLabel title={model.title} scheduleLabel={model.scheduleLabel} />
    </>
  );

  if (context.staticPreview) {
    return (
      <div
        role="img"
        aria-label={`Preview step ${model.title}`}
        data-loop-node
        data-loop-node-kind={model.kind}
        data-loop-node-size={model.nodeSize}
        data-loop-node-renderer={model.renderer}
        className={className}
        style={{ "--loop-node-glow-color": model.glowColor } as CSSProperties}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-loop-node
      data-loop-node-kind={model.kind}
      data-loop-node-size={model.nodeSize}
      data-loop-node-renderer={model.renderer}
      data-loop-reasoning-effort={model.reasoningEffort}
      data-loop-reasoning-glow={model.reasoningGlow}
      data-loop-run-status={model.status}
      aria-label={`${context.readOnly ? "View" : "Edit"} step ${model.title}`}
      title={model.tooltip}
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        context.onStepSelect(records);
      }}
      style={{ "--loop-node-glow-color": model.glowColor } as CSSProperties}
    >
      {content}
    </button>
  );
}

type StepNodeKind = "agent" | "human" | "scheduled";
function stepNodeModel(record: LoopStepRecord, context: LoopNodeContext) {
  const step = record.step;
  if (!step) return {
    title: record.stepKey || "Missing step",
    kind: "agent" as const,
    nodeSize: "medium" as const,
    renderer: context.theme.node.styles.medium,
    glowColor: loopThemeNodeGlow(context.theme),
    tooltip: record.stepKey || "Missing step",
    reasoningGlow: 0
  };
  const title = step.displayId || record.stepKey || "Missing step";
  const kind: StepNodeKind = step.scheduled ? "scheduled" : step.humanGate ? "human" : "agent";
  const nodeSize = step.nodeSize;
  const status = step.stepRun?.status;
  const scheduleLabel = step.scheduleLabel;
  return {
    title,
    kind,
    nodeSize,
    renderer: context.theme.node.styles[nodeSize],
    glowColor: loopThemeNodeGlow(context.theme),
    avatar: step.avatar,
    showAvatar: kind === "agent" && context.theme.node.showAgentAvatarInNode && Boolean(step.avatar),
    scheduleLabel,
    tooltip: scheduleLabel ? `${title} · ${scheduleLabel}` : title,
    reasoningEffort: step.reasoningEffort,
    reasoningGlow: kind === "agent" ? loopReasoningGlowLevel(step.reasoningEffort) : 0,
    borderClass: kind === "human" ? "border-tertiary/60" : kind === "scheduled" ? "border-muted-foreground/55" : undefined,
    status,
    statusClass: status ? stepRunStatusClass[status] : undefined,
    pulseClass: status ? stepRunPulseClass[status] : undefined
  };
}

function StepNodeMark({ kind, avatar }: { kind: StepNodeKind; avatar?: NonNullable<LoopStepRecord["step"]>["avatar"] }) {
  if (kind === "human") return <Shield aria-hidden="true" className="relative z-10 size-3.5 text-tertiary" strokeWidth={1.8} />;
  if (kind === "scheduled") return <CalendarClock aria-hidden="true" className="relative z-10 size-3.5 text-muted-foreground" strokeWidth={1.8} />;
  if (avatar) return <AgentAvatarIcon avatar={avatar} className="loop-agent-avatar relative z-10 text-[var(--loop-theme-node-label)]" />;
  return null;
}

function StepNodeLabel({ title, scheduleLabel }: { title: string; scheduleLabel?: string }) {
  return (
    <span aria-hidden="true" data-loop-node-label={title} className="pointer-events-none absolute top-full left-1/2 mt-2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-background/95 px-1 font-mono text-[0.66rem] leading-4 text-[var(--loop-theme-node-label)]">
      <span className="block">{title}</span>
      {scheduleLabel ? <span data-loop-node-schedule-label={scheduleLabel} className="block max-w-64 overflow-hidden text-ellipsis text-muted-foreground">{scheduleLabel}</span> : null}
    </span>
  );
}
