import type { ReactNode } from "react";
import type { Agent, AgentExecutionState, AgentRuntimeConfiguration, LocalRuntime } from "@shared/api/workspace-contracts";
import { AgentInstructionsForm } from "./AgentInstructionsForm";
import { AgentProfilePanel, NewAgentProfilePanel } from "./AgentProfilePanel";
import { useAgentRuntimeConfiguration } from "./execution/useAgentRuntimeConfiguration";
import type { AgentEditorState } from "./useAgentEditor";

function AgentWorkspace({ editor, profile }: { editor: AgentEditorState; profile: ReactNode }) {
  return (
    <section className="@container/agent-workspace w-full overflow-hidden border-y border-divider-strong bg-card">
      <form
        id={editor.formId}
        className="grid min-h-[42rem] @3xl/agent-workspace:grid-cols-[18rem_minmax(0,1fr)]"
        onSubmit={(event) => {
          event.preventDefault();
          void editor.submit();
        }}
      >
        <div className="border-b border-divider-strong @3xl/agent-workspace:border-b-0 @3xl/agent-workspace:border-r">
          {profile}
        </div>
        <AgentInstructionsForm editor={editor} />
      </form>
    </section>
  );
}

export function AgentEditWorkspace({ agent, executionState, runtime, runtimeConfiguration, editor }: {
  agent: Agent;
  executionState?: AgentExecutionState;
  runtime: LocalRuntime;
  runtimeConfiguration?: AgentRuntimeConfiguration;
  editor: AgentEditorState;
}) {
  const executionEditor = useAgentRuntimeConfiguration(agent.id, runtime, runtimeConfiguration);

  return (
    <AgentWorkspace
      editor={editor}
      profile={(
        <AgentProfilePanel
          agent={agent}
          executionState={executionState}
          editor={editor}
          executionEditor={executionEditor}
        />
      )}
    />
  );
}

export function AgentCreateWorkspace({ editor }: { editor: AgentEditorState }) {
  return <AgentWorkspace editor={editor} profile={<NewAgentProfilePanel editor={editor} />} />;
}
