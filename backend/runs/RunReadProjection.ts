import type { ExecutionTask, LoopRunDetails } from "../../shared/domain/runtime.js";
import type { StoredRootRun } from "./RootRunStore.js";

export const publicRootSummary = (run: StoredRootRun) => ({
  rootRunId: run.rootRunId,
  kind: run.kind,
  targetId: run.targetId,
  source: run.source,
  status: run.status,
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
  tasks: ExecutionTask[],
  fallbackAgentId: string
) => {
  const run = [...runs].reverse().find((candidate) =>
    ["running", "waiting_for_human"].includes(candidate.status)) ?? runs.at(-1);
  const step = [...(run?.stepRuns ?? [])].reverse().find((candidate) =>
    ["queued", "running", "waiting_for_human"].includes(candidate.status));
  const task = step?.executionTaskId
    ? tasks.find((candidate) => candidate.id === step.executionTaskId)
    : tasks.at(-1);
  return task || step || run ? {
    loopRunId: run?.runId,
    loopId: run?.loopId,
    stepRunId: step?.stepRunId,
    stepId: step?.stepId,
    taskId: task?.id,
    agentId: step?.agentId ?? task?.spec.agent.id ?? fallbackAgentId,
    taskStatus: task?.status
  } : undefined;
};

export const isActiveRootStatus = (status: StoredRootRun["status"]): boolean =>
  ["queued", "running", "waiting_for_human", "finalizing"].includes(status);
export const encodeRunCursor = (value: string): string => Buffer.from(value).toString("base64url");
export const decodeRunCursor = (value: string): string => Buffer.from(value, "base64url").toString("utf8");
