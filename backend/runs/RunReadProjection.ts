import type {
  CanonicalNodeOutcome, ExecutionTask, LoopRunDetails, NodeRun, ValidationNodeOutcome, WorkLoopNodeRun
} from "../../shared/domain/runtime.js";
import type {
  RootRunCurrentPosition, RootRunRepairProjection
} from "../../shared/domain/runs.js";
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
  finalization: run.finalization,
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
  completedAt: run.completedAt
});

export const currentPosition = (
  root: StoredRootRun,
  runs: LoopRunDetails[],
  tasks: ExecutionTask[],
  repair: RootRunRepairProjection
): RootRunCurrentPosition | undefined => {
  const selected = selectRuntimePosition(root, runs, repair);
  const task = currentTask(selected.nodeRun, tasks);
  if (!selected.run && !selected.workLoopNodeRun && !selected.nodeRun && !task) return undefined;
  const definitions = definitionContext(root, selected.run, selected.nodeRun, selected.workLoopNodeRun);
  const outcomes = outcomeContext(selected.run, selected.workLoopNodeRun);
  return {
    ...positionIdentity(selected.run, selected.nodeRun, selected.workLoopNodeRun),
    ...definitions,
    ...taskContext(task),
    ...outcomes,
    repairDepth: selected.run?.nestingDepth ?? repair.pendingRepair?.nestingDepth,
    repairRequestId: repair.pendingRepair?.repairRequestId,
    routedTargetLoopId: repair.routedTarget?.targetLoopId,
    returnDestination: repair.returnDestination
  };
};

const selectRuntimePosition = (
  root: StoredRootRun,
  runs: LoopRunDetails[],
  repair: RootRunRepairProjection
) => {
  const persistedNode = findNode(runs, root.activeNodeRunId);
  const repairNode = repair.pendingRepair
    ? findNode(runs, repair.pendingRepair.requesterValidationNodeRunId)
    : undefined;
  const fallbackRun = terminalLoop(root, runs);
  const nodeRun = persistedNode ?? repairNode ?? fallbackRun?.nodeRuns.at(-1);
  const run = runs.find(({ loopRunId }) => loopRunId === root.activeLoopRunId)
    ?? (nodeRun ? runs.find(({ loopRunId }) => loopRunId === nodeRun.loopRunId) : undefined)
    ?? fallbackRun;
  const workLoopNodeRun = findComposite(run, nodeRun, repair);
  return { run, nodeRun, workLoopNodeRun };
};

const definitionContext = (
  root: StoredRootRun,
  run: LoopRunDetails | undefined,
  nodeRun: NodeRun | undefined,
  workLoopNodeRun: WorkLoopNodeRun | undefined
) => {
  const loop = root.executionSnapshot.loops.find(({ id }) => id === (run?.loopId ?? nodeRun?.loopId));
  const definition = loop?.nodes.find(({ id }) => id === (
    workLoopNodeRun?.workLoopNodeId ?? nodeRun?.workLoopNodeId
  ));
  return { loopDescription: loop?.description, workLoopNodeDescription: definition?.description };
};

const outcomeContext = (run: LoopRunDetails | undefined, workLoopNodeRun: WorkLoopNodeRun | undefined) => {
  const work = lastRoleOutcome(run, workLoopNodeRun, "work");
  const validation = lastRoleOutcome(run, workLoopNodeRun, "validation");
  return {
    lastWorkOutcome: work?.role === "work" ? work : undefined,
    lastValidationDecision: validationDecision(validation?.role === "validation" ? validation : undefined)
  };
};

const positionIdentity = (
  run: LoopRunDetails | undefined,
  nodeRun: NodeRun | undefined,
  workLoopNodeRun: WorkLoopNodeRun | undefined
) => ({
  loopRunId: run?.loopRunId,
  loopId: run?.loopId ?? nodeRun?.loopId,
  workLoopNodeRunId: workLoopNodeRun?.workLoopNodeRunId,
  workLoopNodeId: workLoopNodeRun?.workLoopNodeId ?? nodeRun?.workLoopNodeId,
  nodeRunId: nodeRun?.nodeRunId,
  nodeRole: nodeRun?.role,
  localRetryAttempt: workLoopNodeRun?.attempt
});

const taskContext = (task: ExecutionTask | undefined) => ({
  taskId: task?.id,
  executionProfileId: task?.spec.evidence.executionProfile.id,
  taskStatus: task?.status
});

const findNode = (runs: LoopRunDetails[], id: string | undefined): NodeRun | undefined => {
  if (!id) return undefined;
  return runs.flatMap(({ nodeRuns }) => nodeRuns).find(({ nodeRunId }) => nodeRunId === id);
};

const findComposite = (
  run: LoopRunDetails | undefined,
  node: NodeRun | undefined,
  repair: RootRunRepairProjection
): WorkLoopNodeRun | undefined => {
  const id = node?.workLoopNodeRunId ?? repair.pendingRepair?.requesterWorkLoopNodeRunId;
  if (id) return run?.workLoopNodeRuns.find(({ workLoopNodeRunId }) => workLoopNodeRunId === id);
  return run?.workLoopNodeRuns.at(-1);
};

const lastRoleOutcome = (
  run: LoopRunDetails | undefined,
  composite: WorkLoopNodeRun | undefined,
  role: "work" | "validation"
): CanonicalNodeOutcome | undefined => [...(run?.nodeRuns ?? [])].reverse().find((node) =>
    node.workLoopNodeRunId === composite?.workLoopNodeRunId && node.role === role && node.outcome
  )?.outcome;

const validationDecision = (outcome: ValidationNodeOutcome | undefined): "OK" | "FAIL" | undefined =>
  outcome?.state === "completed" ? outcome.decision : undefined;

const currentTask = (nodeRun: NodeRun | undefined, tasks: ExecutionTask[]): ExecutionTask | undefined => {
  if (!nodeRun?.executionTaskId) return undefined;
  return tasks.find(({ id }) => id === nodeRun.executionTaskId);
};

const terminalLoop = (root: StoredRootRun, runs: LoopRunDetails[]): LoopRunDetails | undefined =>
  isActiveRootStatus(root.status) && root.status !== "finalizing"
    ? undefined
    : [...runs].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt)).at(-1);

export const isActiveRootStatus = (status: StoredRootRun["status"]): boolean =>
  ["queued", "running", "waiting_for_input", "finalizing"].includes(status);
export const encodeRunCursor = (value: string): string => Buffer.from(value).toString("base64url");
export const decodeRunCursor = (value: string): string => Buffer.from(value, "base64url").toString("utf8");
