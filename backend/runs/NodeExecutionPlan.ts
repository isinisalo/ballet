import { randomUUID } from "node:crypto";
import { taskEnvelopeRepairReturnSchema } from "../../shared/api/task-envelope-schemas.js";
import {
  isProjectAgentValidationNode,
  isProjectProviderJobNode,
  type JsonValue
} from "../../shared/domain/automation.js";
import type {
  ControlFlowEvent, ExecutionSpec, LoopRunDetails, LoopStateRevision, NodeRun,
  OrchestrationRequest, RootExecutionSnapshot, JobCompletedOutcome, JobRun
} from "../../shared/domain/runtime.js";
import type {
  TaskEnvelopeHistoryEntry, TaskEnvelopeOrchestrationRequest, TaskEnvelopeRepairReturn,
  TaskEnvelopeResumeContext, TaskEnvelopeV5
} from "../../shared/domain/taskEnvelope.js";
import { composeExecutionPrompt, runtimeForNode } from "../execution/ExecutionComposition.js";
import { LoopRunIntegrityError } from "../runtime/LoopRunErrors.js";
import type { StoredRootRun } from "./RootRunStore.js";

export const LOOP_ORCHESTRATOR_TASK =
  "Select exactly one allowed candidate Loop for the persisted Orchestration Request.";

export interface NodeExecutionPlanInput {
  root: StoredRootRun;
  run: LoopRunDetails;
  jobRun?: JobRun;
  node: NodeRun;
  state: LoopStateRevision;
  events: ControlFlowEvent[];
  orchestrationRequest?: OrchestrationRequest;
}

export const createNodeExecutionSpec = (input: NodeExecutionPlanInput): ExecutionSpec => {
  const { root, run, jobRun, node } = input;
  const loop = requireLoop(root.executionSnapshot, node.loopId);
  let profileId: string | undefined;
  if (node.role === "orchestrator") {
    requireOrchestratorRequest(node, input.orchestrationRequest);
    profileId = root.executionSnapshot.orchestrator.executionProfileId;
  } else {
    const job = loop.workflow.jobNodes.find((candidate) => candidate.id === node.jobNodeId);
    const validation = node.role === "validation"
      ? loop.workflow.validationNodes.find((candidate) => candidate.id === node.workflowNodeId)
      : undefined;
    if (!job || (node.role === "validation" && !validation) || !jobRun) throw new LoopRunIntegrityError(
      `Provider execution definition is missing for Node Run ${node.nodeRunId}.`
    );
    profileId = node.role === "job" && isProjectProviderJobNode(job)
      ? job.executionProfileId
      : node.role === "validation" && validation && isProjectAgentValidationNode(validation)
        ? validation.executionProfileId
        : undefined;
  }
  if (!profileId) throw new LoopRunIntegrityError(`Node Run ${node.nodeRunId} is not provider-executable.`);
  const evidence = composeExecutionPrompt(root.executionSnapshot, createNodeTaskEnvelope(input));
  if (evidence.nodeDefinitionId !== node.nodeDefinitionId) throw new LoopRunIntegrityError(
    `Node Run ${node.nodeRunId} definition identity does not match its immutable prompt evidence.`
  );
  const taskId = randomUUID();
  return {
    version: 7,
    taskId,
    kind: "node_execution",
    rootRunId: root.rootRunId,
    loopRunId: run.loopRunId,
    jobRunId: jobRun?.jobRunId,
    nodeRunId: node.nodeRunId,
    evidence,
    runtime: runtimeForNode(root.executionSnapshot, profileId),
    project: root.executionSnapshot.project,
    createdAt: new Date().toISOString()
  };
};

