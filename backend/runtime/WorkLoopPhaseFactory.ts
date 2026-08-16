import type {
  JsonValue, ProjectLoop, ProjectWorkLoopNode
} from "../../shared/domain/automation.js";
import {
  isProjectHumanValidationNode, isProjectHumanWorkNode, resolveProjectLoopStartNode
} from "../../shared/domain/automation.js";
import type {
  LoopRunSource, NodeRun, OrchestrationFrame, RepairRequest
} from "../../shared/domain/runtime.js";
import type { TaskEnvelopeRepairReturn } from "../../shared/domain/taskEnvelope.js";
import { LoopRunIntegrityError, LoopRunStateError } from "./LoopRunErrors.js";
import type { LoopRunStore } from "./LoopRunStore.js";
import type { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import type { WorkLoopProgressStore } from "./WorkLoopProgressStore.js";
import { assertJsonValue } from "./state/CanonicalJson.js";

export class WorkLoopPhaseFactory {
  constructor(
    private readonly loops: LoopRunStore,
    private readonly snapshots: RootExecutionSnapshotStore,
    private readonly progress: WorkLoopProgressStore
  ) {}

  startRoot(
    rootRunId: string,
    input?: string,
    source: LoopRunSource = "manual",
    schedule?: { workLoopNodeId: string; scheduledFor: string }
  ) {
    const snapshot = this.snapshots.require(rootRunId);
    const loop = this.snapshots.loop(snapshot, snapshot.rootLoopId);
    const start = this.startDefinition(loop);
    if (source === "schedule" && (!schedule || start.work.type !== "scheduled"
      || schedule.workLoopNodeId !== start.id)) {
      throw new LoopRunStateError(`Scheduled Work Node is not the immutable start of Loop ${loop.id}.`);
    }
    return this.startInvocation(rootRunId, loop, source, 0, { input, schedule });
  }

  startFlow(loop: ProjectLoop, rootRunId: string, revision: number) {
    return this.startInvocation(rootRunId, loop, "flow", revision);
  }

  startRepair(
    loop: ProjectLoop,
    callerLoopRunId: string,
    request: RepairRequest,
    input: JsonValue,
    revision: number
  ) {
    return this.startInvocation(request.rootRunId, loop, "repair", revision, {
      input, parentLoopRunId: callerLoopRunId,
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
      ? { repairRequestId: requestId }
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
    const definition = loop.nodes.find((candidate) => candidate.id === frame.returnWorkLoopNodeId);
    const composite = details.workLoopNodeRuns.find((candidate) =>
      candidate.workLoopNodeId === frame.returnWorkLoopNodeId && candidate.status === "running");
    if (!definition || !composite || `${loop.id}:${definition.id}:validation` !== frame.returnValidationNodeDefinitionId) {
      throw new LoopRunIntegrityError(`Frame ${frame.frameId} has an invalid Validation continuation.`);
    }
    const previousAttempt = Math.max(0, ...details.nodeRuns.filter((candidate) =>
      candidate.workLoopNodeRunId === composite.workLoopNodeRunId && candidate.role === "validation")
      .map((candidate) => candidate.attempt));
    const context: unknown = { repairReturn };
    assertJsonValue(context, { label: `Repair return context for frame ${frame.frameId}` });
    return this.createPhase(
      loop, definition, composite.workLoopNodeRunId, details.loopRunId,
      "validation", previousAttempt + 1, revision, context
    );
  }

  createPhase(
    loop: ProjectLoop,
    definition: ProjectWorkLoopNode,
    compositeId: string,
    loopRunId: string,
    role: "work" | "validation",
    attempt: number,
    revision: number,
    context?: JsonValue
  ): NodeRun {
    const details = this.loops.details(loopRunId);
    if (!details) throw new LoopRunIntegrityError(`Loop Run ${loopRunId} was not found.`);
    const human = role === "work"
      ? isProjectHumanWorkNode(definition.work)
      : isProjectHumanValidationNode(definition.validation);
    const node = this.loops.createNodeRun({
      rootRunId: details.rootRunId, loopRunId, workLoopNodeRunId: compositeId,
      role, loopId: loop.id, workLoopNodeId: definition.id,
      nodeDefinitionId: `${loop.id}:${definition.id}:${role}`, attempt,
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
      schedule?: { workLoopNodeId: string; scheduledFor: string };
      parentLoopRunId?: string;
      repairRequestId?: string;
      nestingDepth?: number;
    } = {}
  ) {
    const definition = this.startDefinition(loop);
    const run = this.loops.createLoopRun({
      rootRunId, loop, source, input: options.input, schedule: options.schedule,
      parentLoopRunId: options.parentLoopRunId, repairRequestId: options.repairRequestId,
      entryStateRevision: revision, nestingDepth: options.nestingDepth ?? 0
    });
    const composite = this.loops.createWorkLoopNodeRun({
      rootRunId, loopRunId: run.loopRunId, loopId: loop.id,
      workLoopNodeId: definition.id, attempt: 1, stateRevisionBefore: revision
    });
    this.createPhase(loop, definition, composite.workLoopNodeRunId, run.loopRunId, "work", 1, revision);
    return { loopRunId: run.loopRunId, workLoopNodeRunId: composite.workLoopNodeRunId };
  }

  private startDefinition(loop: ProjectLoop): ProjectWorkLoopNode {
    const start = resolveProjectLoopStartNode(loop);
    if (!start) throw new LoopRunIntegrityError(`Loop ${loop.id} has no start Work Loop Node ${loop.startNodeId}.`);
    return start;
  }
}

const mergeContext = (repairRequestId: string, context: JsonValue): JsonValue => {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new LoopRunIntegrityError(`Orchestrator ${repairRequestId} resume context must be an object.`);
  }
  return { repairRequestId, ...context };
};
