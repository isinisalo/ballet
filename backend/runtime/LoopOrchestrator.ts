import { randomUUID } from "node:crypto";
import type { JsonValue, ProjectLoop, ProjectWorkLoopNode } from "../../shared/domain/automation.js";
import type {
  NodeRun, OrchestratorNodeOutcome, RepairRequest, ValidationNodeOutcome
} from "../../shared/domain/runtime.js";
import type { LoopCompletionCallbacks, LoopCompletionEngine } from "./LoopCompletionEngine.js";
import { LoopRunIntegrityError } from "./LoopRunErrors.js";
import type { LoopRunStore } from "./LoopRunStore.js";
import type { LoopStateStore } from "./LoopStateStore.js";
import type { RepairStore } from "./RepairStore.js";
import type { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import type { WorkLoopProgressStore } from "./WorkLoopProgressStore.js";
import { requireOutcome } from "./WorkLoopEngineSupport.js";

type ValidationFailOutcome = ValidationNodeOutcome & { state: "completed"; decision: "FAIL" };

export interface LoopOrchestratorCallbacks extends LoopCompletionCallbacks {
  createOrchestrator(
    loop: ProjectLoop,
    loopRunId: string,
    requestId: string,
    attempt: number,
    revision: number,
    context?: JsonValue
  ): NodeRun;
  startRepair(
    loop: ProjectLoop,
    callerLoopRunId: string,
    request: RepairRequest,
    input: JsonValue,
    revision: number
  ): { loopRunId: string; workLoopNodeRunId: string };
}

export class LoopOrchestrator {
  constructor(
    private readonly connection: () => import("better-sqlite3").Database,
    private readonly loops: LoopRunStore,
    private readonly states: LoopStateStore,
    private readonly repairs: RepairStore,
    private readonly snapshots: RootExecutionSnapshotStore,
    private readonly progress: WorkLoopProgressStore,
    private readonly completion: LoopCompletionEngine
  ) {}

  request(
    node: NodeRun,
    outcome: ValidationFailOutcome,
    loop: ProjectLoop,
    definition: ProjectWorkLoopNode,
    compositeId: string,
    nestingDepth: number,
    callbacks: LoopOrchestratorCallbacks
  ): void {
    if (outcome.repair.mode !== "ORCHESTRATOR_REPAIR") {
      throw new LoopRunIntegrityError("Loop Orchestrator requires an external Repair Request outcome.");
    }
    const snapshot = this.snapshots.require(node.rootRunId);
    const attempt = this.repairs.orchestratorAttemptCount(compositeId) + 1;
    if (attempt > snapshot.orchestrator.maxRepairAttempts) {
      this.rejectRequestLimit(
        node, outcome, "repair_attempt_limit",
        `Work Loop Node ${definition.id} exceeded ${snapshot.orchestrator.maxRepairAttempts} external repair attempts.`,
        callbacks
      );
      return;
    }
    const requestDepth = nestingDepth + 1;
    if (requestDepth > snapshot.orchestrator.maxRepairDepth) {
      this.rejectRequestLimit(
        node, outcome, "repair_depth_limit",
        `Repair depth ${requestDepth} exceeds limit ${snapshot.orchestrator.maxRepairDepth}.`,
        callbacks
      );
      return;
    }
    const requestId = randomUUID();
    const committed = this.states.commitNodeOutcome({
      rootRunId: node.rootRunId, nodeRunId: node.nodeRunId, baseRevision: node.stateRevisionBefore,
      outcome, workLoopNodeStatus: "waiting_for_input",
      control: { kind: "validation_fail_orchestrator" }
    });
    const request = this.repairs.createRequest({
      repairRequestId: requestId,
      rootRunId: node.rootRunId, requesterLoopRunId: node.loopRunId,
      requesterWorkLoopNodeRunId: compositeId, requesterValidationNodeRunId: node.nodeRunId,
      mode: "orchestrator", attempt, validationSummary: outcome.summary,
      requestedCapability: outcome.repair.requestedCapability,
      requestedOutcome: outcome.repair.requestedOutcome,
      reason: outcome.repair.reason,
      evidence: { validation: outcome.evidence, refs: outcome.repair.evidenceRefs },
      stateRevisionAtRequest: committed.revision.revision,
      returnLoopId: node.loopId, returnWorkLoopNodeId: definition.id,
      returnValidationNodeDefinitionId: node.nodeDefinitionId, nestingDepth: requestDepth
    });
    this.connection().prepare(`
      UPDATE control_flow_events SET repair_request_id = ? WHERE id = ?
    `).run(request.repairRequestId, committed.controlFlowEventId);
    const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "validation", "completed");
    const orchestrator = callbacks.createOrchestrator(
      loop, node.loopRunId, request.repairRequestId, 1,
      persisted.stateRevisionAfter ?? node.stateRevisionBefore
    );
    this.repairs.bindOrchestrator(request.repairRequestId, orchestrator.nodeRunId);
  }

  apply(
    node: NodeRun,
    outcome: OrchestratorNodeOutcome,
    callbacks: LoopOrchestratorCallbacks
  ): void {
    const request = this.repairs.requestForOrchestrator(node.nodeRunId);
    if (!request) throw new LoopRunIntegrityError(
      `Orchestrator Node Run ${node.nodeRunId} has no persisted Repair Request.`
    );
    if (outcome.state !== "completed") {
      if (outcome.state === "needs_input") throw new LoopRunIntegrityError("Paused Orchestrator reached terminal flow.");
      this.failOutcome(node, request, outcome, callbacks);
      return;
    }
    const committed = this.states.commitNodeOutcome({
      rootRunId: node.rootRunId, nodeRunId: node.nodeRunId, baseRevision: node.stateRevisionBefore,
      outcome, control: { kind: "repair_call", repairRequestId: request.repairRequestId }
    });
    const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "orchestrator", "completed");
    const persistedOutcome = requireCompletedOrchestratorOutcome(persisted.outcome);
    const issue = this.routeIssue(node, request, persistedOutcome.targetLoopId);
    if (issue) {
      this.connection().prepare(`
        UPDATE control_flow_events SET kind = 'orchestrator_terminal' WHERE id = ?
      `).run(committed.controlFlowEventId);
      this.completion.failPendingRequest(
        request, persisted, "failed", persisted.stateRevisionAfter ?? node.stateRevisionBefore,
        persisted.outcome, "invalid_orchestrator_route", issue
      );
      return;
    }
    const edge = this.allowedEdge(node, persistedOutcome.targetLoopId);
    const routeId = randomUUID();
    this.repairs.routeRequest({
      repairRequestId: request.repairRequestId, loopEdgeId: edge.id,
      sourceLoopId: node.loopId, targetLoopId: persistedOutcome.targetLoopId,
      orchestratorNodeRunId: node.nodeRunId,
      evidence: { routeReason: persistedOutcome.routeReason, expectedOutcome: persistedOutcome.expectedOutcome },
      routeId
    });
    const route = this.repairs.routeForRequest(request.repairRequestId);
    if (!route || route.routeId !== routeId || route.targetLoopId !== persistedOutcome.targetLoopId) {
      throw new LoopRunIntegrityError(`Repair Request ${request.repairRequestId} has no canonical persisted route.`);
    }
    const revision = persisted.stateRevisionAfter ?? node.stateRevisionBefore;
    const parentFrame = this.repairs.openFrameForCallee(node.loopRunId);
    this.progress.suspendLoop(node.loopRunId);
    const targetLoop = this.snapshots.loop(this.snapshots.require(node.rootRunId), route.targetLoopId);
    const target = callbacks.startRepair(
      targetLoop, node.loopRunId, this.repairs.requireRequest(request.repairRequestId),
      persistedOutcome.repairInput, revision
    );
    const frame = this.repairs.createFrame({
      rootRunId: node.rootRunId, repairRequestId: request.repairRequestId, routeId,
      callerLoopRunId: node.loopRunId, calleeLoopRunId: target.loopRunId,
      parentFrameId: parentFrame?.frameId,
      returnLoopId: request.returnLoopId, returnWorkLoopNodeId: request.returnWorkLoopNodeId,
      returnValidationNodeDefinitionId: request.returnValidationNodeDefinitionId,
      stateRevisionAtCall: revision, nestingDepth: request.nestingDepth
    });
    this.loops.bindOrchestrationFrame(target.loopRunId, frame.frameId);
    this.connection().prepare(`
      UPDATE control_flow_events SET target_loop_run_id = ?, target_work_loop_node_run_id = ?,
        orchestration_frame_id = ? WHERE id = ?
    `).run(target.loopRunId, target.workLoopNodeRunId, frame.frameId, committed.controlFlowEventId);
  }

  private failOutcome(
    node: NodeRun,
    request: RepairRequest,
    outcome: Extract<OrchestratorNodeOutcome, { state: "blocked" | "failed" }>,
    callbacks: LoopCompletionCallbacks
  ): void {
    this.states.commitNodeOutcome({
      rootRunId: node.rootRunId, nodeRunId: node.nodeRunId, baseRevision: node.stateRevisionBefore,
      outcome, nodeStatus: outcome.state,
      errorCode: `orchestrator_${outcome.state}`, errorMessage: outcome.summary,
      control: { kind: "orchestrator_terminal", repairRequestId: request.repairRequestId }
    });
    const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "orchestrator", outcome.state);
    this.completion.failPendingRequest(
      request, node, outcome.state, persisted.stateRevisionAfter ?? node.stateRevisionBefore,
      persisted.outcome, `orchestrator_${outcome.state}`, outcome.summary
    );
    void callbacks;
  }

  private rejectRequestLimit(
    node: NodeRun,
    outcome: ValidationFailOutcome,
    code: string,
    message: string,
    callbacks: LoopCompletionCallbacks
  ): void {
    this.states.commitNodeOutcome({
      rootRunId: node.rootRunId, nodeRunId: node.nodeRunId, baseRevision: node.stateRevisionBefore,
      outcome, workLoopNodeStatus: "blocked", workLoopNodeTerminal: "blocked",
      errorCode: code, errorMessage: message,
      control: { kind: "validation_fail_orchestrator" }
    });
    const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "validation", "completed");
    this.completion.complete(
      persisted, "blocked", persisted.stateRevisionAfter ?? node.stateRevisionBefore,
      persisted.outcome, callbacks
    );
  }

  private routeIssue(node: NodeRun, request: RepairRequest, targetLoopId: string): string | undefined {
    const snapshot = this.snapshots.require(node.rootRunId);
    if (request.status !== "pending" || request.mode !== "orchestrator") {
      return `Repair Request ${request.repairRequestId} is not pending.`;
    }
    if (request.nestingDepth > snapshot.orchestrator.maxRepairDepth) {
      return `Repair Request depth ${request.nestingDepth} exceeds limit ${snapshot.orchestrator.maxRepairDepth}.`;
    }
    if (request.attempt > snapshot.orchestrator.maxRepairAttempts) {
      return `Repair Request attempt ${request.attempt} exceeds limit ${snapshot.orchestrator.maxRepairAttempts}.`;
    }
    if (!snapshot.loops.some((loop) => loop.id === targetLoopId)) {
      return `Orchestrator selected unknown snapshot Loop ${targetLoopId}.`;
    }
    const edges = snapshot.loopEdges.filter((edge) =>
      edge.kind === "repair" && edge.source === node.loopId && edge.target === targetLoopId);
    if (edges.length !== 1) {
      return `Loop ${targetLoopId} is not an unambiguous allowed repair target from ${node.loopId}.`;
    }
    return undefined;
  }

  private allowedEdge(node: NodeRun, targetLoopId: string) {
    const snapshot = this.snapshots.require(node.rootRunId);
    const edge = snapshot.loopEdges.find((candidate) =>
      candidate.kind === "repair" && candidate.source === node.loopId && candidate.target === targetLoopId);
    if (!edge) throw new LoopRunIntegrityError(`Repair route ${node.loopId} -> ${targetLoopId} disappeared.`);
    return edge;
  }
}

const requireCompletedOrchestratorOutcome = (
  outcome: import("../../shared/domain/runtime.js").CanonicalNodeOutcome
): Extract<OrchestratorNodeOutcome, { state: "completed" }> => {
  if (outcome.role !== "orchestrator" || outcome.state !== "completed") {
    throw new LoopRunIntegrityError("Persisted completed Orchestrator outcome is unavailable.");
  }
  return outcome;
};
