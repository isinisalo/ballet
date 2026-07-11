import type {
  DashboardRunStatus,
  RootRunCurrentPosition,
  RootRunDetail,
  RootRunFinalization,
  RootRunListQuery,
  RootRunListResponse,
  RootRunSummary
} from "../../shared/domain/runs.js";
import type { AgentOutcome, ExecutionTask, LoopRunDetails, StepRun } from "../../shared/domain/runtime.js";
import type { StoredRootFinalization, StoredRootRun } from "./RunReadModelStore.js";
import { RunReadModelStore } from "./RunReadModelStore.js";

const activeStatuses = new Set<DashboardRunStatus>([
  "queued", "running", "waiting_for_human", "finalizing"
]);
const activeTaskStatuses = new Set<ExecutionTask["status"]>(["claimed", "preparing", "running"]);
const blockingOutcomes = new Set<AgentOutcome["outcome"]>(["blocked", "needs_input", "changes-requested"]);

export class RunReadModelService {
  constructor(
    private readonly store: RunReadModelStore,
    private readonly scanLimit = 2_000
  ) {}

  list(query: RootRunListQuery = {}): RootRunListResponse {
    const limit = Math.max(1, Math.min(200, Math.trunc(query.limit ?? 50)));
    const summaries = this.store.list(this.scanLimit).map(toSummary)
      .filter((run) => !query.kind || run.kind === query.kind)
      .filter((run) => !query.state || (query.state === "active") === isActive(run.status))
      .sort(compareSummaries);
    const cursorRootRunId = query.cursor ? decodeCursor(query.cursor) : undefined;
    const offset = cursorRootRunId ? Math.max(0, summaries.findIndex((run) => run.rootRunId === cursorRootRunId) + 1) : 0;
    const items = summaries.slice(offset, offset + limit);
    const nextCursor = offset + items.length < summaries.length && items.length > 0
      ? encodeCursor(items.at(-1)!.rootRunId)
      : undefined;
    return { items, nextCursor };
  }

  detail(rootRunId: string): RootRunDetail | undefined {
    const stored = this.store.get(rootRunId);
    if (!stored) return undefined;
    return { ...toSummary(stored), loopRuns: orderedLoops(stored.loopRuns), tasks: stored.tasks, agentRun: stored.agentRun };
  }
}

export const toSummary = (stored: StoredRootRun): RootRunSummary => {
  const loopRuns = orderedLoops(stored.loopRuns);
  const rootLoop = loopRuns.find((run) => !run.parentRunId) ?? loopRuns[0];
  const identity = rootLoop ? loopIdentity(stored, loopRuns, rootLoop) : agentIdentity(stored);
  const timestamps = collectTimestamps(stored, loopRuns);
  const epoch = new Date(0).toISOString();
  return {
    rootRunId: stored.rootRunId,
    projectId: stored.projectId,
    ...identity,
    finalization: optionalFinalization(stored.finalization),
    createdAt: timestamps.created[0] ?? epoch,
    updatedAt: timestamps.all.at(-1) ?? timestamps.created[0] ?? epoch,
    completedAt: isTerminal(identity.status) ? timestamps.completed.at(-1) : undefined
  };
};

const loopStatus = (
  runs: LoopRunDetails[],
  tasks: ExecutionTask[],
  finalization?: StoredRootFinalization
): DashboardRunStatus => {
  if (finalization?.status === "pending") return "finalizing";
  const statuses = new Set(runs.map((run) => run.status));
  if (statuses.has("waiting_for_human")) return "waiting_for_human";
  return statuses.has("running") ? activeLoopStatus(runs, tasks) : terminalLoopStatus(runs, statuses);
};

const activeLoopStatus = (runs: LoopRunDetails[], tasks: ExecutionTask[]): DashboardRunStatus => {
  const current = currentStep(runs);
  const task = current?.executionTaskId ? tasks.find((entry) => entry.id === current.executionTaskId) : undefined;
  if (current?.status === "waiting_for_human") return "waiting_for_human";
  if (task?.status === "failed") return outcomeStatus(task.outcome, "failed");
  if (task?.status === "cancelled") return "cancelled";
  if (task?.status === "queued" || current?.status === "queued") return "queued";
  return "running";
};

const terminalLoopStatus = (runs: LoopRunDetails[], statuses: Set<LoopRunDetails["status"]>): DashboardRunStatus => {
  if (statuses.has("failed")) return "failed";
  if (statuses.has("blocked")) return "blocked";
  if (statuses.has("cancelled")) return "cancelled";
  return runs.length > 0 && statuses.size === 1 && statuses.has("completed") ? "completed" : "failed";
};

const agentStatus = (
  runStatus: ExecutionTask["status"] | undefined,
  task: ExecutionTask | undefined,
  outcome: AgentOutcome | undefined,
  finalization?: StoredRootFinalization
): DashboardRunStatus => {
  if (finalization?.status === "pending") return "finalizing";
  const status = task?.status ?? runStatus;
  if (status === "queued") return "queued";
  if (status && activeTaskStatuses.has(status)) return "running";
  if (status === "cancelled") return "cancelled";
  if (status === "failed") return outcomeStatus(outcome ?? task?.outcome, "failed");
  if (status === "succeeded") return outcomeStatus(outcome ?? task?.outcome, "completed");
  return "failed";
};

