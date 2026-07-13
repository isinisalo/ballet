import type { Agent, AgentExecutionState, AgentRuntimeConfiguration, AppData, LocalRuntime, WorkspaceSaveRequestByCollection } from "@shared/api/workspace-contracts";
import { agentDocumentPath } from "../routing";
import type { SaveCollection } from "../types";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";
import { AgentEditor } from "./AgentEditor";
import { AgentsOverview } from "./AgentsOverview";

export function AgentsView({ agents, agent, creating = false, agentExecutionStates, runtime, runtimeConfiguration, save, remove, navigate, setNavigationBlocker }: {
  agents: Agent[];
  agent?: Agent;
  creating?: boolean;
  agentExecutionStates: AgentExecutionState[];
  runtime: LocalRuntime;
  runtimeConfiguration?: AgentRuntimeConfiguration;
  save: <T extends SaveCollection>(collection: T, item: WorkspaceSaveRequestByCollection[T]) => Promise<AppData[T][number]>;
  remove: (collection: SaveCollection, id: string) => Promise<void>;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  if (!agent && !creating) return <AgentsOverview agents={agents} executionStates={agentExecutionStates} navigate={navigate} />;

  const executionState = agent ? agentExecutionStates.find((state) => state.agentId === agent.id) : undefined;
  const editor = <AgentEditor
    agent={agent}
    executionState={executionState}
    runtime={runtime}
    runtimeConfiguration={runtimeConfiguration}
    save={save}
    remove={remove}
    onSaved={(saved) => { if (saved.relativePath) navigate(agentDocumentPath(saved.relativePath), { bypassBlocker: true }); }}
    onDeleted={() => navigate("/agents", { bypassBlocker: true })}
    setNavigationBlocker={setNavigationBlocker}
  />;
  return <div className="grid w-full gap-4">{editor}</div>;
}
