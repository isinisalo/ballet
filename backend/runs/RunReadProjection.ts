import type { ExecutionTask, GraphNodeInvocationDetails, NodeRun } from "../../shared/domain/runtime.js";
import type { RootRunCurrentPosition } from "../../shared/domain/runs.js";
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
  tasks: ExecutionTask[]
): RootRunCurrentPosition | undefined => {
  const nodes = invocations.flatMap(({ nodeRuns }) => nodeRuns);
  const node = selectCurrentNode(root, nodes);
  const graphInvocation = selectGraphInvocation(root, node, invocations);
  const jobInvocation = graphInvocation?.actionNodeInvocations.find(({ actionNodeInvocationId }) =>
    actionNodeInvocationId === node?.actionNodeInvocationId);
  const task = selectExecutionTask(node, tasks);
  if (!graphInvocation && !node && !task) return undefined;
  return position(nodes, node, graphInvocation, jobInvocation, task);
};

const selectCurrentNode = (root: StoredRootRun, nodes: NodeRun[]): NodeRun | undefined =>
  nodes.find(({ nodeRunId }) => nodeRunId === root.activeNodeRunId)
  ?? [...nodes].reverse().find(({ status }) => ["queued","running","waiting_for_input"].includes(status))
  ?? nodes.at(-1);
const selectGraphInvocation = (
  root: StoredRootRun,
  node: NodeRun | undefined,
  invocations: GraphNodeInvocationDetails[]
) => invocations.find(({ graphNodeInvocationId }) =>
  graphNodeInvocationId === (node?.graphNodeInvocationId ?? root.activeGraphNodeInvocationId));
const selectExecutionTask = (node: NodeRun | undefined, tasks: ExecutionTask[]) =>
  node?.executionTaskId ? tasks.find(({ id }) => id === node.executionTaskId) : undefined;
const position = (
  nodes: NodeRun[],
  node: NodeRun | undefined,
  graph: GraphNodeInvocationDetails | undefined,
  action: GraphNodeInvocationDetails["actionNodeInvocations"][number] | undefined,
  task: ExecutionTask | undefined
): RootRunCurrentPosition => ({
  graphNodeInvocationId: graph?.graphNodeInvocationId,
  graphNodeId: graph?.graphNodeId ?? node?.graphNodeId,
  actionNodeInvocationId: action?.actionNodeInvocationId,
  actionNodeId: action?.actionNodeId ?? node?.actionNodeId,
  nodeRunId: node?.nodeRunId,
  nodeRole: node?.role,
  taskId: task?.id,
  executionProfileId: task?.spec.evidence.executionProfile.id,
  taskStatus: task?.status,
  workAttempt: action?.workAttempt,
  lastWorkOutcome: lastWorkOutcome(nodes, action?.actionNodeInvocationId),
  lastValidationOutcome: lastValidationOutcome(nodes, action?.actionNodeInvocationId)
});

const selectedOutcome = (nodes: NodeRun[], jobInvocationId: string | undefined, role: "work" | "validation") =>
  [...nodes].reverse().find((node) =>
    node.actionNodeInvocationId === jobInvocationId && node.role === role)?.outcome;
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
