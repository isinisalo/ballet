import { useEffect, useRef, type ReactNode } from "react";
import { Boxes, ChevronRight, Focus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { automationGraphPath, automationLoopPath } from "../routing";
import type { EngineeringView } from "../types";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";

const viewCopy: Record<EngineeringView, { label: string; description: string; icon: typeof Boxes }> = {
  graph: {
    label: "Graph Engineering",
    description: "Compose project-global LoopNodes and route policy.",
    icon: Boxes
  },
  loop: {
    label: "Loop Engineering",
    description: "Design one selected Loop's Work Loop Nodes and internal Edges.",
    icon: Focus
  }
};

export function EngineeringShell({ view, selectedLoopId, selectedLoopTitle, selectedLoopDescription, actions, navigate, children }: {
  view: EngineeringView;
  selectedLoopId?: string;
  selectedLoopTitle?: string;
  selectedLoopDescription?: string;
  actions?: ReactNode;
  navigate: WorkspaceNavigation["navigate"];
  children: ReactNode;
}) {
  const active = viewCopy[view];
  const canvasFirst = view === "graph";
  const viewNavigationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    viewNavigationRef.current?.querySelector<HTMLElement>("[aria-current=page]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [view, selectedLoopId]);
  return (
    <section className={cn(
      "min-w-0",
      canvasFirst ? "flex min-h-0 flex-1 flex-col md:h-svh md:max-h-svh md:overflow-hidden" : "grid"
    )} aria-labelledby="engineering-title">
      <header data-engineering-header className="grid shrink-0 gap-1.5 border-b border-divider-strong bg-card px-3 py-2 sm:px-4">
        <div data-engineering-row="primary" className="grid min-w-0 gap-1 sm:flex sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <h1 id="engineering-title" className="shrink-0 font-heading text-lg font-medium leading-6 tracking-tight">{active.label}</h1>
            <p className="min-w-24 flex-1 truncate text-xs text-muted-foreground" title={active.description}>{active.description}</p>
            {view === "loop" && selectedLoopId ? <div className="hidden min-w-0 items-baseline gap-1.5 lg:flex">
              <span className="truncate text-xs font-medium" title={selectedLoopTitle ?? selectedLoopId}>{selectedLoopTitle ?? selectedLoopId}</span>
              {selectedLoopTitle && selectedLoopTitle !== selectedLoopId ? <span className="truncate font-mono text-[0.65rem] text-muted-foreground" title={selectedLoopId}>{selectedLoopId}</span> : null}
              {selectedLoopDescription ? <span className="max-w-72 truncate text-xs text-muted-foreground" title={selectedLoopDescription}>· {selectedLoopDescription}</span> : null}
            </div> : null}
          </div>
          {actions ? <div aria-label={`${active.label} actions`} className="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto sm:shrink-0 sm:justify-end max-sm:[&_[data-slot=button]]:h-10">{actions}</div> : null}
        </div>
        <div data-engineering-row="navigation" className="grid min-w-0 gap-1.5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-3">
          <nav aria-label="Engineering breadcrumb" className="flex min-w-0 items-center gap-1 overflow-hidden font-mono text-[0.65rem] leading-4 text-muted-foreground sm:max-w-72">
            <span>Automation</span><ChevronRight className="size-3 shrink-0" />
            <span className="truncate text-foreground">{active.label}{view === "loop" && selectedLoopId ? ` · ${selectedLoopTitle ?? selectedLoopId}` : ""}</span>
          </nav>
          <nav ref={viewNavigationRef} aria-label="Engineering views" className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded border border-divider-strong bg-background p-0.5">
            {(Object.keys(viewCopy) as EngineeringView[]).map((candidate) => {
              const definition = viewCopy[candidate];
              const Icon = definition.icon;
              const loopAvailable = Boolean(selectedLoopId) || view === "loop";
              const disabled = candidate === "loop" && !loopAvailable;
              return (
                <Button
                  key={candidate}
                  type="button"
                  size="sm"
                  variant={candidate === view ? "secondary" : "ghost"}
                  aria-current={candidate === view ? "page" : undefined}
                  disabled={disabled}
                  className={cn("min-w-fit flex-1 max-sm:h-10", candidate === view && "border border-primary/30")}
                  title={disabled ? "Select a Loop in Graph Engineering before opening Loop Engineering." : definition.description}
                  onClick={() => {
                    if (candidate === "graph") navigate(automationGraphPath());
                    if (candidate === "loop" && selectedLoopId) navigate(automationLoopPath(selectedLoopId));
                  }}
                >
                  <Icon /> {definition.label}{candidate === "loop" && selectedLoopId ? ` · ${selectedLoopTitle ?? selectedLoopId}` : ""}
                </Button>
              );
            })}
          </nav>
        </div>
      </header>
      {canvasFirst ? <div className="flex min-h-0 flex-1 flex-col md:overflow-hidden">{children}</div> : children}
    </section>
  );
}
