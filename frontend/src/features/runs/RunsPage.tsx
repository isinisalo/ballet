import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppData, AgentRun } from "backend/shared/domain";
import type { FlowViewModel, TraceEntry, TraceViewModel } from "backend/shared/flow";
import { api } from "@/api";
import { Button, EmptyState, PageHeader, Section, TechnicalDetails } from "@/components/forms/FormControls";
import { Badge } from "@/components/ui/badge";

const retryable = new Set(["failed", "blocked", "needs_input", "cancelled"]);
const waitingStatuses = new Set(["queued", "running", "blocked", "needs_input"]);

const runStatusSummary = (run: AgentRun): string => {
  if (run.status === "queued") return "Waiting for an agent to pick up the task.";
  if (run.status === "running") return "Agent is working on this task now.";
  if (run.status === "blocked") return "Blocked until the Flow receives more information or a fix.";
  if (run.status === "needs_input") return "Waiting for human input before this task can continue.";
  if (run.status === "failed") return run.error ? `Failed: ${run.error}` : "Failed before the task could complete.";
  if (run.status === "completed") return "Completed and ready for result handling.";
  if (run.status === "cancelled") return "Cancelled before completion.";
  return run.status;
};

const statusBadgeVariant = (status: AgentRun["status"]) =>
  status === "failed" ? "destructive" : waitingStatuses.has(status) ? "outline" : "default";

const shortDate = (value: string) => new Date(value).toLocaleString();

const branchKeyFor = (run: AgentRun) => run.correlationId || run.triggerEventId;

const flowForRun = (flows: FlowViewModel[], run: AgentRun): FlowViewModel | undefined =>
  flows.find((flow) =>
    flow.id === run.loopDefinitionId ||
    flow.nodes.some((node) => node.kind === "operation" && node.operationId === run.operationId && node.version === run.operationVersion)
  );

const traceGroups = (entries: TraceEntry[]) => {
  const agentEntries = entries.filter((entry) => entry.kind.startsWith("agent_"));
  const eventEntries = entries.filter((entry) => entry.kind === "event_received" || entry.kind === "event_emitted" || entry.kind.startsWith("routing_") || entry.kind === "input_mapped" || entry.kind === "input_validated");
  const resultEntries = entries.filter((entry) => entry.kind === "emission_evaluated" || entry.kind === "gate_passed" || entry.kind === "gate_failed");
  const loopEntries = entries.filter((entry) => entry.kind.startsWith("loop_"));
  const logEntries = entries.filter((entry) => entry.kind === "log");
  return [
    { title: "Events and routing", entries: eventEntries },
    { title: "Agent branches", entries: agentEntries },
    { title: "Result handling", entries: resultEntries },
    { title: "Flow state", entries: loopEntries },
    { title: "Run notes", entries: logEntries }
  ].filter((group) => group.entries.length > 0);
};

const traceStageLabel = (entry: TraceEntry): string => {
  if (entry.kind === "event_received" || entry.kind === "event_emitted") return "Event";
  if (entry.kind === "routing_matched" || entry.kind === "routing_skipped") return "Routing";
  if (entry.kind === "input_mapped" || entry.kind === "input_validated") return "Input";
  if (entry.kind.startsWith("agent_")) return "Agent task";
  if (entry.kind === "emission_evaluated") return "Result branch";
  if (entry.kind === "gate_passed" || entry.kind === "gate_failed") return "Check";
  if (entry.kind === "loop_completed" || entry.kind === "loop_exhausted") return "Flow state";
  return "Run note";
};

