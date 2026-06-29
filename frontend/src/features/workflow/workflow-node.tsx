import { type ReactNode } from "react";
import { ArrowDown, ArrowRight, Bot, GitBranch, Route, type LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type WorkflowNodeId = "policy" | "agent" | "output";

const workflowNodeConfig: Record<WorkflowNodeId, {
  label: string;
  icon: LucideIcon;
}> = {
  policy: {
    label: "POLICY",
    icon: GitBranch
  },
  agent: {
    label: "AGENT",
    icon: Bot
  },
  output: {
    label: "OUTPUT EVENT",
    icon: Route
  }
};

const workflowOptionLabel = (options: Array<{ value: string; label: string }>, value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

const workflowEditorId = (node: WorkflowNodeId) => `workflow-${node}-editor`;

export function WorkflowNode({
  node,
  selected,
  value,
  options,
  onChange,
  onSelect,
  headerActions,
  footerActions,
  showSummaryLabel = true,
  showEditorHeader = true,
  showEditorValue = true,
  compactSummary = false,
  inlineSummary = false,
  summarySelect = false,
  children
}: {
  node: WorkflowNodeId;
  selected: boolean;
  value: string;
  options?: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
  onSelect: () => void;
  headerActions?: ReactNode;
  footerActions?: ReactNode;
  showSummaryLabel?: boolean;
  showEditorHeader?: boolean;
  showEditorValue?: boolean;
  compactSummary?: boolean;
  inlineSummary?: boolean;
  summarySelect?: boolean;
  children?: ReactNode;
}) {
  const config = workflowNodeConfig[node];
  const Icon = config.icon;
  const hasSelect = Boolean(options && onChange);
  const summaryActions = showEditorHeader ? null : headerActions;
  const renderSelect = (className?: string) => {
    if (!hasSelect || !options) return null;
    if (options.length === 0) {
      return (
        <span className={cn("flex h-8 w-full min-w-0 items-center justify-center rounded-md border border-border bg-background px-2 text-xs text-muted-foreground", className)}>
          No options
        </span>
      );
    }

    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn("h-8 min-w-0 px-2 text-xs shadow-none [&>span]:truncate", className)}>
          <SelectValue placeholder="Not selected" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  };

  return (
    <div
      data-workflow-node="true"
      className={cn(
        "flex min-w-0 flex-col rounded-lg border border-border bg-card text-card-foreground transition md:basis-0 md:grow md:shrink",
        selected && "border-ring bg-accent/40 ring-2 ring-ring/30 md:grow-[2]"
      )}
    >
      <div className="relative">
        {summarySelect && hasSelect && selected ? (
          <div
            className={cn(
              "flex w-full min-w-0 rounded-lg px-3 outline-none transition hover:bg-accent",
              inlineSummary
                ? "min-h-12 flex-row items-center justify-start gap-2 py-2 text-left"
                : "flex-col items-center justify-center gap-2 text-center",
              !inlineSummary && (compactSummary ? "min-h-20 py-3" : "min-h-24 py-4"),
              summaryActions && "pr-12"
            )}
            aria-controls={workflowEditorId(node)}
            aria-expanded={selected}
            onClick={onSelect}
          >
            <Icon className={cn("shrink-0 text-muted-foreground", inlineSummary ? "size-4" : "size-5")} aria-hidden="true" />
            {showSummaryLabel ? (
              <span className="max-w-full truncate text-[0.7rem] font-semibold uppercase leading-none tracking-normal text-foreground">
                {config.label}
              </span>
            ) : null}
            {renderSelect("w-full flex-1 bg-background")}
          </div>
        ) : (
          <button
            type="button"
            className={cn(
              "flex w-full min-w-0 rounded-lg px-3 outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40",
              inlineSummary
                ? "min-h-12 flex-row items-center justify-start gap-2 py-2 text-left"
                : "flex-col items-center justify-center gap-2 text-center",
              !inlineSummary && (compactSummary ? "min-h-20 py-3" : "min-h-24 py-4"),
              summaryActions && "pr-12"
            )}
            aria-controls={workflowEditorId(node)}
            aria-expanded={selected}
            aria-pressed={selected}
            onClick={onSelect}
          >
            <Icon className={cn("shrink-0 text-muted-foreground", inlineSummary ? "size-4" : "size-5")} aria-hidden="true" />
            {showSummaryLabel ? (
              <span className="max-w-full truncate text-[0.7rem] font-semibold uppercase leading-none tracking-normal text-foreground">
                {config.label}
              </span>
            ) : null}
            <span className={cn("max-w-full truncate font-mono leading-none text-muted-foreground", inlineSummary ? "text-xs" : "text-[0.68rem]")}>
              {workflowOptionLabel(options ?? [], value) || "Not selected"}
            </span>
          </button>
        )}
        {summaryActions ? (
          <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2">
            {summaryActions}
          </div>
        ) : null}
      </div>

      <div
        id={workflowEditorId(node)}
        hidden={!selected}
        className={cn("min-w-0 border-t border-divider-strong p-3 pt-3", !selected && "hidden")}
      >
        {showEditorHeader ? (
          <div className={cn("grid items-start gap-3", headerActions ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1")}>
            <div className="flex min-w-0 items-center gap-2">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate text-xs font-semibold uppercase leading-none tracking-normal text-foreground">{config.label}</span>
            </div>
            {headerActions ? <div className="shrink-0 justify-self-end">{headerActions}</div> : null}
          </div>
        ) : null}
        <div className={cn("grid gap-3", showEditorHeader && "mt-3")}>
          {summarySelect || !showEditorValue ? null : hasSelect && options ? (
            renderSelect("w-full")
          ) : (
            <span className="max-w-full truncate font-mono text-[0.68rem] leading-none text-muted-foreground">{value || "Not selected"}</span>
          )}
          {children ? <div className={cn("min-w-0", !summarySelect && showEditorValue && "border-t border-divider-strong pt-3")}>{children}</div> : null}
        </div>
      </div>
      {selected && footerActions ? (
        <div className="flex min-h-12 items-center justify-end border-t border-divider-strong px-3 py-2">
          {footerActions}
        </div>
      ) : null}
    </div>
  );
}

export function WorkflowConnector() {
  return (
    <div className="flex h-6 shrink-0 items-center justify-center text-muted-foreground md:h-12 md:w-8" aria-hidden="true" data-workflow-connector="true">
      <ArrowDown className="size-5 md:hidden" />
      <ArrowRight className="hidden size-6 md:block" />
    </div>
  );
}
