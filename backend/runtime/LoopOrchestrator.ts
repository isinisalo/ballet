import { randomUUID } from "node:crypto";
import type { JsonValue, ProjectJobNode, ProjectLoop } from "../../shared/domain/automation.js";
import {
  maxOrchestratorDispatchValueBytes, type CanonicalNodeOutcome, type NodeRun, type OrchestrationRequest,
  type OrchestratorNodeOutcome, type RepairRequest, type ValidationNodeOutcome
} from "../../shared/domain/runtime.js";
import type { LoopCompletionCallbacks, LoopCompletionEngine } from "./LoopCompletionEngine.js";
import { LoopRunIntegrityError } from "./LoopRunErrors.js";
import type { LoopRunStore } from "./LoopRunStore.js";
import type { LoopStateStore } from "./LoopStateStore.js";
import type { OrchestrationStore } from "./OrchestrationStore.js";
import type { RepairStore } from "./RepairStore.js";
import type { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import type { WorkflowProgressStore } from "./WorkflowProgressStore.js";
import { requireOutcome } from "./WorkflowEngineSupport.js";
import { assertJsonValue } from "./state/CanonicalJson.js";

type ValidationFailOutcome = ValidationNodeOutcome & { state: "completed"; decision: "FAIL" };

export interface LoopOrchestratorCallbacks extends LoopCompletionCallbacks {
  createOrchestrator(
    loop: ProjectLoop, loopRunId: string, requestId: string, attempt: number, revision: number,
    context?: JsonValue
  ): NodeRun;
  startRepair(
    loop: ProjectLoop, callerLoopRunId: string, repairRequest: RepairRequest,
    orchestrationRequest: OrchestrationRequest, input: JsonValue, revision: number
  ): { loopRunId: string; jobRunId: string };
  startFlow(
    loop: ProjectLoop, request: OrchestrationRequest, input: JsonValue, revision: number
  ): { loopRunId: string; jobRunId: string };
}

export class LoopOrchestrator {
  constructor(
    private readonly connection: () => import("better-sqlite3").Database,
    private readonly loops: LoopRunStore,
    private readonly states: LoopStateStore,
    private readonly repairs: RepairStore,
    private readonly orchestration: OrchestrationStore,
    private readonly snapshots: RootExecutionSnapshotStore,
    private readonly progress: WorkflowProgressStore,
    private readonly completion: LoopCompletionEngine
  ) {}

  requestRepair(
    node: NodeRun,
    outcome: ValidationFailOutcome,
    loop: ProjectLoop,
    definition: ProjectJobNode,
    jobRunId: string,
    nestingDepth: number,
    callbacks: LoopOrchestratorCallbacks
  ): void {
    const snapshot = this.snapshots.require(node.rootRunId);
    const attempt = this.repairs.orchestratorAttemptCount(jobRunId) + 1;
    if (attempt > snapshot.orchestrator.maxRepairAttempts) {
      this.rejectRequestLimit(
        node, outcome, "repair_attempt_limit",
        `Job Node ${definition.id} exceeded ${snapshot.orchestrator.maxRepairAttempts} external repair attempts.`,
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
    const committed = this.states.commitNodeOutcome({
      rootRunId: node.rootRunId, nodeRunId: node.nodeRunId, baseRevision: node.stateRevisionBefore,
      outcome, jobRunStatus: "waiting_for_input",
      control: { kind: "validation_fail_escalated" }
    });
    const repairRequest = this.repairs.createRequest({
      repairRequestId: randomUUID(),
      rootRunId: node.rootRunId, requesterLoopRunId: node.loopRunId,
      requesterJobRunId: jobRunId, requesterValidationNodeRunId: node.nodeRunId,
      attempt, validationSummary: outcome.summary,
      requestedCapability: outcome.escalation.requestedCapability,
      requestedOutcome: outcome.escalation.requestedOutcome,
      reason: outcome.escalation.reason,
      evidence: { validation: outcome.evidence, refs: outcome.escalation.evidenceRefs },
      stateRevisionAtRequest: committed.revision.revision,
      returnLoopId: node.loopId, returnJobNodeId: definition.id,
      returnValidationNodeDefinitionId: node.nodeDefinitionId, nestingDepth: requestDepth
    });
    const orchestrationRequest = this.orchestration.create({
      rootRunId: node.rootRunId, kind: "repair", sourceLoopRunId: node.loopRunId,
      sourceLoopId: node.loopId, sourceNodeRunId: node.nodeRunId,
      stateRevisionAtRequest: committed.revision.revision,
      completionSummary: outcome.summary, completionEvidence: outcome as unknown as JsonValue,
      requestedCapability: outcome.escalation.requestedCapability,
      expectedOutcome: outcome.escalation.requestedOutcome,
      repairRequestId: repairRequest.repairRequestId
    });
    this.connection().prepare(`
      UPDATE control_flow_events SET repair_request_id = ?, orchestration_request_id = ? WHERE id = ?
    `).run(repairRequest.repairRequestId, orchestrationRequest.orchestrationRequestId, committed.controlFlowEventId);
    const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "validation", "completed");
    const orchestrator = callbacks.createOrchestrator(
      loop, node.loopRunId, orchestrationRequest.orchestrationRequestId, 1,
      persisted.stateRevisionAfter ?? node.stateRevisionBefore
    );
    this.repairs.bindOrchestrator(repairRequest.repairRequestId, orchestrator.nodeRunId);
    this.orchestration.bindOrchestrator(orchestrationRequest.orchestrationRequestId, orchestrator.nodeRunId);
  }

  requestFlow(
    node: NodeRun,
    revision: number,
    outcome: CanonicalNodeOutcome,
    callbacks: LoopOrchestratorCallbacks
  ): boolean {
    const snapshot = this.snapshots.require(node.rootRunId);
    if (!snapshot.graph.loopEdges.some((edge) => edge.kind === "flow" && edge.source === node.loopId)) return false;
    const request = this.orchestration.create({
      rootRunId: node.rootRunId, kind: "flow", sourceLoopRunId: node.loopRunId,
      sourceLoopId: node.loopId, sourceNodeRunId: node.nodeRunId,
      stateRevisionAtRequest: revision,
      completionSummary: summaryOf(outcome, `Loop ${node.loopId} completed.`),
      completionEvidence: outcome as unknown as JsonValue
    });
    const orchestrator = callbacks.createOrchestrator(
      this.snapshots.loop(snapshot, node.loopId), node.loopRunId,
      request.orchestrationRequestId, 1, revision
    );
    this.orchestration.bindOrchestrator(request.orchestrationRequestId, orchestrator.nodeRunId);
    return true;
  }

  apply(node: NodeRun, outcome: OrchestratorNodeOutcome, callbacks: LoopOrchestratorCallbacks): void {
    const request = this.orchestration.forOrchestrator(node.nodeRunId);
    if (!request) throw new LoopRunIntegrityError(
      `Orchestrator Node Run ${node.nodeRunId} has no persisted Orchestration Request.`
    );
    if (outcome.state !== "completed") {
      if (outcome.state === "needs_input") throw new LoopRunIntegrityError("Paused Orchestrator reached terminal flow.");
      this.failOutcome(node, request, outcome);
      return;
    }
    assertJsonValue(outcome.dispatchInput,
      { label: "Orchestrator dispatch input", maxBytes: maxOrchestratorDispatchValueBytes });
    assertJsonValue(outcome.expectedOutcome,
      { label: "Orchestrator expected outcome", maxBytes: maxOrchestratorDispatchValueBytes });
    const committed = this.states.commitNodeOutcome({
      rootRunId: node.rootRunId, nodeRunId: node.nodeRunId, baseRevision: node.stateRevisionBefore,
      outcome,
      control: {
        kind: request.kind === "repair" ? "repair_call" : "flow_transition",
        orchestrationRequestId: request.orchestrationRequestId,
        repairRequestId: request.repairRequestId
      }
    });
    const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "orchestrator", "completed");
    const persistedOutcome = requireCompletedOrchestratorOutcome(persisted.outcome);
    const issue = this.routeIssue(node, request, persistedOutcome.targetLoopId);
    if (issue) {
      this.connection().prepare(`UPDATE control_flow_events SET kind = 'orchestrator_terminal' WHERE id = ?`)
        .run(committed.controlFlowEventId);
      this.failRequest(
        request, persisted, "failed", persisted.stateRevisionAfter ?? node.stateRevisionBefore,
        persisted.outcome, "invalid_orchestrator_route", issue
      );
      return;
    }
    const route = this.orchestration.route({
      orchestrationRequestId: request.orchestrationRequestId,
      orchestratorNodeRunId: node.nodeRunId, targetLoopId: persistedOutcome.targetLoopId,
      routeReason: persistedOutcome.routeReason, expectedOutcome: persistedOutcome.expectedOutcome
    });
    const revision = persisted.stateRevisionAfter ?? node.stateRevisionBefore;
    const targetLoop = this.snapshots.loop(this.snapshots.require(node.rootRunId), route.targetLoopId);
    if (request.kind === "flow") {
      const target = callbacks.startFlow(targetLoop, request, persistedOutcome.dispatchInput, revision);
      this.orchestration.markDispatched(request.orchestrationRequestId, target.loopRunId);
      this.bindControlTarget(committed.controlFlowEventId, target, request.orchestrationRequestId);
      return;
    }
    const repairRequest = this.requireRepairRequest(request);
    this.repairs.markRouted(repairRequest.repairRequestId, route.loopEdgeId, route.targetLoopId);
    const parentFrame = this.repairs.openFrameForCallee(node.loopRunId);
    this.progress.suspendLoop(node.loopRunId);
    const target = callbacks.startRepair(
      targetLoop, node.loopRunId, repairRequest, request,
      persistedOutcome.dispatchInput, revision
    );
    const frame = this.repairs.createFrame({
      rootRunId: node.rootRunId, repairRequestId: repairRequest.repairRequestId,
      routeId: route.routeId, callerLoopRunId: node.loopRunId, calleeLoopRunId: target.loopRunId,
      parentFrameId: parentFrame?.frameId, returnLoopId: repairRequest.returnLoopId,
      returnJobNodeId: repairRequest.returnJobNodeId,
      returnValidationNodeDefinitionId: repairRequest.returnValidationNodeDefinitionId,
      stateRevisionAtCall: revision, nestingDepth: repairRequest.nestingDepth
    });
    this.loops.bindOrchestrationFrame(target.loopRunId, frame.frameId);
    this.orchestration.markDispatched(request.orchestrationRequestId, target.loopRunId);
    this.bindControlTarget(committed.controlFlowEventId, target, request.orchestrationRequestId, frame.frameId);
  }

  failRequest(
    request: OrchestrationRequest,
    node: NodeRun,
    terminal: "blocked" | "failed",
    revision: number,
    outcome: CanonicalNodeOutcome | undefined,
    errorCode: string,
    errorMessage: string
  ): void {
    this.orchestration.fail(request.orchestrationRequestId, "failed");
    if (request.kind === "repair") {
      this.completion.failPendingRequest(
        this.requireRepairRequest(request), node, terminal, revision, outcome, errorCode, errorMessage
      );
      return;
    }
    this.progress.finishRoot(request.rootRunId, outcome, { code: errorCode, message: errorMessage });
  }

  private failOutcome(
    node: NodeRun,
    request: OrchestrationRequest,
    outcome: Extract<OrchestratorNodeOutcome, { state: "blocked" | "failed" }>
  ): void {
    this.states.commitNodeOutcome({
      rootRunId: node.rootRunId, nodeRunId: node.nodeRunId, baseRevision: node.stateRevisionBefore,
      outcome, nodeStatus: outcome.state,
      errorCode: `orchestrator_${outcome.state}`, errorMessage: outcome.summary,
      control: {
        kind: "orchestrator_terminal", orchestrationRequestId: request.orchestrationRequestId,
        repairRequestId: request.repairRequestId
      }
    });
    const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "orchestrator", outcome.state);
    this.failRequest(
      request, persisted, outcome.state, persisted.stateRevisionAfter ?? node.stateRevisionBefore,
      persisted.outcome, `orchestrator_${outcome.state}`, outcome.summary
    );
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
      outcome, jobRunStatus: "blocked", jobRunTerminal: "blocked",
      errorCode: code, errorMessage: message,
      control: { kind: "validation_fail_escalated" }
    });
    const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "validation", "completed");
    this.completion.complete(
      persisted, "blocked", persisted.stateRevisionAfter ?? node.stateRevisionBefore,
      persisted.outcome, callbacks
    );
  }

  private routeIssue(node: NodeRun, request: OrchestrationRequest, targetLoopId: string): string | undefined {
    if (request.status !== "pending") return `Orchestration Request ${request.orchestrationRequestId} is not pending.`;
    if (request.rootRunId !== node.rootRunId || request.sourceLoopRunId !== node.loopRunId
      || request.sourceLoopId !== node.loopId) {
      return `Orchestration Request ${request.orchestrationRequestId} source does not match its Orchestrator Node Run.`;
    }
    const snapshot = this.snapshots.require(node.rootRunId);
    if (!snapshot.loops.some((loop) => loop.id === targetLoopId)) {
      return `Orchestrator selected unknown snapshot Loop ${targetLoopId}.`;
    }
    const edges = this.orchestration.allowedCandidates(request).filter((edge) => edge.target === targetLoopId);
    return edges.length === 1
      ? undefined
      : `Loop ${targetLoopId} is not an unambiguous allowed ${request.kind} target from ${request.sourceLoopId}.`;
  }

  private requireRepairRequest(request: OrchestrationRequest): RepairRequest {
    if (request.kind !== "repair" || !request.repairRequestId) {
      throw new LoopRunIntegrityError(`Orchestration Request ${request.orchestrationRequestId} is not a repair request.`);
    }
    return this.repairs.requireRequest(request.repairRequestId);
  }

  private bindControlTarget(
    controlFlowEventId: number,
    target: { loopRunId: string; jobRunId: string },
    orchestrationRequestId: string,
    frameId?: string
  ): void {
    this.connection().prepare(`
      UPDATE control_flow_events SET target_loop_run_id = ?, target_job_run_id = ?,
        orchestration_request_id = ?, orchestration_frame_id = ? WHERE id = ?
    `).run(target.loopRunId, target.jobRunId, orchestrationRequestId, frameId ?? null, controlFlowEventId);
  }
}

const requireCompletedOrchestratorOutcome = (
  outcome: CanonicalNodeOutcome
): Extract<OrchestratorNodeOutcome, { state: "completed" }> => {
  if (outcome.role !== "orchestrator" || outcome.state !== "completed") {
    throw new LoopRunIntegrityError("Persisted completed Orchestrator outcome is unavailable.");
  }
  return outcome;
};

const summaryOf = (outcome: CanonicalNodeOutcome | undefined, fallback: string): string =>
  outcome && "summary" in outcome && outcome.summary.trim() ? outcome.summary : fallback;
