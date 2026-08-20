import type { CSSProperties, KeyboardEvent } from "react";
import {
  loopNodeSizeCatalog,
  type ProjectJobNode
} from "@shared/api/workspace-contracts";
import { BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoopNodeArtwork } from "./LoopNodeArtwork";

const runStatusClass: Record<string, string> = {
  queued: "border-tertiary/70",
  running: "border-secondary ring-2 ring-secondary/20 loop-run-node-pulse--running",
  waiting_for_input: "border-tertiary ring-2 ring-tertiary/20 loop-run-node-pulse--waiting",
  completed: "border-secondary/75 ring-2 ring-secondary/15",
  blocked: "border-destructive ring-2 ring-destructive/20",
  failed: "border-destructive ring-2 ring-destructive/20",
  cancelled: "border-destructive ring-2 ring-destructive/20"
};

export function workflowNodeRadius(node: ProjectJobNode): number {
  return loopNodeSizeCatalog[node.nodeSize].pixels / 2;
}

export function WorkflowNodeVisual({
  x, y, node, pairedValidationId, activeRole, selected, readOnly, status, reasoningGlow, glowColor, onSelect
}: {
  x: number;
  y: number;
  node: ProjectJobNode;
  pairedValidationId: string;
  activeRole: "job" | "validation";
  selected: boolean;
  readOnly: boolean;
  status?: string;
  reasoningGlow: number;
  glowColor: string;
  onSelect: () => void;
}) {
  const diameter = workflowNodeRadius(node) * 2;
  const activate = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  };
  const style = {
    width: diameter,
    height: diameter,
    "--loop-node-glow-color": glowColor
  } as CSSProperties;

  return (
    <foreignObject x={x - 92} y={y - diameter / 2 - 8} width="184" height={diameter + 52}>
      <div className="relative flex h-full w-full items-start justify-center pt-2">
        <button
          type="button"
          data-workflow-node="job"
          data-workflow-node-id={node.id}
          data-paired-validation-id={pairedValidationId}
          data-active-workflow-role={activeRole}
          data-loop-node-size={node.nodeSize}
          data-loop-node-style={node.nodeStyle}
          data-loop-reasoning-glow={reasoningGlow}
          data-run-status={status}
          aria-label={`${readOnly ? "View" : "Edit"} Job Node ${node.id}, includes Validation ${pairedValidationId}${status ? `, Run status ${status}` : ""}`}
          disabled={readOnly}
          className={cn(
            "loop-artwork-node group relative shrink-0 rounded-full border border-transparent bg-transparent p-0 outline-none disabled:opacity-100",
            status && runStatusClass[status],
            selected && "border-primary/80 ring-2 ring-primary/25",
            !readOnly && "hover:border-primary/50 focus-visible:border-primary"
          )}
          style={style}
          onClick={onSelect}
          onKeyDown={readOnly ? undefined : activate}
        >
          <span aria-hidden="true" className="loop-node-reasoning-glow" />
          <LoopNodeArtwork nodeStyle={node.nodeStyle} />
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 z-10 grid size-4 place-items-center rounded-full border border-primary/70 bg-background/95 text-primary"
          >
            <BriefcaseBusiness className="size-2.5" />
          </span>
          <span
            aria-hidden="true"
            title={`Paired Validation ${pairedValidationId}`}
            className={cn(
              "absolute -right-1 bottom-0 z-10 grid size-3.5 place-items-center rounded-full border bg-background/95",
              activeRole === "validation" ? "border-secondary text-secondary" : "border-divider-strong text-muted-foreground"
            )}
          >
            <ShieldCheck className="size-2" />
          </span>
          <span
            aria-hidden="true"
            title={node.id}
            className="pointer-events-none absolute top-full left-1/2 mt-2 max-w-44 -translate-x-1/2 truncate rounded-sm bg-background/95 px-1 font-mono text-[0.66rem] text-[var(--loop-theme-node-label)]"
          >
            {node.id}
          </span>
        </button>
      </div>
    </foreignObject>
  );
}
