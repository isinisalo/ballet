import { useEffect, useRef, type ReactNode } from "react";
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
  const canvasFirst = level === "context" || level === "composition";
  const levelNavigationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    levelNavigationRef.current?.querySelector<HTMLElement>("[aria-current=page]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [level, selectedLoopId]);
  return (
    <section className={cn(
      "min-w-0",
      canvasFirst ? "flex min-h-0 flex-1 flex-col md:h-svh md:max-h-svh md:overflow-hidden" : "grid"
    )} aria-labelledby="loop-engineer-title">
      <header data-loop-engineer-header className="grid shrink-0 gap-1.5 border-b border-divider-strong bg-card px-3 py-2 sm:px-4">
        <div data-loop-engineer-row="primary" className="grid min-w-0 gap-1 sm:flex sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <h1 id="loop-engineer-title" className="shrink-0 font-heading text-lg font-medium leading-6 tracking-tight">Loop Engineer</h1>
            <p className="min-w-24 flex-1 truncate text-xs text-muted-foreground" title={active.description}>{active.description}</p>
            {level === "detail" && selectedLoopId ? <div className="hidden min-w-0 items-baseline gap-1.5 lg:flex">
              <span className="truncate text-xs font-medium" title={selectedLoopTitle ?? selectedLoopId}>{selectedLoopTitle ?? selectedLoopId}</span>
              {selectedLoopTitle && selectedLoopTitle !== selectedLoopId ? <span className="truncate font-mono text-[0.65rem] text-muted-foreground" title={selectedLoopId}>{selectedLoopId}</span> : null}
              {selectedLoopDescription ? <span className="max-w-72 truncate text-xs text-muted-foreground" title={selectedLoopDescription}>· {selectedLoopDescription}</span> : null}
            </div> : null}
          </div>
          {actions ? <div aria-label="Loop Engineer actions" className="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto sm:shrink-0 sm:justify-end max-sm:[&_[data-slot=button]]:h-10">{actions}</div> : null}
        </div>
        <div data-loop-engineer-row="navigation" className="grid min-w-0 gap-1.5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-3">
          <nav aria-label="Loop Engineer breadcrumb" className="flex min-w-0 items-center gap-1 overflow-hidden font-mono text-[0.65rem] leading-4 text-muted-foreground sm:max-w-72">
            <span>Automation</span><ChevronRight className="size-3 shrink-0" /><span>Loop Engineer</span><ChevronRight className="size-3 shrink-0" />
            <span className="truncate text-foreground">{active.label}{level === "detail" && selectedLoopId ? ` · ${selectedLoopTitle ?? selectedLoopId}` : ""}</span>
          </nav>
          <nav ref={levelNavigationRef} aria-label="Loop Engineer levels" className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded border border-divider-strong bg-background p-0.5">
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
                  className={cn("min-w-fit flex-1 max-sm:h-10", candidate === level && "border border-primary/30")}
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
        </div>
      </header>
      {canvasFirst ? <div className="flex min-h-0 flex-1 flex-col md:overflow-hidden">{children}</div> : children}
    </section>
  );
}
