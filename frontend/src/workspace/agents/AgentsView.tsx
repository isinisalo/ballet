import type { Agent, AgentExecutionState, AgentRuntimeConfiguration, AppData, LocalRuntime, WorkspaceSaveRequestByCollection } from "@shared/api/workspace-contracts";
import { agentDocumentPath } from "../routing";
import type { SaveCollection } from "../types";
import { AgentEditor } from "./AgentEditor";

export function AgentsView({ agent, agentExecutionStates, runtime, runtimeConfiguration, save, remove, navigate }: {
  agent?: Agent;
  agentExecutionStates: AgentExecutionState[];
  runtime: LocalRuntime;
  runtimeConfiguration?: AgentRuntimeConfiguration;
  save: <T extends SaveCollection>(collection: T, item: WorkspaceSaveRequestByCollection[T]) => Promise<AppData[T][number]>;
  remove: (collection: SaveCollection, id: string) => Promise<void>;
  navigate: (path: string) => void;
}) {
  const executionState = agent ? agentExecutionStates.find((state) => state.agentId === agent.id) : undefined;
  const editor = <AgentEditor
    agent={agent}
    executionState={executionState}
    runtime={runtime}
    runtimeConfiguration={runtimeConfiguration}
    save={save}
    remove={remove}
    onSaved={(saved) => { if (saved.relativePath) navigate(agentDocumentPath(saved.relativePath)); }}
    onDeleted={() => navigate("/agents")}
  />;
  return <div className="grid w-full gap-4">{editor}</div>;
}
