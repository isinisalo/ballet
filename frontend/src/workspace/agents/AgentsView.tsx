import type { AppData, Agent, Runtime } from "@shared/api/workspace-contracts";
import { agentDocumentPath } from "../routing";
import type { SaveCollection } from "../types";
import { AgentEditor } from "./AgentEditor";

export function AgentsView({
  agent,
  runtimes,
  save,
  remove,
  navigate
}: {
  agent?: Agent;
  runtimes: Runtime[];
  save: <T extends SaveCollection>(collection: T, item: Partial<AppData[T][number]>) => Promise<AppData[T][number]>;
  remove: (collection: SaveCollection | "events", id: string) => Promise<void>;
  navigate: (path: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:max-w-3xl">
      <AgentEditor
        agent={agent}
        runtimes={runtimes}
        save={save}
        remove={remove}
        onSaved={(saved) => {
          if (saved.relativePath) navigate(agentDocumentPath(saved.relativePath));
        }}
        onDeleted={() => navigate("/agents")}
      />
    </div>
  );
}
