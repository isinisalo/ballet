import { randomUUID } from "node:crypto";
import { taskEnvelopeRepairReturnSchema } from "../../shared/api/task-envelope-schemas.js";
import {
  isProjectAgentValidationNode,
  isProjectProviderWorkNode,
  type JsonValue
} from "../../shared/domain/automation.js";
import type {
  ControlFlowEvent, ExecutionSpec, LoopRunDetails, LoopStateRevision, NodeRun,
  RepairRequest, RootExecutionSnapshot, WorkCompletedOutcome, WorkLoopNodeRun
} from "../../shared/domain/runtime.js";
import type {
  TaskEnvelopeHistoryEntry, TaskEnvelopeRepairRequest, TaskEnvelopeRepairReturn,
  TaskEnvelopeResumeContext, TaskEnvelopeV3
} from "../../shared/domain/taskEnvelope.js";
import { composeExecutionPrompt, runtimeForNode } from "../execution/ExecutionComposition.js";
import { LoopRunIntegrityError } from "../runtime/LoopRunErrors.js";
import type { StoredRootRun } from "./RootRunStore.js";

export const LOOP_ORCHESTRATOR_TASK =
  "Select exactly one allowed target Loop for the persisted Repair Request.";

export interface NodeExecutionPlanInput {
  root: StoredRootRun;
  run: LoopRunDetails;
  composite?: WorkLoopNodeRun;
  node: NodeRun;
  state: LoopStateRevision;
  events: ControlFlowEvent[];
  repairRequest?: RepairRequest;
}

export const createNodeExecutionSpec = (input: NodeExecutionPlanInput): ExecutionSpec => {
  const { root, run, composite, node } = input;
  const loop = requireLoop(root.executionSnapshot, node.loopId);
  let profileId: string | undefined;
  if (node.role === "orchestrator") {
    requireOrchestratorRequest(node, input.repairRequest);
    profileId = root.executionSnapshot.orchestrator.executionProfileId;
  } else {
    const definition = loop.nodes.find((candidate) => candidate.id === node.workLoopNodeId);
    if (!definition || !composite) throw new LoopRunIntegrityError(
      `Provider execution definition is missing for Node Run ${node.nodeRunId}.`
    );
    profileId = node.role === "work" && isProjectProviderWorkNode(definition.work)
      ? definition.work.executionProfileId
      : node.role === "validation" && isProjectAgentValidationNode(definition.validation)
        ? definition.validation.executionProfileId
        : undefined;
  }
  if (!profileId) throw new LoopRunIntegrityError(`Node Run ${node.nodeRunId} is not provider-executable.`);
  const evidence = composeExecutionPrompt(root.executionSnapshot, createNodeTaskEnvelope(input));
  if (evidence.nodeDefinitionId !== node.nodeDefinitionId) throw new LoopRunIntegrityError(
    `Node Run ${node.nodeRunId} definition identity does not match its immutable prompt evidence.`
  );
  const taskId = randomUUID();
  return {
    version: 5,
    taskId,
    kind: "node_execution",
    rootRunId: root.rootRunId,
    loopRunId: run.loopRunId,
    workLoopNodeRunId: composite?.workLoopNodeRunId,
    nodeRunId: node.nodeRunId,
    evidence,
    runtime: runtimeForNode(root.executionSnapshot, profileId),
    project: root.executionSnapshot.project,
    createdAt: new Date().toISOString()
  };
};