export const createNodeTaskEnvelope = (input: NodeExecutionPlanInput): TaskEnvelopeV5 => {
  const { root, run, jobRun, node, state } = input;
  const loop = requireLoop(root.executionSnapshot, node.loopId);
  const common = {
    version: 5 as const,
    loop: { id: loop.id, description: loop.description },
    state: { revision: state.revision, value: state.state, sha256: state.stateSha256 },
    resume: readResume(node.context),
    relevantHistory: relevantHistory(input)
  };
  if (node.role === "orchestrator") {
    const request = requireOrchestratorRequest(node, input.orchestrationRequest);
    return {
      ...common,
      role: "orchestrator",
      run: { rootRunId: root.rootRunId, loopRunId: run.loopRunId, nodeRunId: node.nodeRunId },
      task: LOOP_ORCHESTRATOR_TASK,
      orchestrationRequest: requestProjection(request),
      allowedCandidates: root.executionSnapshot.graph.loopEdges
        .filter((edge) => edge.kind === request.kind && edge.source === loop.id)
        .filter((edge) => request.kind !== "repair" || !request.requestedCapability
          || edge.capability === request.requestedCapability)
        .flatMap((edge) => {
          const target = requireLoop(root.executionSnapshot, edge.target);
          const compatible = edge.kind === "repair"
            ? target.capabilities.provides.includes(edge.capability)
            : target.capabilities.accepts.includes(edge.capability);
          return compatible ? [{
            id: target.id, description: target.description,
            capabilities: target.capabilities,
            route: { kind: edge.kind, capability: edge.capability, description: edge.description }
          }] : [];
        })
    };
  }
  const job = loop.workflow.jobNodes.find((candidate) => candidate.id === node.jobNodeId);
  const validation = loop.workflow.validationNodes.find((candidate) => candidate.id === job?.validationNodeId);
  if (!job || !validation || !jobRun) throw new LoopRunIntegrityError(
    `JobNode ${node.loopId}:${node.jobNodeId} or its ValidationNode is missing.`
  );
  const base = {
    ...common,
    run: {
      rootRunId: root.rootRunId, loopRunId: run.loopRunId,
      jobRunId: jobRun.jobRunId, nodeRunId: node.nodeRunId
    },
    jobNode: { id: job.id, description: job.description },
    jobAttempt: jobRun.jobAttempt
  };
  if (node.role === "job") return {
    ...base, role: "job", task: job.task,
    previousValidationFeedback: readFeedback(node.context)
  };
  return {
    ...base, role: "validation", validationNode: { id: validation.id, description: validation.description }, task: validation.task,
    jobOutcome: requireJobOutcome(run, jobRun.jobRunId),
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

const requestProjection = (request: OrchestrationRequest): TaskEnvelopeOrchestrationRequest => ({
  id: request.orchestrationRequestId,
  kind: request.kind,
  sourceLoopId: request.sourceLoopId,
  sourceLoopRunId: request.sourceLoopRunId,
  sourceNodeRunId: request.sourceNodeRunId,
  stateRevisionAtRequest: request.stateRevisionAtRequest,
  completionSummary: request.completionSummary,
  completionEvidence: request.completionEvidence,
  ...(request.requestedCapability !== undefined ? { requestedCapability: request.requestedCapability } : {}),
  ...(request.expectedOutcome !== undefined ? { expectedOutcome: request.expectedOutcome } : {})
});

const requireOrchestratorRequest = (
  node: NodeRun,
  request: OrchestrationRequest | undefined
): OrchestrationRequest => {
  if (!request || request.orchestratorNodeRunId !== node.nodeRunId
    || request.sourceLoopRunId !== node.loopRunId || request.sourceLoopId !== node.loopId
    || request.status !== "pending") {
    throw new LoopRunIntegrityError(
      `Orchestrator Node Run ${node.nodeRunId} has no matching pending Orchestration Request.`
    );
  }
  return request;
};

const requireJobOutcome = (run: LoopRunDetails, jobRunId: string): JobCompletedOutcome => {
  const outcome = [...run.nodeRuns].reverse().find((candidate) =>
    candidate.jobRunId === jobRunId && candidate.role === "job"
    && candidate.outcome?.role === "job" && candidate.outcome.state === "completed")?.outcome;
  if (!outcome || outcome.role !== "job" || outcome.state !== "completed") {
    throw new LoopRunIntegrityError("ValidationNode has no canonical completed Job outcome.");
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
