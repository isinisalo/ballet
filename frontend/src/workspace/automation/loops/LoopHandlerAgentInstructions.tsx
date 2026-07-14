import type { Agent, ProjectLoopNode } from "@shared/api/workspace-contracts";
import { isProjectTerminalNode } from "@shared/api/workspace-contracts";
import type { ExecutionAgentSnapshot } from "@shared/api/workspace-contracts";
import { Bot, CalendarClock, CircleStop, ShieldCheck, TriangleAlert } from "lucide-react";
import { MarkdownBody } from "../../documents/MarkdownBody";
import { scheduleSummary } from "./loopSchedulePresentation";

export function LoopHandlerAgentInstructions({ step, agents, snapshot }: {
  step: ProjectLoopNode;
  agents: Agent[];
  snapshot?: ExecutionAgentSnapshot;
}) {
  const terminal = isProjectTerminalNode(step);
  const agent = step.type === "agent" || step.type === "scheduled" ? agents.find((candidate) => candidate.id === step.agentId) : undefined;
  const Icon = terminal ? CircleStop : step.type === "human" ? ShieldCheck : step.type === "scheduled" ? CalendarClock : agent ? Bot : TriangleAlert;
  const title = terminal ? step.id : step.type === "human" ? "Human operator" : snapshot?.name ?? agent?.name ?? step.agentId;
  const instructions = snapshot?.instructions ?? agent?.instructions;
  const emptyText = terminal ? "Terminal nodes do not have agent instructions." : step.type === "human" ? "Human steps do not have agent instructions." : snapshot || agent ? "No instructions configured." : "Agent not found.";

  return (
    <aside aria-label="Agent instructions" className="agent-instructions-preview min-w-0 overflow-y-auto border-b border-divider-strong bg-panel-section sm:border-r sm:border-b-0">
      <article className="min-w-0 px-3 py-3">
        <header className="mb-2 flex items-start justify-between gap-3 border-b border-divider-strong pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <h3 className="break-words text-xs font-medium leading-4 text-foreground">{title}</h3>
              {step.type === "agent" || step.type === "scheduled" ? <p className="truncate font-mono text-[0.65rem] text-muted-foreground">{step.agentId}</p> : null}
            </div>
          </div>
          {snapshot ? <span className="font-mono text-[0.58rem] text-secondary">Immutable Run snapshot</span> : agent ? <span className="font-mono text-[0.58rem] text-muted-foreground">Execution policy is local</span> : null}
        </header>
        {step.type === "scheduled" ? <p className="mb-3 break-words border-b border-divider-strong pb-2 font-mono text-[0.65rem] leading-4 text-muted-foreground">{scheduleSummary(step.schedule)}</p> : null}
        <MarkdownBody source={instructions} title={title} emptyText={emptyText} />
      </article>
    </aside>
  );
}
