import type { Agent, AgentExecutionState, AgentRuntimeConfiguration, LocalRuntime } from "@shared/api/workspace-contracts";
import { AgentCreateWorkspace, AgentEditWorkspace } from "./AgentEditWorkspace";
import { type RemoveAgent, type SaveAgent, useAgentEditor } from "./useAgentEditor";
import { useWorkspaceNavigationBlocker, type WorkspaceNavigation } from "../useWorkspaceNavigation";

const ignoreNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"] = () => undefined;

export function AgentEditor(props: {
  agent?: Agent;
  executionState?: AgentExecutionState;
  runtime: LocalRuntime;
  runtimeConfiguration?: AgentRuntimeConfiguration;
  save: SaveAgent;
  remove: RemoveAgent;
  onSaved?: (agent: Agent) => void;
  onDeleted?: (id: string) => void;
  setNavigationBlocker?: WorkspaceNavigation["setNavigationBlocker"];
}) {
  const editor = useAgentEditor(props);
  useWorkspaceNavigationBlocker(
    props.setNavigationBlocker ?? ignoreNavigationBlocker,
    editor.dirty,
    "Discard unsaved agent changes?"
  );

  if (!props.agent) return <AgentCreateWorkspace editor={editor} />;

  return (
    <AgentEditWorkspace
      agent={props.agent}
      executionState={props.executionState}
      runtime={props.runtime}
      runtimeConfiguration={props.runtimeConfiguration}
      editor={editor}
    />
  );
}
