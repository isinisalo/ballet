import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { getProjectStepTransitionTargets } from "@shared/api/workspace-contracts";
import { ArrowRight, Bot, CalendarClock, Route, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AllLoopsCanvas({
  config,
  onSelect
}: {
  config: ProjectAutomationConfig;
  onSelect: (loopId: string) => void;
}) {
  if (config.loops.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No loops configured.</p>;
  }

  return (
    <div className="grid gap-px bg-divider-strong sm:grid-cols-2 xl:grid-cols-3" aria-label="All loops">
      {config.loops.map((loop) => {
        const humanSteps = loop.steps.filter((step) => step.type === "human").length;
        const agentSteps = loop.steps.filter((step) => step.type === "agent").length;
        const scheduledSteps = loop.steps.filter((step) => step.type === "scheduled").length;
        const nextLoops = new Set(loop.steps.flatMap(getProjectStepTransitionTargets)
          .flatMap((target) => typeof target === "object" && "loop" in target ? [target.loop] : []));
        return (
          <Button
            key={loop.id}
            type="button"
            variant="ghost"
            className="h-auto min-h-28 justify-start rounded-none bg-card p-4 text-left hover:bg-muted"
            onClick={() => onSelect(loop.id)}
          >
            <span className="grid w-full gap-3">
              <span className="flex items-center gap-2 font-mono text-xs text-foreground"><Route className="text-primary" /> {loop.id}</span>
              <span className="grid grid-cols-3 gap-2 font-mono text-[0.65rem] text-muted-foreground">
                <span className="flex items-center gap-1"><Bot className="size-3" /> {agentSteps} agent</span>
                <span className="flex items-center gap-1"><ShieldCheck className="size-3" /> {humanSteps} human</span>
                <span className="flex items-center gap-1"><CalendarClock className="size-3" /> {scheduledSteps} scheduled</span>
                <span className="col-span-3">start: {loop.start}</span>
              </span>
              {nextLoops.size > 0 ? <span className="flex items-center gap-1 truncate font-mono text-[0.65rem] text-secondary"><ArrowRight className="size-3" /> {[...nextLoops].join(", ")}</span> : null}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
