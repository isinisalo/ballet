import { AlertTriangle, Bot, CheckCircle2, GitBranch, Radio, Route, Sparkles } from "lucide-react";
import type { FlowVisualNode } from "./flow-layout";
import { StatusPill } from "@/design-system/components/StatusPill";
import { cn } from "@/lib/utils";
import type { FlowSelection } from "@/features/flows/model/flow-page-model";

const kindIcon = {
  event: Radio,
  routing: GitBranch,
  operation: Bot,
  emission: Sparkles,
  terminal: CheckCircle2
};

const kindClass = {
  event: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  routing: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  operation: "border-indigo-300/35 bg-indigo-300/10 text-indigo-100",
  emission: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  terminal: "border-green-300/30 bg-green-300/10 text-green-100"
};

const statusTone = {
  active: "success",
  draft: "neutral",
  invalid: "danger",
  warning: "warning",
  terminal: "success"
} as const;

export function FlowNodeCard({
  node,
  selected,
  onSelect
}: {
  node: FlowVisualNode;
  selected?: FlowSelection;
  onSelect: (selection: FlowSelection) => void;
}) {
  const Icon = kindIcon[node.kind];
  const isSelected = selected?.kind === node.selection.kind && selected.id === node.selection.id;
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={node.ariaLabel}
      data-flow-kind={node.kind}
      className={cn(
        "grid min-h-36 w-full gap-3 rounded-lg border p-3 text-left shadow-[0_18px_70px_rgba(0,0,0,0.18)] transition",
        kindClass[node.kind],
        isSelected && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background"
      )}
      onClick={() => onSelect(node.selection)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-md border border-current/20 bg-black/20">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.68rem] font-semibold uppercase text-current/70">{node.label}</span>
            <span className="block truncate font-semibold text-foreground">{node.title}</span>
          </span>
        </div>
        {node.diagnosticCount ? <AlertTriangle className="size-4 shrink-0 text-amber-200" /> : <Route className="size-4 shrink-0 text-current/50" />}
      </div>
      <p className="line-clamp-2 font-mono text-xs leading-5 text-muted-foreground">{node.subtitle}</p>
      <StatusPill tone={statusTone[node.status]}>{node.status}</StatusPill>
    </button>
  );
}
