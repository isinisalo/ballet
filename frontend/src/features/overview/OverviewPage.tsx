import { AlertTriangle, ArrowRight, Bot, CircleCheck, PlayCircle } from "lucide-react";
import type { AgentRun, AppData } from "backend/shared/domain";
import type { FlowViewModel } from "backend/shared/flow";
import { HealthBadge } from "@/components/diagnostics/DiagnosticsList";
import { Button, EmptyState, PageHeader, Section } from "@/components/forms/FormControls";
import { Badge } from "@/components/ui/badge";

const runTimestamp = (run: AgentRun): number => Date.parse(run.updatedAt || run.createdAt);

const runStatusLabel = (status: AgentRun["status"]): string => {
  if (status === "needs_input") return "Needs input";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const runLabel = (
  run: AgentRun,
  operationsByKey: Map<string, AppData["operations"][number]>,
  agentsById: Map<string, AppData["agents"][number]>
): string =>
  operationsByKey.get(`${run.operationId}@${run.operationVersion}`)?.name ??
  agentsById.get(run.agentRole)?.name ??
  run.operationId ??
  run.agentRole;

export function OverviewPage({
  data,
  flows,
  navigate
}: {
  data: AppData;
  flows: FlowViewModel[];
  navigate: (path: string) => void;
}) {
  const activeFlows = flows.filter((flow) => flow.active);
  const problemFlows = flows.filter((flow) => flow.health !== "ready");
  const waitingRuns = data.agentRuns.filter((run) => ["queued", "running", "blocked", "needs_input"].includes(run.status));
  const recentRuns = data.agentRuns
    .filter((run) => ["completed", "failed", "cancelled"].includes(run.status))
    .slice()
    .sort((left, right) => runTimestamp(right) - runTimestamp(left))
    .slice(0, 6);
  const firstFailedRun = data.agentRuns.find((run) => run.status === "failed");
  const firstProblemFlow = problemFlows[0];
  const activeAgents = data.agents.filter((agent) => agent.enabled);
  const operationsByKey = new Map(data.operations.map((operation) => [`${operation.id}@${operation.version}`, operation]));
  const agentsById = new Map(data.agents.map((agent) => [agent.id, agent]));

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Overview"
        description="Current Flow health, run state, and agent readiness."
        action={(
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/flows?create=1")}><PlayCircle className="size-4" />Create Flow</Button>
            {firstFailedRun ? (
              <Button type="button" variant="outline" onClick={() => navigate(`/runs/${firstFailedRun.runId}`)}>
                <ArrowRight className="size-4" />Open failed run
              </Button>
            ) : null}
            {firstProblemFlow ? (
              <Button type="button" variant="outline" onClick={() => navigate(`/flows/${encodeURIComponent(firstProblemFlow.id)}?version=${firstProblemFlow.version}`)}>
                <AlertTriangle className="size-4" />Fix configuration issue
              </Button>
            ) : null}
          </div>
        )}
      />
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Section title="Active Flows">
          {activeFlows.length === 0 ? <EmptyState title="No active Flows." /> : (
            <div className="grid gap-3">
              {activeFlows.map((flow) => (
                <button key={flow.id} type="button" className="grid gap-2 rounded-md border bg-background p-3 text-left hover:bg-accent" onClick={() => navigate(`/flows/${encodeURIComponent(flow.id)}`)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{flow.name}</span>
                    <HealthBadge health={flow.health} />
                  </div>
                  <p className="text-sm text-muted-foreground">{flow.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{flow.entryEvents.length} trigger{flow.entryEvents.length === 1 ? "" : "s"}</span>
                    <span>{flow.nodes.filter((node) => node.kind === "operation").length} agent step{flow.nodes.filter((node) => node.kind === "operation").length === 1 ? "" : "s"}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section title="Configuration Problems">
          {problemFlows.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><CircleCheck className="size-4" />All Flows are ready.</div>
          ) : (
            <div className="grid gap-3">
              {problemFlows.map((flow) => (
                <button key={flow.id} type="button" className="grid gap-2 rounded-md border bg-background p-3 text-left hover:bg-accent" onClick={() => navigate(`/flows/${encodeURIComponent(flow.id)}`)}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-destructive" />
                    <span className="font-medium">{flow.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{flow.diagnostics[0]?.title ?? "Needs attention"}</p>
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Running And Waiting Runs">
          {waitingRuns.length === 0 ? <EmptyState title="No runs are waiting." /> : waitingRuns.slice(0, 6).map((run) => (
            <RunRow key={run.runId} label={runLabel(run, operationsByKey, agentsById)} status={run.status} onClick={() => navigate(`/runs/${run.runId}`)} />
          ))}
        </Section>
        <Section title="Recent Outcomes">
          {recentRuns.length === 0 ? <EmptyState title="No completed runs yet." /> : recentRuns.map((run) => (
            <RunRow key={run.runId} label={runLabel(run, operationsByKey, agentsById)} status={run.status} onClick={() => navigate(`/runs/${run.runId}`)} />
          ))}
        </Section>
        <Section title="Active Agents">
          {activeAgents.length === 0 ? <EmptyState title="No active agents." /> : activeAgents.map((agent) => (
            <button key={agent.id} type="button" className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-left hover:bg-accent" onClick={() => navigate(`/agents/${encodeURIComponent(agent.id)}`)}>
              <span className="flex min-w-0 items-center gap-2"><Bot className="size-4 shrink-0" /><span className="truncate">{agent.name}</span></span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </Section>
      </div>
    </div>
  );
}

function RunRow({ label, status, onClick }: { label: string; status: AgentRun["status"]; onClick: () => void }) {
  return (
    <button type="button" className="mb-2 flex w-full items-center justify-between gap-3 rounded-md border bg-background p-3 text-left hover:bg-accent" onClick={onClick}>
      <span className="truncate text-sm">{label}</span>
      <Badge variant={status === "failed" ? "destructive" : "outline"}>{runStatusLabel(status)}</Badge>
    </button>
  );
}
