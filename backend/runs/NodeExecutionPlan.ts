import { randomUUID } from "node:crypto";
import {
  isProjectAgentValidationNode,
  isProjectProviderWorkNode,
  type JsonValue
} from "../../shared/domain/automation.js";
import type {
  ControlFlowEvent, ExecutionSpec, LoopRunDetails, LoopStateRevision, NodeRun,
  RootExecutionSnapshot, WorkCompletedOutcome, WorkLoopNodeRun
} from "../../shared/domain/runtime.js";
import type {
  TaskEnvelopeHistoryEntry, TaskEnvelopeResumeContext, TaskEnvelopeV2
} from "../../shared/domain/taskEnvelope.js";
import { composeExecutionPrompt, runtimeForNode } from "../execution/ExecutionComposition.js";
import { LoopRunIntegrityError } from "../runtime/LoopRunErrors.js";
import type { StoredRootRun } from "./RootRunStore.js";

export interface NodeExecutionPlanInput {
  root: StoredRootRun;
  run: LoopRunDetails;
  composite: WorkLoopNodeRun;
  node: NodeRun;
  state: LoopStateRevision;
  events: ControlFlowEvent[];
}

export const createNodeExecutionSpec = (input: NodeExecutionPlanInput): ExecutionSpec => {
  const { root, run, composite, node } = input;
  const loop = root.executionSnapshot.loops.find((candidate) => candidate.id === node.loopId);
  const definition = loop?.nodes.find((candidate) => candidate.id === node.workLoopNodeId);
  if (!loop || !definition || node.role === "orchestrator") throw new LoopRunIntegrityError(
    `Provider execution definition is missing for Node Run ${node.nodeRunId}.`
  );
  const profileId = node.role === "work" && isProjectProviderWorkNode(definition.work)
    ? definition.work.executionProfileId
    : node.role === "validation" && isProjectAgentValidationNode(definition.validation)
      ? definition.validation.executionProfileId
      : undefined;
  if (!profileId) throw new LoopRunIntegrityError(`Node Run ${node.nodeRunId} is not provider-executable.`);
  const evidence = composeExecutionPrompt(root.executionSnapshot, createNodeTaskEnvelope(input));
  if (evidence.nodeDefinitionId !== node.nodeDefinitionId) throw new LoopRunIntegrityError(
    `Node Run ${node.nodeRunId} definition identity does not match its immutable prompt evidence.`
  );
  const taskId = randomUUID();
  return {
    version: 4,
    taskId,
    kind: "node_execution",
    rootRunId: root.rootRunId,
    loopRunId: run.loopRunId,
    workLoopNodeRunId: composite.workLoopNodeRunId,
    nodeRunId: node.nodeRunId,
    evidence,
    runtime: runtimeForNode(root.executionSnapshot, profileId),
    project: root.executionSnapshot.project,
    createdAt: new Date().toISOString()
  };
};

export const createNodeTaskEnvelope = (input: NodeExecutionPlanInput): TaskEnvelopeV2 => {
  const { root, run, composite, node, state } = input;
  const loop = requireLoop(root.executionSnapshot, node.loopId);
  const definition = loop.nodes.find((candidate) => candidate.id === node.workLoopNodeId);
  if (!definition) throw new LoopRunIntegrityError(`Work Loop Node ${node.loopId}:${node.workLoopNodeId} is missing.`);
  const base = {
    version: 2 as const,
    run: {
      rootRunId: root.rootRunId,
      loopRunId: run.loopRunId,
      workLoopNodeRunId: composite.workLoopNodeRunId,
      nodeRunId: node.nodeRunId
    },
    loop: { id: loop.id, description: loop.description },
    workLoopNode: { id: definition.id, description: definition.description },
    state: { revision: state.revision, value: state.state, sha256: state.stateSha256 },
    localAttempt: composite.attempt,
    resume: readResume(node.context),
    relevantHistory: relevantHistory(input)
  };
  if (node.role === "work") return {
    ...base,
    role: "work",
    task: definition.work.task,
    previousValidationFeedback: readFeedback(node.context)
  };
  if (node.role === "validation") return {
    ...base,
    role: "validation",
    task: definition.validation.task,
    workOutcome: requireWorkOutcome(run, composite.workLoopNodeRunId)
  };
  throw new LoopRunIntegrityError(`Orchestrator Node Run ${node.nodeRunId} is outside this runtime phase.`);
};

const relevantHistory = (input: NodeExecutionPlanInput): TaskEnvelopeHistoryEntry[] => input.events.flatMap((event) => {
  if (!event.sourceNodeRunId) return [];
  const source = input.run.nodeRuns.find((node) => node.nodeRunId === event.sourceNodeRunId);
  const outcome = source?.outcome;
  if (!source || !outcome || !("summary" in outcome)) return [];
  return [{
    sequence: event.sequence,
    nodeRunId: source.nodeRunId,
    role: source.role,
    state: outcome.state,
    summary: outcome.summary,
    stateRevision: event.stateRevision
  }];
});

const requireWorkOutcome = (run: LoopRunDetails, compositeId: string): WorkCompletedOutcome => {
  const outcome = [...run.nodeRuns].reverse().find((candidate) =>
    candidate.workLoopNodeRunId === compositeId
    && candidate.role === "work"
    && candidate.outcome?.role === "work"
    && candidate.outcome.state === "completed")?.outcome;
  if (!outcome || outcome.role !== "work" || outcome.state !== "completed") {
    throw new LoopRunIntegrityError(`Validation Node has no canonical completed Work outcome.`);
  }
  return outcome;
};

const readResume = (value: JsonValue | undefined): TaskEnvelopeResumeContext | undefined => {
  const candidate = objectField(value, "resume");
  return candidate && typeof candidate.question === "string" && typeof candidate.context === "string"
    && typeof candidate.response === "string"
    ? { question: candidate.question, context: candidate.context, response: candidate.response }
    : undefined;
};

const readFeedback = (value: JsonValue | undefined) => {
  const candidate = objectField(value, "previousValidationFeedback");
  return candidate && typeof candidate.feedback === "string" && typeof candidate.expectedCorrection === "string"
    ? { feedback: candidate.feedback, expectedCorrection: candidate.expectedCorrection }
    : undefined;
};

const objectField = (value: JsonValue | undefined, key: string): { [key: string]: JsonValue } | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value) || !(key in value)) return undefined;
  const field = value[key];
  return field && typeof field === "object" && !Array.isArray(field) ? field : undefined;
};

const requireLoop = (snapshot: RootExecutionSnapshot, loopId: string) => {
  const loop = snapshot.loops.find((candidate) => candidate.id === loopId);
  if (!loop) throw new LoopRunIntegrityError(`Loop ${loopId} is missing from the Root snapshot.`);
  return loop;
};
