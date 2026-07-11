import { cn } from "@/lib/utils";
import type { Agent, AgentExecutionState } from "@shared/api/workspace-contracts";
import { Activity, BookOpenText, ChevronRight, FileText } from "lucide-react";
import { AgentInstructionsForm } from "./AgentInstructionsForm";
import { AgentLiveStatusBadge, AgentProfilePanel } from "./AgentProfilePanel";
import { useAgentExecutionBinding } from "./execution/useAgentExecutionBinding";
import type { AgentEditorState } from "./useAgentEditor";

const workspaceTabs = [
  { label: "Activity", icon: Activity },
  { label: "Instructions", icon: FileText },
  { label: "Skills", icon: BookOpenText }
];

export function AgentEditWorkspace({ agent, executionState, editor }: {
  agent: Agent;
  executionState?: AgentExecutionState;
  editor: AgentEditorState;
}) {
  const executionEditor = useAgentExecutionBinding(agent.id);

  return (
    <section className="w-full overflow-hidden border-y border-divider-strong bg-card">
      <header className="flex min-h-12 flex-wrap items-center gap-x-2 gap-y-1 border-b border-divider-strong bg-panel-section px-4 py-2">
        <span className="text-sm text-muted-foreground">Agents</span>
        <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground/60" />
        <h1 className="min-w-0 truncate text-sm font-medium text-foreground">{editor.form.name ?? agent.name}</h1>
        <AgentLiveStatusBadge state={executionState} />
      </header>
      <div className="grid min-h-[42rem] lg:grid-cols-[20rem_minmax(0,1fr)]">
        <AgentProfilePanel
          agent={agent}
          executionState={executionState}
          editor={editor}
          executionEditor={executionEditor}
        />
        <section className="min-w-0 border-t border-divider-strong lg:border-l lg:border-t-0">
          <div className="overflow-x-auto border-b border-divider-strong bg-card">
            <div className="flex min-w-max items-stretch px-2" role="tablist" aria-label="Agent workspace">
              {workspaceTabs.map((tab) => {
                const Icon = tab.icon;
                const selected = tab.label === "Instructions";
                return (
                  <button
                    key={tab.label}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-disabled={!selected}
                    disabled={!selected}
                    title={selected ? tab.label : "Not available yet"}
                    className={cn(
                      "flex h-12 shrink-0 items-center gap-2 border-x border-transparent px-3 text-xs transition-colors",
                      selected ? "border-divider-strong bg-background font-medium text-foreground" : "text-muted-foreground/65 disabled:cursor-not-allowed"
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <AgentInstructionsForm editor={editor} />
        </section>
      </div>
    </section>
  );
}