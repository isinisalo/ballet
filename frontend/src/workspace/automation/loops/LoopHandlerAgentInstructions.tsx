import type { Agent, ProjectStep } from "@shared/api/workspace-contracts";
import type { ExecutionAgentSnapshot } from "@shared/api/workspace-contracts";
import { Bot, CalendarClock, ShieldCheck, TriangleAlert } from "lucide-react";
import { MarkdownBody } from "../../documents/MarkdownBody";
import { scheduleSummary } from "./loopSchedulePresentation";

export function LoopHandlerAgentInstructions({ step, agents, snapshot }: {
  step: ProjectStep;
  agents: Agent[];
  snapshot?: ExecutionAgentSnapshot;
}) {
  if (step.type === "scheduled") {
    return (
      <aside aria-label="Schedule summary" className="agent-instructions-preview min-w-0 overflow-y-auto border-b border-divider-strong bg-panel-section sm:border-r sm:border-b-0">
        <article className="grid min-w-0 gap-3 px-3 py-3">
          <header className="flex items-center gap-2 border-b border-divider-strong pb-2">
            <CalendarClock className="size-3.5 text-muted-foreground" />
            <h3 className="text-xs font-medium leading-4 text-foreground">Scheduled start</h3>
          </header>
          <p className="break-words font-mono text-[0.65rem] leading-4 text-muted-foreground">{scheduleSummary(step.schedule)}</p>
          <p className="text-xs leading-4 text-muted-foreground">The schedule triggers its target Step without creating a StepRun for this start node.</p>
        </article>
      </aside>
    );
  }
  const agent = step.type === "agent" ? agents.find((candidate) => candidate.id === step.agentId) : undefined;
  const Icon = step.type === "human" ? ShieldCheck : agent ? Bot : TriangleAlert;
  const title = step.type === "human" ? "Human operator" : snapshot?.name ?? agent?.name ?? step.agentId;
  const instructions = snapshot?.instructions ?? agent?.instructions;
  const emptyText = step.type === "human" ? "Human steps do not have agent instructions." : snapshot || agent ? "No instructions configured." : "Agent not found.";

  return (
    <aside aria-label="Agent instructions" className="agent-instructions-preview min-w-0 overflow-y-auto border-b border-divider-strong bg-panel-section sm:border-r sm:border-b-0">
      <article className="min-w-0 px-3 py-3">
        <header className="mb-2 flex items-start justify-between gap-3 border-b border-divider-strong pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <h3 className="break-words text-xs font-medium leading-4 text-foreground">{title}</h3>
              {step.type === "agent" ? <p className="truncate font-mono text-[0.65rem] text-muted-foreground">{step.agentId}</p> : null}
            </div>
          </div>
          {snapshot ? <span className="font-mono text-[0.58rem] text-secondary">Immutable Run snapshot</span> : agent ? <span className="font-mono text-[0.58rem] text-muted-foreground">Execution policy is local</span> : null}
        </header>
        <MarkdownBody source={instructions} title={title} emptyText={emptyText} />
      </article>
    </aside>
  );
}
