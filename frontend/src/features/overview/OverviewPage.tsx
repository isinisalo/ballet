import { AlertTriangle, ArrowRight, Bot, CircleCheck, GitBranch, ListTree, PlayCircle, RadioTower, Sparkles, TerminalSquare } from "lucide-react";
import type { AgentRun, AppData } from "backend/shared/domain";
import type { FlowViewModel } from "backend/shared/flow";
import { Button, EmptyState, PageHeader, Section } from "@/components/forms/FormControls";
import { MetricCard } from "@/design-system/components/MetricCard";
import { StatusPill, flowHealthTone } from "@/design-system/components/StatusPill";

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
  const failedRuns = data.agentRuns.filter((run) => run.status === "failed" || run.status === "blocked");
  const recentRuns = data.agentRuns
    .filter((run) => ["completed", "failed", "cancelled"].includes(run.status))
    .slice()
    .sort((left, right) => runTimestamp(right) - runTimestamp(left))
    .slice(0, 6);
  const recentEvents = data.events.slice().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).slice(0, 8);
  const firstFailedRun = data.agentRuns.find((run) => run.status === "failed");
  const firstProblemFlow = problemFlows[0];
  const activeAgents = data.agents.filter((agent) => agent.enabled);
  const operationsByKey = new Map(data.operations.map((operation) => [`${operation.id}@${operation.version}`, operation]));
  const agentsById = new Map(data.agents.map((agent) => [agent.id, agent]));

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Command Center"
        description="Live workspace view for Flow health, agent work, emitted events, loop state, and configuration warnings."
        action={(
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/flows?create=1")}><PlayCircle className="size-4" />Create Flow</Button>
            <Button type="button" variant="outline" onClick={() => navigate("/runtime-console")}><TerminalSquare className="size-4" />Open Runtime Console</Button>
            <Button type="button" variant="outline" onClick={() => navigate("/agents")}><Bot className="size-4" />Add Agent</Button>
            <Button type="button" variant="outline" onClick={() => navigate("/knowledge")}><Sparkles className="size-4" />Open Project Knowledge</Button>
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Runtime Health" value={problemFlows.length ? "Warnings" : "Nominal"} tone={problemFlows.length ? "warning" : "success"} icon={<RadioTower className="size-5" />} detail={`${flows.length} Flow projections loaded`} />
        <MetricCard label="Active Flows" value={activeFlows.length} tone="info" icon={<GitBranch className="size-5" />} detail={`${flows.length} total Flow${flows.length === 1 ? "" : "s"}`} />
        <MetricCard label="Agent Fleet" value={activeAgents.length} tone="accent" icon={<Bot className="size-5" />} detail={`${data.operations.length} operation contracts`} />
        <MetricCard label="Blocked Work" value={failedRuns.length} tone={failedRuns.length ? "danger" : "success"} icon={<AlertTriangle className="size-5" />} detail={`${waitingRuns.length} running or waiting task${waitingRuns.length === 1 ? "" : "s"}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Section title="Active Flow Cards" className="border-white/10 bg-card/70">
          {activeFlows.length === 0 ? <EmptyState title="No active Flows." /> : (
            <div className="grid gap-3 lg:grid-cols-2">
              {activeFlows.map((flow) => (
                <button key={`${flow.id}@${flow.version}`} type="button" className="grid gap-3 rounded-lg border border-white/10 bg-black/15 p-4 text-left transition hover:border-primary/50 hover:bg-primary/10" onClick={() => navigate(`/flows/${encodeURIComponent(flow.id)}?version=${flow.version}`)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{flow.name}</span>
                    <StatusPill tone={flowHealthTone(flow.health)}>{flow.health}</StatusPill>
                  </div>
                  <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{flow.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{flow.entryEvents.length} trigger{flow.entryEvents.length === 1 ? "" : "s"}</span>
                    <span>{flow.nodes.filter((node) => node.kind === "operation").length} agent step{flow.nodes.filter((node) => node.kind === "operation").length === 1 ? "" : "s"}</span>
                    <span>{flow.edges.filter((edge) => edge.kind === "emission").length} result branch{flow.edges.filter((edge) => edge.kind === "emission").length === 1 ? "" : "es"}</span>
                  </div>
                  <ActivityStrip count={Math.max(4, flow.edges.length + 2)} tone={flow.health} />
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section title="Configuration Warnings" className="border-white/10 bg-card/70">
          {problemFlows.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><CircleCheck className="size-4 text-emerald-300" />All Flows are ready.</div>
          ) : (
            <div className="grid gap-3">
              {problemFlows.map((flow) => (
                <button key={`${flow.id}@${flow.version}`} type="button" className="grid gap-2 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-left hover:bg-amber-300/15" onClick={() => navigate(`/flows/${encodeURIComponent(flow.id)}?version=${flow.version}`)}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-amber-200" />
                    <span className="font-medium">{flow.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{flow.diagnostics[0]?.title ?? "Needs attention"}</p>
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Section title="Running Agent Tasks" className="border-white/10 bg-card/70">
          {waitingRuns.length === 0 ? <EmptyState title="No runs are waiting." /> : waitingRuns.slice(0, 6).map((run) => (
            <RunRow key={run.runId} label={runLabel(run, operationsByKey, agentsById)} status={run.status} onClick={() => navigate(`/runs/${run.runId}`)} />
          ))}
        </Section>
        <Section title="Recent Outcomes" className="border-white/10 bg-card/70">
          {recentRuns.length === 0 ? <EmptyState title="No completed runs yet." /> : recentRuns.map((run) => (
            <RunRow key={run.runId} label={runLabel(run, operationsByKey, agentsById)} status={run.status} onClick={() => navigate(`/runs/${run.runId}`)} />
          ))}
        </Section>
        <Section title="Recent Emitted Events" className="border-white/10 bg-card/70">
          {recentEvents.length === 0 ? <EmptyState title="No events emitted yet." /> : recentEvents.map((event) => (
            <div key={event.id} className="mb-2 grid gap-1 rounded-md border border-white/10 bg-black/15 p-3">
              <span className="truncate text-sm font-medium">{event.subject || event.eventType}</span>
              <span className="font-mono text-[0.68rem] text-muted-foreground">{event.eventType}</span>
            </div>
          ))}
        </Section>
        <Section title="Loop Instances" className="border-white/10 bg-card/70">
          {data.loopInstances.length === 0 ? <EmptyState title="No loop instances yet." /> : data.loopInstances.slice(0, 6).map((loop) => (
            <div key={loop.loopInstanceId} className="mb-2 flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/15 p-3 text-sm">
              <span className="truncate">{loop.loopDefinitionId}</span>
              <StatusPill tone={loop.status === "completed" ? "success" : loop.status === "failed" || loop.status === "exhausted" ? "danger" : "info"}>{loop.status}</StatusPill>
            </div>
          ))}
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <ListTree className="size-3.5" />
            Safety limits remain enforced by LoopDefinition runtime policy.
          </div>
        </Section>
      </div>
    </div>
  );
}

function ActivityStrip({ count, tone }: { count: number; tone: FlowViewModel["health"] }) {
  const color = tone === "invalid" ? "bg-red-300" : tone === "warning" ? "bg-amber-300" : "bg-cyan-300";
  return (
    <div className="flex h-8 items-end gap-1" aria-label="Flow activity strip">
      {Array.from({ length: Math.min(count, 12) }).map((_, index) => (
        <span key={index} className={`${color} w-full rounded-t-sm`} style={{ height: `${34 + ((index * 17) % 54)}%`, opacity: index % 3 === 0 ? 1 : index % 3 === 1 ? 0.7 : 0.4 }} />
      ))}
    </div>
  );
}

function RunRow({ label, status, onClick }: { label: string; status: AgentRun["status"]; onClick: () => void }) {
  return (
    <button type="button" className="mb-2 flex w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-black/15 p-3 text-left hover:bg-white/8" onClick={onClick}>
      <span className="truncate text-sm">{label}</span>
      <StatusPill tone={status === "failed" ? "danger" : status === "completed" ? "success" : status === "needs_input" || status === "blocked" ? "warning" : "info"}>{runStatusLabel(status)}</StatusPill>
    </button>
  );
}
