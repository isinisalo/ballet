import { Bot } from "lucide-react";
import type { AppData } from "backend/shared/domain";
import { EmptyState, PageHeader, Section, TechnicalDetails } from "@/components/forms/FormControls";
import { StatusPill } from "@/design-system/components/StatusPill";
import { AgentCard, recentRunForAgent } from "@/features/agents/AgentCard";

const runTimestamp = (value: { updatedAt: string; createdAt: string }): number =>
  Date.parse(value.updatedAt || value.createdAt);

export function AgentsPage({
  data,
  selectedAgentId,
  navigate
}: {
  data: AppData;
  selectedAgentId?: string;
  navigate: (path: string) => void;
}) {
  const selectedAgent = data.agents.find((agent) => agent.id === selectedAgentId) ?? data.agents[0];
  const operations = selectedAgent ? data.operations.filter((operation) => operation.agentId === selectedAgent.id) : [];
  const operationsByKey = new Map(data.operations.map((operation) => [`${operation.id}@${operation.version}`, operation]));
  const recentRuns = selectedAgent
    ? data.agentRuns
      .filter((run) => run.agentRole === selectedAgent.id)
      .slice()
      .sort((left, right) => runTimestamp(right) - runTimestamp(left))
      .slice(0, 8)
    : [];

  return (
    <div className="grid gap-5">
      <PageHeader title="Agents" description="Agent Fleet status, operations, recent runs, model settings, and local operator actions." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.42fr)]">
        <Section title="Agent Fleet" className="border-white/10 bg-card/70">
          {data.agents.length === 0 ? <EmptyState title="No agents configured." /> : (
            <div className="grid gap-3 lg:grid-cols-2">
              {data.agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  operations={data.operations.filter((operation) => operation.agentId === agent.id)}
                  recentRun={recentRunForAgent(agent.id, data.agentRuns)}
                  selected={selectedAgent?.id === agent.id}
                  onOpen={() => navigate(`/agents/${encodeURIComponent(agent.id)}`)}
                />
              ))}
            </div>
          )}
        </Section>
        <Section title={selectedAgent?.name ?? "Agent"} className="border-white/10 bg-card/70">
          {selectedAgent ? (
            <div className="grid gap-5">
              <div className="grid gap-3">
                <AgentFact label="Purpose" value={selectedAgent.description} />
                <AgentFact label="Model" value={selectedAgent.model ?? "Default model"} />
                <AgentFact label="Reasoning effort" value={selectedAgent.modelReasoningEffort ?? "standard"} />
                <AgentFact label="State" value={selectedAgent.enabled ? "Enabled" : "Disabled"} />
              </div>
              <div className="grid gap-2">
                <h3 className="text-sm font-medium">Operations implemented by this agent</h3>
                {operations.length === 0 ? <p className="text-sm text-muted-foreground">No operations reference this agent.</p> : operations.map((operation) => (
                  <div key={`${operation.id}@${operation.version}`} className="rounded-md border border-white/10 bg-black/15 p-3">
                    <div className="font-medium">{operation.name}</div>
                    <p className="text-sm text-muted-foreground">{operation.description}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-2" aria-label={`Recent runs for ${selectedAgent.name}`}>
                <h3 className="text-sm font-medium">Recent runs</h3>
                {recentRuns.length === 0 ? <p className="text-sm text-muted-foreground">No recent runs.</p> : recentRuns.map((run) => (
                  <div key={run.runId} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/15 p-3">
                    <span className="truncate text-sm">{operationNameForRun(run, operationsByKey)}</span>
                    <StatusPill tone={run.status === "failed" ? "danger" : run.status === "completed" ? "success" : "info"}>{run.status}</StatusPill>
                  </div>
                ))}
              </div>
              <div className="grid gap-2">
                <h3 className="text-sm font-medium">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.skills.length === 0 ? <span className="text-sm text-muted-foreground">No skills linked.</span> : selectedAgent.skills.map((skill) => <StatusPill key={skill.id} tone="accent">{skill.name}</StatusPill>)}
                </div>
              </div>
              <TechnicalDetails>
                <pre className="max-h-96 overflow-auto rounded-md bg-background p-3 text-xs">{JSON.stringify(selectedAgent, null, 2)}</pre>
              </TechnicalDetails>
            </div>
          ) : <EmptyState title="Select an agent." />}
        </Section>
      </div>
    </div>
  );
}

function AgentFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/15 p-3 text-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Bot className="size-3.5" />{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

const operationNameForRun = (
  run: AppData["agentRuns"][number],
  operationsByKey: Map<string, AppData["operations"][number]>
): string => {
  const operation = run.operationId && run.operationVersion
    ? operationsByKey.get(`${run.operationId}@${run.operationVersion}`)
    : undefined;
  return operation?.name ?? run.operationId ?? run.policyId;
};
