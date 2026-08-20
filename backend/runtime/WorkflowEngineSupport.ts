import type { JsonValue, ProjectJobNode, ProjectLoop, ProjectValidationNode } from "../../shared/domain/automation.js";
import type { CanonicalNodeOutcome, NodeRun } from "../../shared/domain/runtime.js";
import { LoopRunIntegrityError, LoopRunStateError } from "./LoopRunErrors.js";
import type { LoopRunStore } from "./LoopRunStore.js";
import type { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";

export const definitionForNode = (
  snapshots: RootExecutionSnapshotStore,
  node: NodeRun
): { loop: ProjectLoop; job: ProjectJobNode; jobRunId: string } => {
  if (!node.jobRunId || !node.jobNodeId) throw new LoopRunIntegrityError(
    `Node Run ${node.nodeRunId} is missing its Job Run identity.`
  );
  const loop = snapshots.loop(snapshots.require(node.rootRunId), node.loopId);
  return { loop, job: requireJobNode(loop, node.jobNodeId), jobRunId: node.jobRunId };
};

export const requireActiveNode = (
  loops: LoopRunStore,
  rootRunId: string,
  nodeRunId: string
): NodeRun => {
  const node = loops.getNodeRun(nodeRunId);
  if (!node || node.rootRunId !== rootRunId) throw new LoopRunStateError(
    `Node Run ${nodeRunId} does not belong to Root Run ${rootRunId}.`
  );
  if (!["queued", "running", "waiting_for_input"].includes(node.status)) {
    throw new LoopRunStateError(`Node Run ${nodeRunId} is not active.`);
  }
  return node;
};

export const requireJobNode = (loop: ProjectLoop, nodeId: string): ProjectJobNode => {
  const node = loop.workflow.jobNodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new LoopRunIntegrityError(`Job Node ${loop.id}:${nodeId} was not found in the Root snapshot.`);
  return node;
};

export const requireValidationNode = (loop: ProjectLoop, nodeId: string): ProjectValidationNode => {
  const node = loop.workflow.validationNodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new LoopRunIntegrityError(`Validation Node ${loop.id}:${nodeId} was not found in the Root snapshot.`);
  return node;
};

export const requireOutcome = (
  node: NodeRun | undefined,
  role: CanonicalNodeOutcome["role"],
  state: string
): NodeRun & { outcome: CanonicalNodeOutcome } => {
  if (!node?.outcome || node.outcome.role !== role || node.outcome.state !== state) {
    throw new LoopRunIntegrityError(`Persisted ${role} Node outcome was not available for control-flow readback.`);
  }
  return node as NodeRun & { outcome: CanonicalNodeOutcome };
};

export const resumeContext = (
  node: NodeRun,
  question: string,
  context: string,
  response: string
) => {
  const previousFeedback = readPreviousFeedback(node.context);
  return {
    ...(previousFeedback ? { previousValidationFeedback: previousFeedback } : {}),
    resume: { question, context, response }
  };
};

export const readInteger = (value: unknown, key: string): number => {
  if (typeof value === "object" && value !== null && key in value) {
    const field = Reflect.get(value, key);
    if (typeof field === "number" && Number.isSafeInteger(field)) return field;
  }
  throw new LoopRunIntegrityError(`Runtime database returned an invalid ${key} value.`);
};

const readPreviousFeedback = (
  value: JsonValue | undefined
): { feedback: string; expectedCorrection: string } | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !("previousValidationFeedback" in value)) return undefined;
  const feedback = value.previousValidationFeedback;
  if (!feedback || typeof feedback !== "object" || Array.isArray(feedback)) return undefined;
  return typeof feedback.feedback === "string" && typeof feedback.expectedCorrection === "string"
    ? { feedback: feedback.feedback, expectedCorrection: feedback.expectedCorrection }
    : undefined;
};
