import type { Agent, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { Bot, ShieldCheck, TriangleAlert } from "lucide-react";
import { MarkdownBody } from "../../documents/MarkdownBody";
import type { LoopHandlerRoute } from "./LoopHandlerSheet";

type InstructionSection = {
  key: string;
  title: string;
  agentId?: string;
  instructions?: string;
  emptyText?: string;
  runtime?: string;
  model?: string;
  effort?: string;
  kind: "agent" | "human" | "missing";
};

const frontmatterString = (agent: Agent, key: string) => typeof agent.frontmatter?.[key] === "string" ? agent.frontmatter[key] as string : "";

function agentRuntime(agent: Agent, config: ProjectAutomationConfig) {
  const runtimeReference = frontmatterString(agent, "runtime");
  const runtime = config.runtimes.find((candidate) => candidate.id === runtimeReference || candidate.title === runtimeReference) ?? config.runtimes[0];
  return runtime?.title || runtime?.id || runtimeReference || "None";
}

function instructionSections(
  routes: LoopHandlerRoute[],
  agents: Agent[],
  config: ProjectAutomationConfig
): InstructionSection[] {
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const seenAgentIds = new Set<string>();
  const sections: InstructionSection[] = [];

  routes.forEach((route) => {
    const action = config.actions.find((candidate) => candidate.id === route.actionId);
    if (!action) {
      sections.push({ key: `action-${route.id}`, title: "No handler action", emptyText: "Select a handler action to preview its agent instructions.", kind: "missing" });
      return;
    }
    if (action.humanGate) {
      sections.push({ key: `human-${route.id}`, title: "Human operator", emptyText: "Human gates do not have agent instructions.", kind: "human" });
      return;
    }
    if (!action.agentId) {
      sections.push({ key: `unassigned-${route.id}`, title: "No agent assigned", emptyText: "This handler action has no agent instructions.", kind: "missing" });
      return;
    }
    if (seenAgentIds.has(action.agentId)) return;
    seenAgentIds.add(action.agentId);
    const agent = agentById.get(action.agentId);
    if (!agent) {
      sections.push({ key: `unknown-${action.agentId}`, title: action.agentId, agentId: action.agentId, emptyText: "Agent not found.", kind: "missing" });
      return;
    }
    sections.push({
      key: agent.id,
      title: agent.name,
      agentId: agent.id,
      instructions: agent.instructions,
      emptyText: "No instructions configured.",
      runtime: agentRuntime(agent, config),
      model: agent.model || frontmatterString(agent, "model") || "gpt-5.5",
      effort: agent.modelReasoningEffort || frontmatterString(agent, "model_reasoning_effort") || "medium",
      kind: "agent"
    });
  });

  return sections;
}

export function LoopHandlerAgentInstructions({
  routes,
  agents,
  config
}: {
  routes: LoopHandlerRoute[];
  agents: Agent[];
  config: ProjectAutomationConfig;
}) {
  const sections = instructionSections(routes, agents, config);

  return (
    <aside aria-label="Agent instructions" className="agent-instructions-preview min-w-0 overflow-y-auto border-b border-divider-strong bg-panel-section sm:border-r sm:border-b-0">
      <div>
        {sections.map((section) => {
          const Icon = section.kind === "agent" ? Bot : section.kind === "human" ? ShieldCheck : TriangleAlert;
          return (
            <article key={section.key} className="min-w-0 border-b border-divider-strong px-3 py-3 last:border-b-0">
              <header className="mb-2 flex items-start justify-between gap-3 border-b border-divider-strong pb-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <h3 className="break-words text-xs font-medium leading-4 text-foreground">{section.title}</h3>
                    {section.agentId ? <p className="truncate font-mono text-[0.65rem] text-muted-foreground">{section.agentId}</p> : null}
                  </div>
                </div>
                {section.kind === "agent" ? <AgentRuntimeMetadata section={section} /> : null}
              </header>
              <MarkdownBody source={section.instructions} title={section.title} emptyText={section.emptyText} />
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function AgentRuntimeMetadata({ section }: { section: InstructionSection }) {
  return (
    <dl aria-label={`${section.title} runtime`} className="grid shrink-0 grid-cols-3 gap-x-1 text-right">
      {[
        ["Runtime", section.runtime],
        ["Model", section.model],
        ["Effort", section.effort]
      ].map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="font-mono text-[0.5rem] font-medium uppercase tracking-[0.03em] text-muted-foreground">{label}</dt>
          <dd className="max-w-16 truncate font-mono text-[0.58rem] text-foreground" title={value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
