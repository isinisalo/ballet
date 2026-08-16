import type { CSSProperties } from "react";
import { BriefcaseBusiness, CalendarClock, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import { defaultLoopNodeSize, defaultLoopNodeStyle, loopNodeSizeCatalog } from "@shared/api/workspace-contracts";
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

export function LoopCompositeNode({ context, record, records = [record] }: {
  context: LoopNodeContext;
  record: LoopNodeRecord;
  records?: LoopNodeRecord[];
}) {
  const visual = record.node;
  if (!visual) return null;
  if (context.staticPreview || visual.terminal) return <CompactArtwork context={context} record={record} records={records} />;
  const definition = "type" in visual.definition ? undefined : visual.definition;
  if (!definition) return null;
  const loopId = record.loopId ?? context.selectedLoopId;
  const editable = !context.readOnly && loopId === context.selectedLoopId;
  const selected = records.some((candidate) => context.selectedNodeIndexes.includes(candidate.index));
  const status = visual.workLoopNodeRun?.status;
  return (
    <div
      data-loop-id={editable ? loopId : undefined}
      data-loop-node-index={editable ? record.index : undefined}
      className="h-full w-full"
      onPointerDown={editable ? (event) => context.onNodePointerDown(event, loopId, record.index) : undefined}
      onPointerMove={context.onNodePointerMove}
      onPointerUp={context.onNodePointerUp}
      onPointerCancel={context.onNodePointerCancel}
    >
      <button
        type="button"
        data-loop-node
        data-loop-node-kind="work-loop-node"
        data-loop-run-status={status}
        aria-label={`${context.readOnly ? "View" : "Edit"} Work Loop Node ${visual.displayId}`}
        className={cn(
          "loop-work-loop-node nodrag nopan grid h-full w-full grid-rows-[auto_1fr_auto] gap-2 rounded-lg border border-divider-strong bg-card p-3 text-left shadow-sm transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          status && runStatusClass[status],
          selected && "border-primary/80 ring-2 ring-primary/20",
          editable && "hover:border-primary/50"
        )}
        onClick={(event) => { event.stopPropagation(); context.onNodeSelect(records); }}
      >
        <span className="flex min-w-0 items-center justify-between gap-2"><strong className="truncate font-mono text-[0.68rem]">{visual.displayId}</strong><span className="font-mono text-[0.58rem] text-muted-foreground">max {definition.maxLocalAttempts}</span></span>
        <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <PhaseMark role="Work" active={visual.activeRole === "work"} node={definition.work} glowColor={loopThemeNodeGlow(context.theme)} reasoningEffort={visual.workReasoningEffort} />
          <span aria-label="Fixed Work completed to Validation edge" className="text-muted-foreground">→</span>
          <PhaseMark role="Validation" active={visual.activeRole === "validation"} node={definition.validation} glowColor={loopThemeNodeGlow(context.theme)} reasoningEffort={visual.validationReasoningEffort} />
        </span>
        <span className="flex items-center gap-1 font-mono text-[0.56rem] text-muted-foreground"><RotateCcw className="size-2.5 text-tertiary" /> FAIL / LOCAL_RETRY → Work · OK → edge</span>
      </button>
    </div>
  );
}

function PhaseMark({ role, active, node, glowColor, reasoningEffort }: {
  role: "Work" | "Validation";
  active: boolean;
  node: { type: string; nodeStyle: Parameters<typeof LoopNodeArtwork>[0]["nodeStyle"]; nodeSize: keyof typeof loopNodeSizeCatalog };
  glowColor: string;
  reasoningEffort?: string;
}) {
  const pixels = Math.min(loopNodeSizeCatalog[node.nodeSize].pixels, 36);
  const glow = reasoningEffort ? loopReasoningGlowLevel(reasoningEffort) : 0;
  return (
    <span data-active-node-role={active || undefined} className={cn(
      "grid min-w-0 grid-cols-[auto_1fr] items-center gap-2 rounded border px-2 py-1",
      role === "Work" ? "border-primary/30" : "border-secondary/30",
      active && (role === "Work" ? "border-primary ring-2 ring-primary/25" : "border-secondary ring-2 ring-secondary/25")
    )}>
      <span className="loop-artwork-node relative block shrink-0" data-loop-reasoning-glow={glow} style={{ width: pixels, height: pixels, "--loop-node-glow-color": glowColor } as CSSProperties}>
        <span aria-hidden="true" className="loop-node-reasoning-glow" /><LoopNodeArtwork nodeStyle={node.nodeStyle} />
      </span>
      <span className="grid min-w-0 gap-0.5"><span className={`flex items-center gap-1 font-mono text-[0.62rem] ${role === "Work" ? "text-primary" : "text-secondary"}`}>{role === "Work" ? <BriefcaseBusiness className="size-3" /> : <ShieldCheck className="size-3" />}{role}</span><span className="flex items-center gap-1 truncate font-mono text-[0.56rem] text-muted-foreground">{node.type === "scheduled" ? <CalendarClock className="size-2.5" /> : node.type === "human" ? <UserRound className="size-2.5" /> : null}{node.type}</span></span>
    </span>
  );
}

function CompactArtwork({ context, record, records }: { context: LoopNodeContext; record: LoopNodeRecord; records: LoopNodeRecord[] }) {
  const visual = record.node;
  const nodeStyle = visual?.nodeStyle ?? defaultLoopNodeStyle;
  const nodeSize = visual?.nodeSize ?? defaultLoopNodeSize;
  const selected = records.some((candidate) => context.selectedNodeIndexes.includes(candidate.index));
  const title = visual?.displayId ?? record.nodeKey;
  const className = cn("loop-artwork-node nodrag nopan inline-flex h-full w-full items-center justify-center rounded-full border border-transparent", selected && "border-primary/80 ring-2 ring-primary/20");
  const style = { "--loop-node-glow-color": loopThemeNodeGlow(context.theme) } as CSSProperties;
  const content = <><LoopNodeArtwork nodeStyle={nodeStyle} /><span aria-hidden="true" data-loop-node-label={title} className="pointer-events-none absolute top-full left-1/2 mt-2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-background/95 px-1 font-mono text-[0.66rem] text-[var(--loop-theme-node-label)]">{title}</span></>;
  if (context.staticPreview) return (
    <div role="img" data-loop-node data-loop-node-kind={visual?.terminal ? "terminal" : "artwork"} data-loop-node-size={nodeSize} data-loop-node-style={nodeStyle} aria-label={`Preview ${visual?.terminal ? "terminal" : "node"} ${title}`} className={className} style={style}>{content}</div>
  );
  return (
    <button type="button" data-loop-node data-loop-node-kind={visual?.terminal ? "terminal" : "artwork"} data-loop-node-size={nodeSize} data-loop-node-style={nodeStyle} aria-label={`View ${visual?.terminal ? "terminal" : "node"} ${title}`} className={className} style={style} onClick={() => context.onNodeSelect(records)}>{content}</button>
  );
}
