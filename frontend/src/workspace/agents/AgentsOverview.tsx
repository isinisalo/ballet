import type { Agent, AgentExecutionState } from "@shared/api/workspace-contracts";
import { Bot } from "lucide-react";
import { CollectionCardGrid, CollectionEntityCard, OperationalStatus, Panel, type OperationalStatusTone } from "@/components/shared/workspace-ui";
import { agentCreatePath, agentDocumentPath } from "../routing";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";
import { AgentAvatarIcon } from "./agentAvatars";

const agentStatus = (agent: Agent, executionStates: AgentExecutionState[]) => {
  if (!agent.enabled) return { label: "disabled", tone: "neutral" as const };
  const status = executionStates.find((state) => state.agentId === agent.id)?.status ?? "unbound";
  const tone: OperationalStatusTone = status === "running"
    ? "active"
    : ["idle", "busy", "attention"].includes(status) ? "attention" : "neutral";
  return { label: status, tone };
};

export function AgentsOverview({ agents, executionStates, navigate }: {
  agents: Agent[];
  executionStates: AgentExecutionState[];
  navigate: WorkspaceNavigation["navigate"];
}) {
  return (
    <Panel title="Agents" icon={<Bot />} contentClassName="p-0">
      <CollectionCardGrid label="Agents" addLabel="Add agent" onAdd={() => navigate(agentCreatePath())}>
        {agents.map((agent) => {
          const status = agentStatus(agent, executionStates);
          return (
            <CollectionEntityCard
              key={agent.id}
              icon={agent.avatar ? <AgentAvatarIcon avatar={agent.avatar} /> : <Bot />}
              title={agent.name}
              identifier={agent.id}
              status={<OperationalStatus compact label={status.label} tone={status.tone} />}
              description={agent.description}
              openLabel={`Open agent ${agent.name}`}
              onOpen={() => agent.relativePath && navigate(agentDocumentPath(agent.relativePath))}
            />
          );
        })}
      </CollectionCardGrid>
    </Panel>
  );
}
