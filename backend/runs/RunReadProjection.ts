import type {
  CanonicalNodeOutcome, ExecutionTask, LoopRunDetails, NodeRun, ValidationNodeOutcome, JobRun
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
  if (!selected.run && !selected.jobRun && !selected.nodeRun && !task) return undefined;
  const definitions = definitionContext(root, selected.run, selected.nodeRun, selected.jobRun);
  const outcomes = outcomeContext(selected.run, selected.jobRun);
  return {
    ...positionIdentity(selected.run, selected.nodeRun, selected.jobRun),
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
  const jobRun = findJobRun(run, nodeRun, repair);
  return { run, nodeRun, jobRun };
};

const definitionContext = (
  root: StoredRootRun,
  run: LoopRunDetails | undefined,
  nodeRun: NodeRun | undefined,
  jobRun: JobRun | undefined
) => {
  const loop = root.executionSnapshot.loops.find(({ id }) => id === (run?.loopId ?? nodeRun?.loopId));
  const definition = loop?.workflow.jobNodes.find(({ id }) => id === (
    jobRun?.jobNodeId ?? nodeRun?.jobNodeId
  ));
  return { loopDescription: loop?.description, jobNodeDescription: definition?.description };
};

const outcomeContext = (run: LoopRunDetails | undefined, jobRun: JobRun | undefined) => {
  const job = lastRoleOutcome(run, jobRun, "job");
  const validation = lastRoleOutcome(run, jobRun, "validation");
  return {
    lastJobOutcome: job?.role === "job" ? job : undefined,
    lastValidationDecision: validationDecision(validation?.role === "validation" ? validation : undefined)
  };
};

const positionIdentity = (
  run: LoopRunDetails | undefined,
  nodeRun: NodeRun | undefined,
  jobRun: JobRun | undefined
) => ({
  loopRunId: run?.loopRunId,
  loopId: run?.loopId ?? nodeRun?.loopId,
  jobRunId: jobRun?.jobRunId,
  jobNodeId: jobRun?.jobNodeId ?? nodeRun?.jobNodeId,
  nodeRunId: nodeRun?.nodeRunId,
  nodeRole: nodeRun?.role,
  jobAttempt: jobRun?.jobAttempt
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

const findJobRun = (
  run: LoopRunDetails | undefined,
  node: NodeRun | undefined,
  repair: RootRunRepairProjection
): JobRun | undefined => {
  const id = node?.jobRunId ?? repair.pendingRepair?.requesterJobRunId;
  if (id) return run?.jobRuns.find(({ jobRunId }) => jobRunId === id);
  return run?.jobRuns.at(-1);
};

const lastRoleOutcome = (
  run: LoopRunDetails | undefined,
  jobRun: JobRun | undefined,
  role: "job" | "validation"
): CanonicalNodeOutcome | undefined => [...(run?.nodeRuns ?? [])].reverse().find((node) =>
    node.jobRunId === jobRun?.jobRunId && node.role === role && node.outcome
  )?.outcome;

const validationDecision = (outcome: ValidationNodeOutcome | undefined): "PASS" | "FAIL" | undefined =>
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
