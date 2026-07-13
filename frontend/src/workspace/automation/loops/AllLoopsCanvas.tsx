import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { getProjectStepTransitionTargets } from "@shared/api/workspace-contracts";
import { ArrowRight, Bot, CalendarClock, PanelTopOpen, Route, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AllLoopsCanvas({
  config,
  onAddLoop,
  onOpenLoop
}: {
  config: ProjectAutomationConfig;
  onAddLoop: () => void;
  onOpenLoop: (loopId: string) => void;
}) {
  return (
    <div className="grid gap-px bg-divider-strong sm:grid-cols-2 xl:grid-cols-3" aria-label="All loops">
      <Button
        type="button"
        variant="ghost"
        aria-label="+ Add loop"
        className="grid min-h-28 place-items-center rounded-none border border-dashed border-muted-foreground/50 bg-background/60 font-mono text-xs text-muted-foreground opacity-60 transition-colors hover:border-primary/65 hover:bg-card hover:text-foreground hover:opacity-85 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        onClick={onAddLoop}
      >
        + Add loop
      </Button>
      {config.loops.map((loop) => {
        const humanSteps = loop.steps.filter((step) => step.type === "human").length;
        const agentSteps = loop.steps.filter((step) => step.type === "agent").length;
        const scheduledSteps = loop.steps.filter((step) => step.type === "scheduled").length;
        const nextLoops = new Set(loop.steps.flatMap(getProjectStepTransitionTargets)
          .flatMap((target) => typeof target === "object" && "loop" in target ? [target.loop] : []));
        return (
          <article
            key={loop.id}
            className="grid min-h-28 bg-card"
          >
            <div className="grid gap-3 p-4">
              <span className="flex items-center gap-2 font-mono text-xs text-foreground"><Route className="text-primary" /> {loop.id}</span>
              <span className="grid grid-cols-3 gap-2 font-mono text-[0.65rem] text-muted-foreground">
                <span className="flex items-center gap-1"><Bot className="size-3" /> {agentSteps} agent</span>
                <span className="flex items-center gap-1"><ShieldCheck className="size-3" /> {humanSteps} human</span>
                <span className="flex items-center gap-1"><CalendarClock className="size-3" /> {scheduledSteps} scheduled</span>
                <span className="col-span-3">start: {loop.start}</span>
              </span>
              {nextLoops.size > 0 ? <span className="flex items-center gap-1 truncate font-mono text-[0.65rem] text-secondary"><ArrowRight className="size-3" /> {[...nextLoops].join(", ")}</span> : null}
            </div>
            <div className="flex items-center gap-2 border-t border-divider-strong p-2">
              <Button type="button" size="sm" className="flex-1" aria-label={`Open loop ${loop.id}`} onClick={() => onOpenLoop(loop.id)}>
                <PanelTopOpen /> Open loop
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
