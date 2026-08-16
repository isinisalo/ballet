import type {
  ExecutionTask, LoopRunDetails, NodeRun, WorkLoopNodeRun
} from "../../shared/domain/runtime.js";
import type { StoredRootRun } from "./RootRunStore.js";

export const publicRootSummary = (run: StoredRootRun) => ({
  rootRunId: run.rootRunId,
  kind: run.kind,
  targetId: run.targetId,
  source: run.source,
  status: run.status,
  stateRevision: run.stateRevision,
  input: run.input,
  outcome: run.outcome,
  errorCode: run.errorCode,
  errorMessage: run.errorMessage,
  current: run.current,
  finalization: run.finalization,
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
  completedAt: run.completedAt
});

export const currentPosition = (
  runs: LoopRunDetails[],
  tasks: ExecutionTask[]
) => {
  const run = latestActive(runs) ?? runs.at(-1);
  const workLoopNodeRun = latestActive(run?.workLoopNodeRuns ?? []);
  const nodeRun = latestActive(run?.nodeRuns ?? [])
    ?? (workLoopNodeRun?.status === "waiting_for_input"
      ? [...(run?.nodeRuns ?? [])].reverse().find((node) =>
        node.workLoopNodeRunId === workLoopNodeRun.workLoopNodeRunId)
      : undefined);
  const task = currentTask(nodeRun, tasks);
  if (!hasCurrentPosition(run, workLoopNodeRun, nodeRun, task)) return undefined;
  return positionFields(run, workLoopNodeRun, nodeRun, task);
};

const positionFields = (
  run: LoopRunDetails | undefined,
  workLoopNodeRun: WorkLoopNodeRun | undefined,
  nodeRun: NodeRun | undefined,
  task: ExecutionTask | undefined
) => {
  return {
    loopRunId: run?.loopRunId,
    loopId: run?.loopId,
    workLoopNodeRunId: workLoopNodeRun?.workLoopNodeRunId,
    workLoopNodeId: workLoopNodeRun?.workLoopNodeId ?? nodeRun?.workLoopNodeId,
    nodeRunId: nodeRun?.nodeRunId,
    nodeRole: nodeRun?.role,
    taskId: task?.id,
    executionProfileId: task?.spec.evidence.executionProfile.id,
    taskStatus: task?.status
  };
};

const currentTask = (nodeRun: NodeRun | undefined, tasks: ExecutionTask[]): ExecutionTask | undefined => {
  if (!nodeRun) return tasks.at(-1);
  if (!nodeRun.executionTaskId) return undefined;
  return tasks.find(({ id }) => id === nodeRun.executionTaskId);
};

const hasCurrentPosition = (...values: unknown[]): boolean => values.some(Boolean);

const latestActive = <Value extends { status: string }>(values: Value[]): Value | undefined =>
  [...values].reverse().find(({ status }) => activeRuntimeStatuses.has(status));

const activeRuntimeStatuses = new Set(["queued", "running", "waiting_for_input"]);

export const isActiveRootStatus = (status: StoredRootRun["status"]): boolean =>
  ["queued", "running", "waiting_for_input", "finalizing"].includes(status);
export const encodeRunCursor = (value: string): string => Buffer.from(value).toString("base64url");
export const decodeRunCursor = (value: string): string => Buffer.from(value, "base64url").toString("utf8");
