import type { ExecutionTask } from "@shared/api/workspace-contracts";
import type { AgentRun } from "./types";
import { Bot } from "lucide-react";
import { MarkdownBody } from "../../documents/MarkdownBody";

export function AgentRunInstructions({ run, task }: { run: AgentRun; task?: ExecutionTask }) {
  const snapshot = task?.spec.agent;
  return (
    <aside aria-label="Immutable agent instructions" className="min-w-0 overflow-y-auto border-b border-divider-strong bg-panel-section md:border-r md:border-b-0">
      <article className="p-3">
        <header className="mb-2 flex items-start justify-between gap-3 border-b border-divider-strong pb-2">
          <div className="flex min-w-0 items-center gap-2"><Bot className="size-3.5 text-muted-foreground" /><div className="min-w-0"><h2 className="truncate text-xs font-medium">{snapshot?.name ?? run.agentId}</h2><p className="truncate font-mono text-[0.62rem] text-muted-foreground">{snapshot?.id ?? run.agentId}</p></div></div>
          <span className="font-mono text-[0.58rem] text-secondary">Immutable Run snapshot</span>
        </header>
        <MarkdownBody source={snapshot?.instructions} title={snapshot?.name ?? run.agentId} emptyText="No instructions in this Run snapshot." />
      </article>
    </aside>
  );
}
