import type { ReactNode } from "react";
import { Boxes, ChevronRight, Focus, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { automationCompositionPath, automationContextPath, automationLoopPath } from "../routing";
import type { LoopEngineerLevel } from "../types";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";

const levelCopy: Record<LoopEngineerLevel, { label: string; description: string; icon: typeof Network }> = {
  context: {
    label: "Context",
    description: "Read-only project intent, Loop system summary, and declared outcomes.",
    icon: Network
  },
  composition: {
    label: "Level 1 · Loops",
    description: "Compose ProjectLoops as black boxes and edit project-global Loop Edges.",
    icon: Boxes
  },
  detail: {
    label: "Level 2 · Detail",
    description: "Design one selected Loop's Work Loop Nodes and internal Edges.",
    icon: Focus
  }
};

export function LoopEngineerShell({ level, selectedLoopId, selectedLoopTitle, selectedLoopDescription, actions, navigate, children }: {
  level: LoopEngineerLevel;
  selectedLoopId?: string;
  selectedLoopTitle?: string;
  selectedLoopDescription?: string;
  actions?: ReactNode;
  navigate: WorkspaceNavigation["navigate"];
  children: ReactNode;
}) {
  const active = levelCopy[level];
  return (
    <section className="grid min-w-0" aria-labelledby="loop-engineer-title">
      <header className="grid gap-3 border-b border-divider-strong bg-card px-4 py-4 sm:px-5">
        <div className="grid min-w-0 gap-3 sm:flex sm:flex-wrap sm:items-start">
          <div className="min-w-0 flex-1">
            <h1 id="loop-engineer-title" className="font-heading text-2xl font-semibold tracking-tight">Loop Engineer</h1>
            <p className="mt-1 text-sm text-muted-foreground">{active.description}</p>
            {level === "detail" && selectedLoopId ? (
              <div className="mt-2 min-w-0">
                <p className="truncate text-sm font-medium">{selectedLoopTitle ?? selectedLoopId}</p>
                {selectedLoopTitle && selectedLoopTitle !== selectedLoopId ? <p className="truncate font-mono text-[0.68rem] text-muted-foreground">{selectedLoopId}</p> : null}
                {selectedLoopDescription ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{selectedLoopDescription}</p> : null}
              </div>
            ) : null}
          </div>
          {actions ? <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:justify-end">{actions}</div> : null}
        </div>
        <nav aria-label="Loop Engineer breadcrumb" className="flex min-w-0 items-center gap-1 overflow-hidden font-mono text-[0.68rem] text-muted-foreground">
          <span>Automation</span><ChevronRight className="size-3 shrink-0" /><span>Loop Engineer</span><ChevronRight className="size-3 shrink-0" />
          <span className="truncate text-foreground">{active.label}{level === "detail" && selectedLoopId ? ` · ${selectedLoopTitle ?? selectedLoopId}` : ""}</span>
        </nav>
        <nav aria-label="Loop Engineer levels" className="flex max-w-full gap-1 overflow-x-auto rounded border border-divider-strong bg-background p-1">
          {(Object.keys(levelCopy) as LoopEngineerLevel[]).map((candidate) => {
            const definition = levelCopy[candidate];
            const Icon = definition.icon;
            const detailAvailable = Boolean(selectedLoopId) || level === "detail";
            const disabled = candidate === "detail" && !detailAvailable;
            return (
              <Button
                key={candidate}
                type="button"
                size="sm"
                variant={candidate === level ? "secondary" : "ghost"}
                aria-current={candidate === level ? "page" : undefined}
                disabled={disabled}
                className={cn("min-w-fit flex-1", candidate === level && "border border-primary/30")}
                title={disabled ? "Select a Loop in Level 1 before opening detail." : definition.description}
                onClick={() => {
                  if (candidate === "context") navigate(automationContextPath());
                  if (candidate === "composition") navigate(automationCompositionPath(selectedLoopId));
                  if (candidate === "detail" && selectedLoopId) navigate(automationLoopPath(selectedLoopId));
                }}
              >
                <Icon /> {definition.label}{candidate === "detail" && selectedLoopId ? ` · ${selectedLoopTitle ?? selectedLoopId}` : ""}
              </Button>
            );
          })}
        </nav>
      </header>
      {children}
    </section>
  );
}
