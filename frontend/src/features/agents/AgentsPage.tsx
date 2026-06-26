import { Bot } from "lucide-react";
import type { AppData } from "backend/shared/domain";
import { EmptyState, PageHeader, Section, TechnicalDetails } from "@/components/forms/FormControls";
import { Badge } from "@/components/ui/badge";

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
      <PageHeader title="Agents" description="Reusable agent roles stay separate from operation-specific task instructions." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Section title="Agent List">
          {data.agents.length === 0 ? <EmptyState title="No agents configured." /> : (
            <div className="grid gap-2">
              {data.agents.map((agent) => (
                <button key={agent.id} type="button" className="grid gap-1 rounded-md border bg-background p-3 text-left hover:bg-accent" onClick={() => navigate(`/agents/${encodeURIComponent(agent.id)}`)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2"><Bot className="size-4 shrink-0" /><span className="truncate font-medium">{agent.name}</span></span>
                    <Badge variant={agent.enabled ? "default" : "outline"}>{agent.enabled ? "enabled" : "disabled"}</Badge>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{agent.description}</p>
                </button>
              ))}
            </div>
          )}
        </Section>
        <Section title={selectedAgent?.name ?? "Agent"}>
          {selectedAgent ? (
            <div className="grid gap-5">
              <div className="grid gap-3 md:grid-cols-3">
                <AgentFact label="Purpose" value={selectedAgent.description} />
                <AgentFact label="Model" value={selectedAgent.model ?? "Default model"} />
                <AgentFact label="State" value={selectedAgent.enabled ? "Enabled" : "Disabled"} />
              </div>
              <div className="grid gap-2">
                <h3 className="text-sm font-medium">Operations implemented by this agent</h3>
                {operations.length === 0 ? <p className="text-sm text-muted-foreground">No operations reference this agent.</p> : operations.map((operation) => (
                  <div key={`${operation.id}@${operation.version}`} className="rounded-md border bg-background p-3">
                    <div className="font-medium">{operation.name}</div>
                    <p className="text-sm text-muted-foreground">{operation.description}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-2" aria-label={`Recent runs for ${selectedAgent.name}`}>
                <h3 className="text-sm font-medium">Recent runs</h3>
                {recentRuns.length === 0 ? <p className="text-sm text-muted-foreground">No recent runs.</p> : recentRuns.map((run) => (
                  <div key={run.runId} className="flex items-center justify-between gap-2 rounded-md border bg-background p-3">
                    <span className="truncate text-sm">{operationNameForRun(run, operationsByKey)}</span>
                    <Badge variant={run.status === "failed" ? "destructive" : "outline"}>{run.status}</Badge>
                  </div>
                ))}
              </div>
              <div className="grid gap-2">
                <h3 className="text-sm font-medium">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.skills.length === 0 ? <span className="text-sm text-muted-foreground">No skills linked.</span> : selectedAgent.skills.map((skill) => <Badge key={skill.id} variant="outline">{skill.name}</Badge>)}
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
    <div className="rounded-md border bg-background p-3 text-sm">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
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
