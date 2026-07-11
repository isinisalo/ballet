import type { Agent, AgentExecutionState, AppData } from "@shared/api/workspace-contracts";
import { agentDocumentPath } from "../routing";
import type { AgentMode, SaveCollection } from "../types";
import { AgentEditor } from "./AgentEditor";
import { AgentExecutionWorkspace } from "./execution";

export function AgentsView({ agent, agentExecutionStates, mode, save, remove, navigate }: {
  agent?: Agent;
  agentExecutionStates: AgentExecutionState[];
  mode: AgentMode;
  save: <T extends SaveCollection>(collection: T, item: Partial<AppData[T][number]>) => Promise<AppData[T][number]>;
  remove: (collection: SaveCollection | "events", id: string) => Promise<void>;
  navigate: (path: string) => void;
}) {
  const executionState = agent ? agentExecutionStates.find((state) => state.agentId === agent.id) : undefined;
  const editor = <AgentEditor
    agent={agent}
    executionState={executionState}
    save={save}
    remove={remove}
    onSaved={(saved) => { if (saved.relativePath) navigate(agentDocumentPath(saved.relativePath, mode)); }}
    onDeleted={() => navigate("/agents")}
  />;
  if (!agent) return <div className="grid w-full gap-4">{editor}</div>;

  return (
    <div className="grid w-full gap-4">
      <AgentExecutionWorkspace
        agentId={agent.id}
        mode={mode}
        editContent={editor}
        onModeChange={(nextMode) => {
          if (agent.relativePath) navigate(agentDocumentPath(agent.relativePath, nextMode));
        }}
      />
    </div>
  );
}