export function RunsPage({
  data,
  flows,
  selectedRunId,
  refresh,
  navigate
}: {
  data: AppData;
  flows: FlowViewModel[];
  selectedRunId?: string;
  refresh: () => Promise<void>;
  navigate: (path: string) => void;
}) {
  const selectedRun = data.agentRuns.find((run) => run.runId === selectedRunId) ?? data.agentRuns[0];
  const [trace, setTrace] = useState<TraceViewModel | undefined>();
  const [flowFilter, setFlowFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [error, setError] = useState("");
  const agentsById = useMemo(() => new Map(data.agents.map((agent) => [agent.id, agent])), [data.agents]);
  const operationsByKey = useMemo(() => new Map(data.operations.map((operation) => [`${operation.id}@${operation.version}`, operation])), [data.operations]);

  useEffect(() => {
    if (!selectedRun?.runId) {
      setTrace(undefined);
      return;
    }
    api.getRunTrace(selectedRun.runId).then(setTrace).catch((err) => setError(err instanceof Error ? err.message : "Unable to load trace."));
  }, [selectedRun?.runId]);

  const runs = data.agentRuns.filter((run) =>
    (!flowFilter || flowForRun(flows, run)?.id === flowFilter) &&
    (!statusFilter || run.status === statusFilter) &&
    (!agentFilter || run.agentRole === agentFilter || run.operationId === agentFilter) &&
    (!dateFilter || run.createdAt.startsWith(dateFilter))
  );
  const selectedFlow = selectedRun ? flowForRun(flows, selectedRun) : undefined;
  const selectedOperation = selectedRun?.operationId ? operationsByKey.get(`${selectedRun.operationId}@${selectedRun.operationVersion}`) : undefined;
  const selectedAgent = selectedOperation ? agentsById.get(selectedOperation.agentId) : agentsById.get(selectedRun?.agentRole ?? "");
  const branchRuns = selectedRun
    ? data.agentRuns.filter((run) => run.runId !== selectedRun.runId && branchKeyFor(run) === branchKeyFor(selectedRun))
    : [];

  const retry = async (run: AgentRun) => {
    await api.retryAgentRun(run.runId);
    await refresh();
  };

  return (
    <div className="grid gap-5">
      <PageHeader title="Runs" description="Chronological traces for queued, running, waiting, completed, and failed Flow work." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Section title="Run List">
          <div className="grid gap-3 md:grid-cols-2">
            <FilterSelect id="run-flow-filter" label="Flow" value={flowFilter} onChange={setFlowFilter}>
              <option value="">All Flows</option>
              {flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
            </FilterSelect>
            <FilterSelect id="run-status-filter" label="Status" value={statusFilter} onChange={setStatusFilter}>
              <option value="">All statuses</option>
              {[...new Set(data.agentRuns.map((run) => run.status))].map((status) => <option key={status} value={status}>{status}</option>)}
            </FilterSelect>
            <FilterSelect id="run-agent-filter" label="Agent" value={agentFilter} onChange={setAgentFilter}>
              <option value="">All agents</option>
              {[...new Set(data.agentRuns.map((run) => run.agentRole))].map((agent) => <option key={agent} value={agent}>{agentsById.get(agent)?.name ?? agent}</option>)}
            </FilterSelect>
            <div className="grid gap-1.5">
              <label htmlFor="run-date-filter" className="text-sm font-medium">Date</label>
              <input id="run-date-filter" className="h-10 rounded-md border bg-background px-3 text-sm" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
            </div>
          </div>
          {runs.length === 0 ? <EmptyState title="No runs match the filters." /> : (
            <div className="grid gap-2">
              {runs.map((run) => {
                const operationName = operationsByKey.get(`${run.operationId}@${run.operationVersion}`)?.name ?? run.operationId ?? run.agentRole;
                return (
                  <button key={run.runId} type="button" aria-label={`Open run ${operationName}`} className="grid gap-2 rounded-md border bg-background p-3 text-left hover:bg-accent" onClick={() => navigate(`/runs/${run.runId}`)}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{operationName}</span>
                      <Badge variant={statusBadgeVariant(run.status)}>{run.status}</Badge>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{runStatusSummary(run)}</p>
                    <div className="text-xs text-muted-foreground">
                      {(flowForRun(flows, run)?.name ?? "Ungrouped work")} · {agentsById.get(run.agentRole)?.name ?? run.agentRole} · {shortDate(run.createdAt)} · attempt {run.attempt}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Timeline">
          {error ? <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
          {selectedRun ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="grid gap-1">
                  <span className="font-medium">{selectedOperation?.name ?? selectedRun.operationId ?? selectedRun.agentRole}</span>
                  <span className="text-sm text-muted-foreground">{runStatusSummary(selectedRun)}</span>
                  <span className="text-xs text-muted-foreground">{selectedFlow?.name ?? "Ungrouped work"} · {selectedAgent?.name ?? selectedRun.agentRole} · attempt {selectedRun.attempt}</span>
                </div>
                {retryable.has(selectedRun.status) ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void retry(selectedRun)}>
                    <RefreshCw className="size-4" />Retry
                  </Button>
                ) : null}
              </div>
              {branchRuns.length ? <BranchGroup runs={branchRuns} agentsById={agentsById} operationsByKey={operationsByKey} navigate={navigate} /> : null}
              <div className="grid gap-4">
                {traceGroups(trace?.entries ?? []).map((group) => (
                  <div key={group.title} className="grid gap-2">
                    <h3 className="text-sm font-semibold">{group.title}</h3>
                    {group.entries.map((entry) => <TraceEntryCard key={entry.id} entry={entry} />)}
                  </div>
                ))}
                {trace && trace.entries.length === 0 ? <EmptyState title="No trace entries are available for this run yet." /> : null}
              </div>
              <TechnicalDetails>
                <pre className="max-h-96 overflow-auto rounded-md bg-background p-3 text-xs">{JSON.stringify({ run: selectedRun, trace }, null, 2)}</pre>
              </TechnicalDetails>
            </div>
          ) : <EmptyState title="No run selected." />}
        </Section>
      </div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <select id={id} className="h-10 rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  );
}

function BranchGroup({
  runs,
  agentsById,
  operationsByKey,
  navigate
}: {
  runs: AgentRun[];
  agentsById: Map<string, AppData["agents"][number]>;
  operationsByKey: Map<string, AppData["operations"][number]>;
  navigate: (path: string) => void;
}) {
  return (
    <div className="grid gap-2 rounded-md border bg-background p-3">
      <div className="font-medium">Related branch runs</div>
      <p className="text-sm text-muted-foreground">Other agent tasks started from the same Flow branch.</p>
      <div className="grid gap-2">
        {runs.map((run) => {
          const operationName = operationsByKey.get(`${run.operationId}@${run.operationVersion}`)?.name ?? run.operationId ?? run.agentRole;
          return (
            <button key={run.runId} type="button" aria-label={`Open related branch run ${operationName}`} className="rounded-md border bg-muted/20 p-2 text-left text-sm hover:bg-accent" onClick={() => navigate(`/runs/${run.runId}`)}>
              <span className="font-medium">{operationName}</span>
              <span className="text-muted-foreground"> · {agentsById.get(run.agentRole)?.name ?? run.agentRole} · {run.status}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TraceEntryCard({ entry }: { entry: TraceEntry }) {
  return (
    <div className="grid gap-1 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={entry.status === "failed" || entry.status === "error" ? "destructive" : "outline"}>{traceStageLabel(entry)}</Badge>
        <span className="text-xs text-muted-foreground">{shortDate(entry.at)}</span>
      </div>
      <div className="font-medium">{entry.title}</div>
      <p className="text-sm leading-6 text-muted-foreground">{entry.summary}</p>
      {entry.technicalDetails ? (
        <TechnicalDetails>
          <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(entry.technicalDetails, null, 2)}</pre>
        </TechnicalDetails>
      ) : null}
    </div>
  );
}
