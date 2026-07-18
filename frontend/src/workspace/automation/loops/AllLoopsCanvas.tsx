import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { getProjectStepTransitionTargets } from "@shared/api/workspace-contracts";
import { ArrowRight, Bot, CalendarClock, PanelTopOpen, ShieldCheck } from "lucide-react";
import { CollectionCardGrid, DeleteAction } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { LoopSummaryStyleField } from "./LoopSummaryStyleField";

export function AllLoopsCanvas({
  config,
  onAddLoop,
  onOpenLoop,
  onChangeLoop,
  onDeleteLoop,
  lockedLoopIds,
  disabled = false
}: {
  config: ProjectAutomationConfig;
  onAddLoop: () => void;
  onOpenLoop: (loopId: string) => void;
  onChangeLoop?: (loop: ProjectAutomationConfig["loops"][number]) => void;
  onDeleteLoop?: (loopId: string) => unknown | Promise<unknown>;
  lockedLoopIds?: ReadonlySet<string>;
  disabled?: boolean;
}) {
  return (
    <CollectionCardGrid label="All loops" addLabel="Add loop" addAriaLabel="+ Add loop" onAdd={onAddLoop}>
      {config.loops.map((loop) => {
        const humanSteps = loop.nodes.filter((step) => step.type === "human").length;
        const agentSteps = loop.nodes.filter((step) => step.type === "agent").length;
        const scheduledSteps = loop.nodes.filter((step) => step.type === "scheduled").length;
        const nextLoops = new Set(loop.nodes.flatMap((node) => node.type === "agent" || node.type === "human" || node.type === "scheduled" ? getProjectStepTransitionTargets(node) : [])
          .flatMap((target) => typeof target === "object" && "loop" in target ? [target.loop] : []));
        const loopLocked = disabled || lockedLoopIds?.has(loop.id) === true;
        return (
          <article
            key={loop.id}
            className="grid min-h-36 min-w-0 grid-rows-[1fr_auto] overflow-hidden rounded-lg border border-divider-strong bg-card"
          >
            <div className="grid gap-3 p-4">
              <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-foreground">
                <LoopSummaryStyleField
                  value={loop.summaryStyle ?? "route"}
                  disabled={loopLocked}
                  onChange={(summaryStyle) => onChangeLoop?.({ ...loop, summaryStyle })}
                />
                <span className="truncate">{loop.id}</span>
              </div>
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
              {onDeleteLoop ? <DeleteAction deleteLabel="Delete loop" deleteType="loop" resourceName={loop.id} disabled={loopLocked} onDelete={() => onDeleteLoop(loop.id)} /> : null}
            </div>
          </article>
        );
      })}
    </CollectionCardGrid>
  );
}
