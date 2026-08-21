import type { JsonValue, ProjectJobNode, ProjectLoop } from "../../shared/domain/automation.js";
import {
  isProjectHumanJobNode, isProjectHumanValidationNode, resolveProjectWorkflowStartJob
} from "../../shared/domain/automation.js";
import type {
  LoopRunSource, NodeRun, OrchestrationFrame, OrchestrationRequest, RepairRequest
} from "../../shared/domain/runtime.js";
import type { TaskEnvelopeRepairReturn } from "../../shared/domain/taskEnvelope.js";
import { LoopRunIntegrityError, LoopRunStateError } from "./LoopRunErrors.js";
import { GraphRunStateStore } from "./GraphRunStateStore.js";
import type { LoopRunStore } from "./LoopRunStore.js";
import type { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import type { WorkflowProgressStore } from "./WorkflowProgressStore.js";
import { requireValidationNode } from "./WorkflowEngineSupport.js";
import { assertJsonValue } from "./state/CanonicalJson.js";

export class WorkflowPhaseFactory {
  private readonly graphState: GraphRunStateStore;

  constructor(
    connection: () => import("better-sqlite3").Database,
    private readonly loops: LoopRunStore,
    private readonly snapshots: RootExecutionSnapshotStore,
    private readonly progress: WorkflowProgressStore
  ) {
    this.graphState = new GraphRunStateStore(connection);
  }

  startRoot(
    rootRunId: string,
    input?: string,
    source: LoopRunSource = "manual",
    schedule?: { jobNodeId: string; scheduledFor: string }
  ) {
    const snapshot = this.snapshots.require(rootRunId);
    const loop = this.snapshots.loop(snapshot, snapshot.rootLoopId);
    const start = this.startDefinition(loop);
    if (source === "schedule" && (!schedule || start.type !== "scheduled" || schedule.jobNodeId !== start.id)) {
      throw new LoopRunStateError(`Scheduled Job Node is not the immutable start of Loop ${loop.id}.`);
    }
    return this.startInvocation(rootRunId, loop, source, 0, { input, schedule });
  }

  startTransition(rootRunId: string, loop: ProjectLoop, input: JsonValue, revision: number) {
    return this.startInvocation(rootRunId, loop, "transition", revision, { input });
  }

  startRepair(
    loop: ProjectLoop,
    callerLoopRunId: string,
    request: RepairRequest,
    orchestrationRequest: OrchestrationRequest,
    input: JsonValue,
    revision: number
  ) {
    return this.startInvocation(request.rootRunId, loop, "repair", revision, {
      input, parentLoopRunId: callerLoopRunId,
      orchestrationRequestId: orchestrationRequest.orchestrationRequestId,
      repairRequestId: request.repairRequestId, nestingDepth: request.nestingDepth
    });
  }

  createOrchestrator(
    loop: ProjectLoop,
    rootRunId: string,
    loopRunId: string,
    requestId: string,
    attempt: number,
    revision: number,
    context?: JsonValue
  ): NodeRun {
    const value: unknown = context === undefined
      ? { orchestrationRequestId: requestId }
      : mergeContext(requestId, context);
    assertJsonValue(value, { label: `Orchestrator Node context for ${requestId}` });
    return this.loops.createNodeRun({
      rootRunId, loopRunId, role: "orchestrator", loopId: loop.id,
      nodeDefinitionId: `${loop.id}:root:orchestrator`, attempt,
      stateRevisionBefore: revision, context: value
    });
  }

  returnValidation(frame: OrchestrationFrame, repairReturn: TaskEnvelopeRepairReturn, revision: number): NodeRun {
    const details = this.loops.details(frame.callerLoopRunId);
    if (!details) throw new LoopRunIntegrityError(`Caller Loop Run ${frame.callerLoopRunId} was not found.`);
    const loop = this.snapshots.loop(this.snapshots.require(frame.rootRunId), frame.returnLoopId);
    const job = loop.workflow.jobNodes.find((candidate) => candidate.id === frame.returnJobNodeId);
    const validation = job ? requireValidationNode(loop, job.validationNodeId) : undefined;
    const jobRun = details.jobRuns.find((candidate) =>
      candidate.jobNodeId === frame.returnJobNodeId && candidate.status === "running");
    if (!job || !validation || !jobRun
      || `${loop.id}:${validation.id}:validation` !== frame.returnValidationNodeDefinitionId) {
      throw new LoopRunIntegrityError(`Frame ${frame.frameId} has an invalid Validation Node continuation.`);
    }
    const previousAttempt = Math.max(0, ...details.nodeRuns.filter((candidate) =>
      candidate.jobRunId === jobRun.jobRunId && candidate.role === "validation")
      .map((candidate) => candidate.attempt));
    const context: unknown = { repairReturn };
    assertJsonValue(context, { label: `Repair return context for frame ${frame.frameId}` });
    return this.createPhase(
      loop, job, jobRun.jobRunId, details.loopRunId,
      "validation", previousAttempt + 1, revision, context
    );
  }

  createPhase(
    loop: ProjectLoop,
    job: ProjectJobNode,
    jobRunId: string,
    loopRunId: string,
    role: "job" | "validation",
    attempt: number,
    revision: number,
    context?: JsonValue
  ): NodeRun {
    const details = this.loops.details(loopRunId);
    if (!details) throw new LoopRunIntegrityError(`Loop Run ${loopRunId} was not found.`);
    const validation = requireValidationNode(loop, job.validationNodeId);
    const workflowNode = role === "job" ? job : validation;
    const human = role === "job" ? isProjectHumanJobNode(job) : isProjectHumanValidationNode(validation);
    const node = this.loops.createNodeRun({
      rootRunId: details.rootRunId, loopRunId, jobRunId,
      role, loopId: loop.id, jobNodeId: job.id, workflowNodeId: workflowNode.id,
      nodeDefinitionId: `${loop.id}:${workflowNode.id}:${role}`, attempt,
      stateRevisionBefore: revision, status: human ? "waiting_for_input" : "queued", context
    });
    if (human) this.progress.waitForHuman(node);
    return node;
  }

  private startInvocation(
    rootRunId: string,
    loop: ProjectLoop,
    source: LoopRunSource,
    revision: number,
    options: {
      input?: JsonValue;
      schedule?: { jobNodeId: string; scheduledFor: string };
      parentLoopRunId?: string;
      orchestrationRequestId?: string;
      repairRequestId?: string;
      nestingDepth?: number;
    } = {}
  ) {
    const job = this.startDefinition(loop);
    const run = this.loops.createLoopRun({
      rootRunId, loop, source, input: options.input, schedule: options.schedule,
      parentLoopRunId: options.parentLoopRunId, repairRequestId: options.repairRequestId,
      orchestrationRequestId: options.orchestrationRequestId,
      entryStateRevision: revision, nestingDepth: options.nestingDepth ?? 0
    });
    this.graphState.bindInvocation(rootRunId, loop.id, run.loopRunId);
    const jobRun = this.loops.createJobRun({
      rootRunId, loopRunId: run.loopRunId, loopId: loop.id,
      jobNodeId: job.id, jobAttempt: 1, stateRevisionBefore: revision
    });
    this.createPhase(loop, job, jobRun.jobRunId, run.loopRunId, "job", 1, revision);
    return { loopRunId: run.loopRunId, jobRunId: jobRun.jobRunId };
  }

  private startDefinition(loop: ProjectLoop): ProjectJobNode {
    const start = resolveProjectWorkflowStartJob(loop);
    if (!start) throw new LoopRunIntegrityError(
      `Loop ${loop.id} has no start Job Node ${loop.workflow.startJobNodeId}.`
    );
    return start;
  }
}

const mergeContext = (orchestrationRequestId: string, context: JsonValue): JsonValue => {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new LoopRunIntegrityError(`Orchestrator ${orchestrationRequestId} resume context must be an object.`);
  }
  return { orchestrationRequestId, ...context };
};
