import type { ReactNode } from "react";
import { ChevronRight, Orbit } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EngineeringLevel } from "../types";
import { automationGraphNodePath, automationGraphPath, automationJobNodePath } from "../routing";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";

const labels: Record<EngineeringLevel, string> = {
  graph: "Graph Engineering",
  graph_node: "Graph Node",
  job_node: "Job Node"
};

export function EngineeringShell({
  level,
  graphNodeId,
  graphNodeTitle,
  jobNodeId,
  jobNodeTitle,
  actions,
  navigate,
  children
}: {
  level: EngineeringLevel;
  graphNodeId?: string;
  graphNodeTitle?: string;
  jobNodeId?: string;
  jobNodeTitle?: string;
  actions?: ReactNode;
  navigate: WorkspaceNavigation["navigate"];
  children: ReactNode;
}) {
  return (
    <section className="flex h-[calc(100svh-2.75rem)] min-h-0 min-w-0 flex-none flex-col overflow-hidden md:h-svh" aria-labelledby="engineering-title">
      <header className="grid shrink-0 gap-1.5 border-b border-divider-strong bg-card px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Orbit className="size-4 shrink-0 text-secondary" aria-hidden="true" />
            <h1 id="engineering-title" className="truncate font-heading text-base font-medium sm:text-lg">{labels[level]}</h1>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              {level === "graph" ? "Graph Nodes and global routing" : level === "graph_node" ? "Job Nodes and local routing" : "Work, Validation and retry"}
            </span>
          </div>
          {actions ? <div className="no-scrollbar flex shrink-0 items-center gap-2 overflow-x-auto">{actions}</div> : null}
        </div>
        <nav aria-label="Engineering breadcrumb" className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto font-mono text-[0.6875rem] text-muted-foreground">
          <Button type="button" variant="ghost" size="xs" className="h-6 px-1.5" onClick={() => navigate(automationGraphPath())}>
            Graph Engineering
          </Button>
          {graphNodeId ? <>
            <ChevronRight className="size-3 shrink-0" />
            <Button type="button" variant="ghost" size="xs" className="h-6 max-w-52 px-1.5" onClick={() => navigate(automationGraphNodePath(graphNodeId))}>
              <span className="truncate">{graphNodeTitle ?? graphNodeId}</span>
            </Button>
          </> : null}
          {graphNodeId && jobNodeId ? <>
            <ChevronRight className="size-3 shrink-0" />
            <Button type="button" variant="ghost" size="xs" className="h-6 max-w-52 px-1.5" onClick={() => navigate(automationJobNodePath(graphNodeId, jobNodeId))}>
              <span className="truncate text-foreground">{jobNodeTitle ?? jobNodeId}</span>
            </Button>
          </> : null}
        </nav>
      </header>
      <div className="flex min-h-0 flex-1">{children}</div>
    </section>
  );
}
