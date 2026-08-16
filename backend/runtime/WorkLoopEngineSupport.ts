import type { JsonValue, ProjectLoop, ProjectWorkLoopNode } from "../../shared/domain/automation.js";
import type { CanonicalNodeOutcome, NodeRun } from "../../shared/domain/runtime.js";
import { LoopRunIntegrityError } from "./LoopRunErrors.js";

export const requireWorkLoopNode = (loop: ProjectLoop, nodeId: string): ProjectWorkLoopNode => {
  const node = loop.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new LoopRunIntegrityError(`Work Loop Node ${loop.id}:${nodeId} was not found in the Root snapshot.`);
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