export const createNodeTaskEnvelope = (input: NodeExecutionPlanInput): TaskEnvelopeV3 => {
  const { root, run, composite, node, state } = input;
  const loop = requireLoop(root.executionSnapshot, node.loopId);
  const common = {
    version: 3 as const,
    loop: { id: loop.id, description: loop.description },
    state: { revision: state.revision, value: state.state, sha256: state.stateSha256 },
    resume: readResume(node.context),
    relevantHistory: relevantHistory(input)
  };
  if (node.role === "orchestrator") {
    const request = requireOrchestratorRequest(node, input.repairRequest);
    return {
      ...common,
      role: "orchestrator",
      run: { rootRunId: root.rootRunId, loopRunId: run.loopRunId, nodeRunId: node.nodeRunId },
      task: LOOP_ORCHESTRATOR_TASK,
      repairRequest: requestProjection(request),
      allowedTargetLoops: root.executionSnapshot.loopEdges
        .filter((edge) => edge.kind === "repair" && edge.source === loop.id)
        .map((edge) => {
          const target = requireLoop(root.executionSnapshot, edge.target);
          return {
            id: target.id, description: target.description,
            loopEdgeId: edge.id, routingDescription: edge.description
          };
        })
    };
  }
  const definition = loop.nodes.find((candidate) => candidate.id === node.workLoopNodeId);
  if (!definition || !composite) throw new LoopRunIntegrityError(
    `Work Loop Node ${node.loopId}:${node.workLoopNodeId} is missing.`
  );
  const base = {
    ...common,
    run: {
      rootRunId: root.rootRunId, loopRunId: run.loopRunId,
      workLoopNodeRunId: composite.workLoopNodeRunId, nodeRunId: node.nodeRunId
    },
    workLoopNode: { id: definition.id, description: definition.description },
    localAttempt: composite.attempt
  };
  if (node.role === "work") return {
    ...base, role: "work", task: definition.work.task,
    previousValidationFeedback: readFeedback(node.context)
  };
  return {
    ...base, role: "validation", task: definition.validation.task,
    workOutcome: requireWorkOutcome(run, composite.workLoopNodeRunId),
    repairReturn: readRepairReturn(node.context)
  };
};

const relevantHistory = (input: NodeExecutionPlanInput): TaskEnvelopeHistoryEntry[] => input.events.flatMap((event) => {
  if (!event.sourceNodeRunId) return [];
  const source = input.run.nodeRuns.find((node) => node.nodeRunId === event.sourceNodeRunId);
  const outcome = source?.outcome;
  if (!source || !outcome || !("summary" in outcome)) return [];
  return [{
    sequence: event.sequence, nodeRunId: source.nodeRunId, role: source.role,
    state: outcome.state, summary: outcome.summary, stateRevision: event.stateRevision
  }];
});

const requestProjection = (request: RepairRequest): TaskEnvelopeRepairRequest => ({
  id: request.repairRequestId,
  requesterLoopRunId: request.requesterLoopRunId,
  requesterWorkLoopNodeRunId: request.requesterWorkLoopNodeRunId,
  requesterValidationNodeRunId: request.requesterValidationNodeRunId,
  attempt: request.attempt,
  validationSummary: request.validationSummary,
  reason: request.reason,
  stateRevisionAtRequest: request.stateRevisionAtRequest,
  nestingDepth: request.nestingDepth,
  ...(request.evidence !== undefined ? { evidence: request.evidence } : {}),
  ...(request.requestedCapability !== undefined
    ? { requestedCapability: request.requestedCapability }
    : { requestedOutcome: request.requestedOutcome! })
});

const requireOrchestratorRequest = (node: NodeRun, request: RepairRequest | undefined): RepairRequest => {
  if (!request || request.orchestratorNodeRunId !== node.nodeRunId || request.requesterLoopRunId !== node.loopRunId
    || request.status !== "pending" || request.mode !== "orchestrator") {
    throw new LoopRunIntegrityError(`Orchestrator Node Run ${node.nodeRunId} has no matching pending Repair Request.`);
  }
  return request;
};

const requireWorkOutcome = (run: LoopRunDetails, compositeId: string): WorkCompletedOutcome => {
  const outcome = [...run.nodeRuns].reverse().find((candidate) =>
    candidate.workLoopNodeRunId === compositeId && candidate.role === "work"
    && candidate.outcome?.role === "work" && candidate.outcome.state === "completed")?.outcome;
  if (!outcome || outcome.role !== "work" || outcome.state !== "completed") {
    throw new LoopRunIntegrityError("Validation Node has no canonical completed Work outcome.");
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

const readRepairReturn = (value: JsonValue | undefined): TaskEnvelopeRepairReturn | undefined => {
  const candidate = objectField(value, "repairReturn");
  return candidate ? taskEnvelopeRepairReturnSchema.parse(candidate) : undefined;
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