type SummaryIdentity = Pick<RootRunSummary, "kind" | "targetId" | "source" | "status" | "current">;

const loopIdentity = (
  stored: StoredRootRun,
  loopRuns: LoopRunDetails[],
  rootLoop: LoopRunDetails
): SummaryIdentity => ({
  kind: "loop",
  targetId: rootLoop.loopId,
  source: rootLoop.source === "schedule" ? "schedule" : "manual",
  status: loopStatus(loopRuns, stored.tasks, stored.finalization),
  current: loopCurrent(loopRuns, stored.tasks)
});

const agentIdentity = (stored: StoredRootRun): SummaryIdentity => {
  const run = stored.agentRun;
  const current = agentCurrent(stored.tasks, run?.agentId);
  return {
    kind: "agent",
    targetId: run?.agentId ?? current?.agentId ?? "unknown",
    source: run?.source ?? "manual",
    status: agentStatus(run?.status, stored.tasks[0], run?.outcome, stored.finalization),
    current
  };
};

const collectTimestamps = (stored: StoredRootRun, loopRuns: LoopRunDetails[]): {
  all: string[];
  created: string[];
  completed: string[];
} => {
  const all: string[] = [];
  const created: string[] = [];
  const completed: string[] = [];
  for (const run of loopRuns) addTimes(all, created, completed, run);
  if (stored.agentRun) addTimes(all, created, completed, stored.agentRun);
  for (const task of stored.tasks) addTimes(all, created, completed, task);
  if (stored.finalization) {
    all.push(stored.finalization.authorizedAt);
    if (stored.finalization.finalizedAt) {
      all.push(stored.finalization.finalizedAt);
      completed.push(stored.finalization.finalizedAt);
    }
  }
  return { all: all.sort(), created: created.sort(), completed: completed.sort() };
};

const addTimes = (
  all: string[],
  created: string[],
  completed: string[],
  value: { createdAt: string; updatedAt: string; completedAt?: string }
): void => {
  created.push(value.createdAt);
  all.push(value.createdAt, value.updatedAt);
  if (value.completedAt) {
    all.push(value.completedAt);
    completed.push(value.completedAt);
  }
};

const outcomeStatus = (outcome: AgentOutcome | undefined, fallback: "completed" | "failed"): DashboardRunStatus =>
  outcome && blockingOutcomes.has(outcome.outcome) ? "blocked" : fallback;

const loopCurrent = (runs: LoopRunDetails[], tasks: ExecutionTask[]): RootRunCurrentPosition | undefined => {
  const step = currentStep(runs);
  const run = step ? runs.find((entry) => entry.runId === step.runId) : runs.at(-1);
  if (!run) return undefined;
  const task = step?.executionTaskId ? tasks.find((entry) => entry.id === step.executionTaskId) : undefined;
  return {
    loopRunId: run.runId,
    loopId: run.loopId,
    stepRunId: step?.stepRunId,
    stepId: step?.stepId,
    taskId: task?.id ?? step?.executionTaskId,
    agentId: step?.agentId,
    taskStatus: task?.status
  };
};

const agentCurrent = (tasks: ExecutionTask[], agentId?: string): RootRunCurrentPosition | undefined => {
  const task = tasks.find((entry) => ["queued", "claimed", "preparing", "running"].includes(entry.status)) ?? tasks.at(-1);
  return task ? { taskId: task.id, agentId: agentId ?? task.spec.agent.id, taskStatus: task.status } : undefined;
};

const currentStep = (runs: LoopRunDetails[]): StepRun | undefined => {
  const ordered = orderedLoops(runs);
  const activeRun = [...ordered].reverse().find((run) => ["running", "waiting_for_human"].includes(run.status));
  const steps = activeRun?.stepRuns ?? ordered.at(-1)?.stepRuns ?? [];
  return [...steps].reverse().find((step) => ["queued", "running", "waiting_for_human"].includes(step.status)) ?? steps.at(-1);
};

const orderedLoops = (runs: LoopRunDetails[]): LoopRunDetails[] =>
  [...runs].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.runId.localeCompare(right.runId));

const toFinalization = (entry: StoredRootFinalization): RootRunFinalization => ({
  status: entry.status,
  success: entry.success,
  report: entry.report,
  authorizedAt: entry.authorizedAt,
  finalizedAt: entry.finalizedAt
});

const optionalFinalization = (entry?: StoredRootFinalization): RootRunFinalization | undefined =>
  entry ? toFinalization(entry) : undefined;

const isActive = (status: DashboardRunStatus): boolean => activeStatuses.has(status);
const isTerminal = (status: DashboardRunStatus): boolean => !isActive(status);

const compareSummaries = (left: RootRunSummary, right: RootRunSummary): number => {
  const activeDifference = Number(isActive(right.status)) - Number(isActive(left.status));
  return activeDifference || right.updatedAt.localeCompare(left.updatedAt) || right.rootRunId.localeCompare(left.rootRunId);
};

const encodeCursor = (rootRunId: string): string => Buffer.from(rootRunId, "utf8").toString("base64url");

const decodeCursor = (cursor: string): string => {
  try {
    return Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    return "";
  }
};
