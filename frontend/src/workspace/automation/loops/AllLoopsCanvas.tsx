import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { getProjectStepTransitionTargets } from "@shared/api/workspace-contracts";
import { ArrowRight, Bot, CalendarClock, PanelTopOpen, Route, ShieldCheck } from "lucide-react";
import { CollectionCardGrid } from "@/components/shared/workspace-ui";
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
    <CollectionCardGrid label="All loops" addLabel="Add loop" addAriaLabel="+ Add loop" onAdd={onAddLoop}>
      {config.loops.map((loop) => {
        const humanSteps = loop.nodes.filter((step) => step.type === "human").length;
        const agentSteps = loop.nodes.filter((step) => step.type === "agent").length;
        const scheduledSteps = loop.nodes.filter((step) => step.type === "scheduled").length;
        const nextLoops = new Set(loop.nodes.flatMap((node) => node.type === "agent" || node.type === "human" || node.type === "scheduled" ? getProjectStepTransitionTargets(node) : [])
          .flatMap((target) => typeof target === "object" && "loop" in target ? [target.loop] : []));
        return (
          <article
            key={loop.id}
            className="grid min-h-36 min-w-0 grid-rows-[1fr_auto] overflow-hidden rounded-lg border border-divider-strong bg-card"
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
    </CollectionCardGrid>
  );
}
