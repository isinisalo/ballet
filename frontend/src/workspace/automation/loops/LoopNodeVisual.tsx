import type { CSSProperties } from "react";
import { BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { defaultLoopNodeSize, defaultLoopNodeStyle } from "@shared/api/workspace-contracts";
import { cn } from "@/lib/utils";
import type { LoopNodeContext } from "./LoopCanvasTypes";
import { LoopNodeArtwork } from "./LoopNodeArtwork";
import type { LoopNodeRecord } from "./loopGraph";
import { loopReasoningGlowLevel } from "./loopReasoningGlow";
import { loopThemeNodeGlow } from "./loopTheme";

const runStatusClass: Record<string, string> = {
  queued: "border-tertiary/70",
  running: "border-secondary ring-2 ring-secondary/20 loop-run-node-pulse--running",
  waiting_for_input: "border-tertiary ring-2 ring-tertiary/20 loop-run-node-pulse--waiting",
  completed: "border-secondary/75 ring-2 ring-secondary/15",
  blocked: "border-destructive ring-2 ring-destructive/20",
  failed: "border-destructive ring-2 ring-destructive/20",
  cancelled: "border-destructive ring-2 ring-destructive/20"
};

export function LoopNodeVisual({ context, record, records = [record] }: {
  context: LoopNodeContext;
  record: LoopNodeRecord;
  records?: LoopNodeRecord[];
}) {
  const state = visualState(context, record, records);
  return context.staticPreview
    ? <StaticNodeVisual state={state} />
    : <InteractiveNodeVisual context={context} record={record} records={records} state={state} />;
}

type VisualState = ReturnType<typeof visualState>;

function StaticNodeVisual({ state }: { state: VisualState }) {
  return (
    <div
      role="img"
      data-loop-node
      data-loop-node-kind={state.terminal ? "terminal" : "artwork"}
      data-loop-node-size={state.nodeSize}
      data-loop-node-style={state.nodeStyle}
      aria-label={`Preview ${state.terminal ? "terminal" : "node"} ${state.title}`}
      title={state.title}
      className="loop-artwork-node relative inline-flex h-full w-full items-center justify-center rounded-full border border-transparent"
      style={state.style}
    >
      <LoopNodeArtwork nodeStyle={state.nodeStyle} />
      <NodeLabel title={state.title} />
    </div>
  );
}

function InteractiveNodeVisual({ context, record, records, state }: {
  context: LoopNodeContext;
  record: LoopNodeRecord;
  records: LoopNodeRecord[];
  state: VisualState;
}) {
  const loopId = record.loopId ?? context.selectedLoopId;
  const editable = !context.readOnly && !state.terminal && loopId === context.selectedLoopId;
  const action = state.terminal ? "View terminal" : `${context.readOnly ? "View" : "Edit"} Work Loop Node`;

  return (
    <div
      data-loop-id={editable ? loopId : undefined}
      data-loop-node-index={editable ? record.index : undefined}
      className="relative h-full w-full"
      onPointerDown={editable ? (event) => context.onNodePointerDown(event, loopId, record.index) : undefined}
      onPointerMove={context.onNodePointerMove}
      onPointerUp={context.onNodePointerUp}
      onPointerCancel={context.onNodePointerCancel}
    >
      <button
        type="button"
        data-loop-node
        data-loop-node-kind={state.terminal ? "terminal" : "work-loop-node"}
        data-loop-node-size={state.nodeSize}
        data-loop-node-style={state.nodeStyle}
        data-loop-run-status={state.status}
        data-loop-reasoning-glow={state.reasoningGlow}
        aria-label={`${action} ${state.title}${state.activeRole ? `, active ${state.activeRole}` : ""}`}
        title={state.title}
        className={cn(
          "loop-artwork-node nodrag nopan relative inline-flex h-full w-full items-center justify-center rounded-full border border-transparent bg-transparent p-0 outline-none",
          state.status && runStatusClass[state.status],
          state.selected && "border-primary/80 ring-2 ring-primary/20",
          editable && "hover:border-primary/50"
        )}
        style={state.style}
        onClick={(event) => { event.stopPropagation(); context.onNodeSelect(records); }}
      >
        <span aria-hidden="true" className="loop-node-reasoning-glow" />
        <LoopNodeArtwork nodeStyle={state.nodeStyle} />
        {context.readOnly && !state.terminal ? <RunCharacterFace mood={runCharacterMood(state.status)} /> : null}
      </button>
      {state.activeRole ? <ActiveRoleMark role={state.activeRole} /> : null}
      <NodeLabel title={state.title} />
    </div>
  );
}

export type RunCharacterMood = "ready" | "focused" | "waiting" | "happy" | "sad" | "quiet";

export function runCharacterMood(status?: string): RunCharacterMood {
  if (status === "running") return "focused";
  if (status === "waiting_for_input") return "waiting";
  if (status === "completed") return "happy";
  if (status === "blocked" || status === "failed" || status === "cancelled") return "sad";
  if (status === "queued") return "ready";
  return "quiet";
}

function RunCharacterFace({ mood }: { mood: RunCharacterMood }) {
  return (
    <span aria-hidden="true" className="loop-run-character-face" data-run-character data-run-character-mood={mood}>
      <span className="loop-run-character-eye loop-run-character-eye--left" />
      <span className="loop-run-character-eye loop-run-character-eye--right" />
      <span className="loop-run-character-mouth" />
    </span>
  );
}

function visualState(context: LoopNodeContext, record: LoopNodeRecord, records: LoopNodeRecord[]) {
  const visual = record.node;
  const activeRole = visual?.activeRole === "work" || visual?.activeRole === "validation" ? visual.activeRole : undefined;
  const reasoningEffort = activeRole === "validation" ? visual?.validationReasoningEffort : visual?.workReasoningEffort;
  return {
    nodeStyle: visual?.nodeStyle ?? defaultLoopNodeStyle,
    nodeSize: visual?.nodeSize ?? defaultLoopNodeSize,
    terminal: visual?.terminal === true,
    title: visual?.displayId ?? record.nodeKey,
    selected: records.some((candidate) => context.selectedNodeIndexes.includes(candidate.index)),
    activeRole,
    reasoningGlow: reasoningEffort ? loopReasoningGlowLevel(reasoningEffort) : 0,
    status: visual?.workLoopNodeRun?.status,
    style: { "--loop-node-glow-color": loopThemeNodeGlow(context.theme) } as CSSProperties
  };
}

function ActiveRoleMark({ role }: { role: "work" | "validation" }) {
  const label = role === "work" ? "Active Work" : "Active Validation";
  const Icon = role === "work" ? BriefcaseBusiness : ShieldCheck;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-active-node-role={role}
      className={cn(
        "pointer-events-none absolute -top-1 -right-1 z-10 flex size-4 items-center justify-center rounded-full border bg-background",
        role === "work" ? "border-primary text-primary" : "border-secondary text-secondary"
      )}
    >
      <Icon className="size-2.5" aria-hidden="true" />
    </span>
  );
}

function NodeLabel({ title }: { title: string }) {
  return (
    <span
      aria-hidden="true"
      data-loop-node-label={title}
      title={title}
      className="pointer-events-none absolute top-full left-1/2 mt-2 max-w-48 -translate-x-1/2 truncate rounded-sm bg-background/95 px-1 font-mono text-[0.66rem] text-[var(--loop-theme-node-label)]"
    >
      {title}
    </span>
  );
}
