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
  kind: "agent" | "human" | "missing";
};

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
              <header className="mb-2 flex items-center gap-2">
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-medium text-foreground">{section.title}</h3>
                  {section.agentId ? <p className="truncate font-mono text-[0.65rem] text-muted-foreground">{section.agentId}</p> : null}
                </div>
              </header>
              <MarkdownBody source={section.instructions} title={section.title} emptyText={section.emptyText} />
            </article>
          );
        })}
      </div>
    </aside>
  );
}
