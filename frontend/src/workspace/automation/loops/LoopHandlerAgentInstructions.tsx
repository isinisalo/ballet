import type { Agent, ProjectAutomationConfig, ProjectStep } from "@shared/api/workspace-contracts";
import { Bot, ShieldCheck, TriangleAlert } from "lucide-react";
import { MarkdownBody } from "../../documents/MarkdownBody";

const frontmatterString = (agent: Agent, key: string) => typeof agent.frontmatter?.[key] === "string" ? agent.frontmatter[key] as string : "";

export function LoopHandlerAgentInstructions({ step, agents, config }: {
  step: ProjectStep;
  agents: Agent[];
  config: ProjectAutomationConfig;
}) {
  const agent = step.type === "agent" ? agents.find((candidate) => candidate.id === step.agentId) : undefined;
  const runtimeReference = agent ? frontmatterString(agent, "runtime") : "";
  const runtime = config.runtimes.find((candidate) => candidate.id === runtimeReference || candidate.title === runtimeReference) ?? config.runtimes[0];
  const Icon = step.type === "human" ? ShieldCheck : agent ? Bot : TriangleAlert;
  const title = step.type === "human" ? "Human operator" : agent?.name ?? step.agentId;
  const emptyText = step.type === "human" ? "Human steps do not have agent instructions." : agent ? "No instructions configured." : "Agent not found.";

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
          {agent ? (
            <dl aria-label={`${title} runtime`} className="grid shrink-0 grid-cols-3 gap-x-1 text-right">
              {[
                ["Runtime", runtime?.title || runtime?.id || runtimeReference || "None"],
                ["Model", agent.model || frontmatterString(agent, "model") || "default"],
                ["Effort", agent.modelReasoningEffort || frontmatterString(agent, "model_reasoning_effort") || "medium"]
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="font-mono text-[0.5rem] font-medium uppercase tracking-[0.03em] text-muted-foreground">{label}</dt>
                  <dd className="max-w-16 truncate font-mono text-[0.58rem] text-foreground" title={value}>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </header>
        <MarkdownBody source={agent?.instructions} title={title} emptyText={emptyText} />
      </article>
    </aside>
  );
}
