import type { AgentRun, AppData, EventRecord } from "backend/shared/domain";
import type { FlowViewModel } from "backend/shared/flow";

export type ConsoleFilter = "all" | "system" | "event" | "routing" | "agent" | "emission" | "loop" | "error";

export interface ConsoleEntry {
  id: string;
  at: string;
  level: "info" | "warn" | "error" | "cmd" | "system";
  source: ConsoleFilter;
  message: string;
  payload?: unknown;
  runId?: string;
  flowId?: string;
}

const runLevel = (run: AgentRun): ConsoleEntry["level"] =>
  run.status === "failed" || run.status === "blocked" ? "error" : run.status === "needs_input" ? "warn" : "info";

export function buildConsoleEntries(data: AppData, flows: FlowViewModel[]): ConsoleEntry[] {
  const flowEntries: ConsoleEntry[] = flows.map((flow) => ({
    id: `flow:${flow.id}@${flow.version}`,
    at: new Date().toISOString(),
    level: flow.health === "invalid" ? "error" : flow.health === "warning" ? "warn" : "system",
    source: "loop",
    message: `${flow.name} projection ${flow.health}; ${flow.nodes.length} nodes, ${flow.edges.length} edges`,
    payload: flow.diagnostics,
    flowId: flow.id
  }));
  const runEntries: ConsoleEntry[] = data.agentRuns.map((run) => ({
    id: `run:${run.runId}`,
    at: run.updatedAt || run.createdAt,
    level: runLevel(run),
    source: run.status === "failed" ? "error" : "agent",
    message: `${run.operationId ?? run.agentRole} ${run.status} attempt ${run.attempt}`,
    payload: run,
    runId: run.runId,
    flowId: run.loopDefinitionId
  }));
  const eventEntries: ConsoleEntry[] = data.events.map((event: EventRecord) => ({
    id: `event:${event.id}`,
    at: event.createdAt,
    level: event.status === "unassigned" ? "warn" : "info",
    source: "event",
    message: `${event.eventType} ${event.subject ? `for ${event.subject}` : "received"}`,
    payload: event,
    flowId: event.loopDefinitionId
  }));
  return [...flowEntries, ...runEntries, ...eventEntries]
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
    .slice(0, 120);
}
