import type { ExecutionTask, GraphNodeInvocationDetails, NodeRun } from "../../shared/domain/runtime.js";
import type { RootRunCurrentPosition, RootRunRepairProjection } from "../../shared/domain/runs.js";
import type { StoredRootRun } from "./RootRunStore.js";

export const publicRootSummary = (run: StoredRootRun) => ({
  rootRunId: run.rootRunId, kind: run.kind, targetId: run.targetId, source: run.source,
  status: run.status, stateRevision: run.stateRevision, input: run.input, outcome: run.outcome,
  errorCode: run.errorCode, errorMessage: run.errorMessage, finalization: run.finalization,
  createdAt: run.createdAt, updatedAt: run.updatedAt, completedAt: run.completedAt
});

export const currentPosition = (
  root: StoredRootRun,
  invocations: GraphNodeInvocationDetails[],
  tasks: ExecutionTask[],
  repair: RootRunRepairProjection
): RootRunCurrentPosition | undefined => {
  const nodes = invocations.flatMap(({ nodeRuns }) => nodeRuns);
  const node = nodes.find(({ nodeRunId }) => nodeRunId === root.activeNodeRunId)
    ?? [...nodes].reverse().find(({ status }) => ["queued","running","waiting_for_input"].includes(status))
    ?? nodes.at(-1);
  const graphInvocation = invocations.find(({ graphNodeInvocationId }) =>
    graphNodeInvocationId === (node?.graphNodeInvocationId ?? root.activeGraphNodeInvocationId));
  const jobInvocation = graphInvocation?.jobNodeInvocations.find(({ jobNodeInvocationId }) =>
    jobNodeInvocationId === node?.jobNodeInvocationId);
  const task = node?.executionTaskId ? tasks.find(({ id }) => id === node.executionTaskId) : undefined;
  if (!graphInvocation && !node && !task) return undefined;
  return {
    graphNodeInvocationId: graphInvocation?.graphNodeInvocationId,
    graphNodeId: graphInvocation?.graphNodeId ?? node?.graphNodeId,
    jobNodeInvocationId: jobInvocation?.jobNodeInvocationId,
    jobNodeId: jobInvocation?.jobNodeId ?? node?.jobNodeId,
    nodeRunId: node?.nodeRunId,
    nodeRole: node?.role,
    taskId: task?.id,
    executionProfileId: task?.spec.evidence.executionProfile.id,
    taskStatus: task?.status,
    workAttempt: jobInvocation?.workAttempt,
    repairDepth: repair.activeFrames.at(-1)?.depth,
    lastWorkOutcome: lastWorkOutcome(nodes, jobInvocation?.jobNodeInvocationId),
    lastValidationOutcome: lastValidationOutcome(nodes, jobInvocation?.jobNodeInvocationId),
    repairRequestId: repair.pendingRepair?.repairRequestId
  };
};

const selectedOutcome = (nodes: NodeRun[], jobInvocationId: string | undefined, role: "work" | "validation") =>
  [...nodes].reverse().find((node) =>
    node.jobNodeInvocationId === jobInvocationId && node.role === role)?.outcome;
const lastWorkOutcome = (nodes: NodeRun[], id: string | undefined) => {
  const outcome = selectedOutcome(nodes, id, "work");
  return outcome?.role === "work" ? outcome : undefined;
};
const lastValidationOutcome = (nodes: NodeRun[], id: string | undefined) => {
  const outcome = selectedOutcome(nodes, id, "validation");
  return outcome?.role === "validation" ? outcome : undefined;
};

export const isActiveRootStatus = (status: StoredRootRun["status"]): boolean =>
  ["queued","running","waiting_for_input","finalizing"].includes(status);
export const encodeRunCursor = (value: string): string => Buffer.from(value).toString("base64url");
export const decodeRunCursor = (value: string): string => Buffer.from(value, "base64url").toString("utf8");
