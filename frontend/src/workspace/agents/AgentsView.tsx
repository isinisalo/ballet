import type { AppData, Agent } from "@shared/api/workspace-contracts";
import { agentDocumentPath } from "../routing";
import type { AgentMode, SaveCollection } from "../types";
import { AgentEditor } from "./AgentEditor";
import { AgentExecutionWorkspace } from "./execution";

export function AgentsView({ agent, mode, save, remove, navigate }: {
  agent?: Agent;
  mode: AgentMode;
  save: <T extends SaveCollection>(collection: T, item: Partial<AppData[T][number]>) => Promise<AppData[T][number]>;
  remove: (collection: SaveCollection | "events", id: string) => Promise<void>;
  navigate: (path: string) => void;
}) {
  const editor = <AgentEditor
    agent={agent}
    save={save}
    remove={remove}
    onSaved={(saved) => { if (saved.relativePath) navigate(agentDocumentPath(saved.relativePath, mode)); }}
    onDeleted={() => navigate("/agents")}
  />;
  if (!agent) return <div className="grid gap-4 xl:max-w-3xl">{editor}</div>;

  return (
    <div className={mode === "run" ? "grid gap-4" : "grid gap-4 xl:max-w-4xl"}>
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
