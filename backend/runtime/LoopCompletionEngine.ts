import type {
  CanonicalNodeOutcome, NodeRun, OrchestrationFrame, RepairRequest, RepairResultStatus
} from "../../shared/domain/runtime.js";
import type { TaskEnvelopeRepairReturn } from "../../shared/domain/taskEnvelope.js";
import { ControlFlowTransitionStore } from "./ControlFlowTransitionStore.js";
import type { LoopRunStore } from "./LoopRunStore.js";
import type { RepairResultStore } from "./RepairResultStore.js";
import type { RepairStore } from "./RepairStore.js";
import type { WorkLoopProgressStore } from "./WorkLoopProgressStore.js";

type LoopTerminalStatus = "completed" | "blocked" | "failed";

export interface LoopCompletionCallbacks {
  requestFlow(node: NodeRun, revision: number, outcome: CanonicalNodeOutcome): boolean;
  returnValidation(frame: OrchestrationFrame, context: TaskEnvelopeRepairReturn, revision: number): {
    nodeRunId: string;
    workLoopNodeRunId: string;
  };
}

export class LoopCompletionEngine {
  private readonly transitions: ControlFlowTransitionStore;

  constructor(
    connection: ConstructorParameters<typeof ControlFlowTransitionStore>[0],
    private readonly loops: LoopRunStore,
    private readonly repairs: RepairStore,
    private readonly results: RepairResultStore,
    private readonly progress: WorkLoopProgressStore
  ) {
    this.transitions = new ControlFlowTransitionStore(connection);
  }

  complete(
    node: NodeRun,
    terminal: LoopTerminalStatus,
    revision: number,
    outcome: CanonicalNodeOutcome,
    callbacks: LoopCompletionCallbacks
  ): void {
    this.progress.finishLoop(node, terminal, revision);
    const frame = this.repairs.openFrameForCallee(node.loopRunId);
    const failure = terminal === "completed" ? undefined : {
      code: node.errorCode ?? `loop_${terminal}`,
      message: node.errorMessage ?? `Loop ${node.loopId} ended as ${terminal}.`
    };
    if (frame) {
      if (terminal === "completed") this.returnRepair(frame, node, revision, outcome, callbacks);
      else this.failRepair(frame, terminal, revision, outcome, node.nodeRunId, failure);
      return;
    }
    if (terminal === "completed" && callbacks.requestFlow(node, revision, outcome)) return;
    this.progress.finishRoot(node.rootRunId, outcome, failure);
  }

  failPendingRequest(
    request: RepairRequest,
    node: NodeRun,
    terminal: "blocked" | "failed",
    revision: number,
    outcome: CanonicalNodeOutcome | undefined,
    errorCode: string,
    errorMessage: string
  ): void {
    this.repairs.finishRequest(request.repairRequestId, "failed");
    this.progress.terminalizeCaller(
      request.requesterLoopRunId, request.requesterWorkLoopNodeRunId, request.rootRunId,
      terminal, revision, errorCode, errorMessage
    );
    const parent = this.repairs.openFrameForCallee(request.requesterLoopRunId);
    if (parent) this.failRepair(parent, terminal, revision, outcome, node.nodeRunId);
    else this.progress.finishRoot(request.rootRunId, outcome, { code: errorCode, message: errorMessage });
  }

  failOpenFrame(
    frame: OrchestrationFrame,
    terminal: "blocked" | "failed" | "cancelled",
    revision: number,
    outcome?: CanonicalNodeOutcome,
    sourceNodeRunId?: string,
    failure?: { code: string; message: string }
  ): void {
    this.failRepair(frame, terminal, revision, outcome, sourceNodeRunId, failure);
  }

  private returnRepair(
    frame: OrchestrationFrame,
    node: NodeRun,
    revision: number,
    outcome: CanonicalNodeOutcome,
    callbacks: LoopCompletionCallbacks
  ): void {
    const request = this.repairs.requireRequest(frame.repairRequestId);
    const result = this.results.create({
      rootRunId: frame.rootRunId, repairRequestId: request.repairRequestId,
      orchestrationFrameId: frame.frameId, targetLoopRunId: frame.calleeLoopRunId,
      targetLoopId: node.loopId, status: "repaired", stateRevision: revision,
      outcome, summary: summaryOf(outcome, `Repair Loop ${node.loopId} completed.`)
    });
    this.repairs.finishRequest(request.repairRequestId, "repaired");
    this.repairs.closeFrame(frame.frameId, "returned");
    this.progress.activateCaller(
      frame.callerLoopRunId, request.requesterWorkLoopNodeRunId, frame.rootRunId
    );
    const target = callbacks.returnValidation(frame, {
      repairRequest: requestProjection(request),
      repairResult: {
        id: result.repairResultId, frameId: frame.frameId,
        targetLoopRunId: result.targetLoopRunId, targetLoopId: result.targetLoopId,
        stateRevision: result.stateRevision, outcome: result.outcome, summary: result.summary
      }
    }, revision);
    this.transitions.append({
      rootRunId: frame.rootRunId, kind: "repair_return", stateRevision: revision,
      sourceLoopRunId: frame.calleeLoopRunId, sourceNodeRunId: node.nodeRunId,
      targetLoopRunId: frame.callerLoopRunId,
      targetWorkLoopNodeRunId: target.workLoopNodeRunId,
      repairRequestId: request.repairRequestId, orchestrationFrameId: frame.frameId
    });
  }

  private failRepair(
    frame: OrchestrationFrame,
    terminal: "blocked" | "failed" | "cancelled",
    revision: number,
    outcome?: CanonicalNodeOutcome,
    sourceNodeRunId?: string,
    failure?: { code: string; message: string }
  ): void {
    const request = this.repairs.requireRequest(frame.repairRequestId);
    const target = this.loops.details(frame.calleeLoopRunId);
    if (!target) throw new Error(`Repair target Loop Run ${frame.calleeLoopRunId} was not found.`);
    const resultStatus: RepairResultStatus = terminal;
    const message = failure?.message ?? `Repair Loop ${target.loopId} ended as ${terminal}.`;
    this.results.create({
      rootRunId: frame.rootRunId, repairRequestId: request.repairRequestId,
      orchestrationFrameId: frame.frameId, targetLoopRunId: frame.calleeLoopRunId,
      targetLoopId: target.loopId, status: resultStatus, stateRevision: revision,
      outcome, summary: summaryOf(outcome, message)
    });
    this.repairs.finishRequest(request.repairRequestId, terminal === "cancelled" ? "cancelled" : "failed");
    this.repairs.closeFrame(frame.frameId, terminal === "cancelled" ? "cancelled" : "failed");
    this.progress.terminalizeCaller(
      frame.callerLoopRunId, request.requesterWorkLoopNodeRunId, frame.rootRunId,
      terminal, revision, "repair_target_terminal", message
    );
    this.transitions.append({
      rootRunId: frame.rootRunId, kind: "repair_terminal", stateRevision: revision,
      sourceLoopRunId: frame.calleeLoopRunId, sourceNodeRunId,
      targetLoopRunId: frame.callerLoopRunId, targetWorkLoopNodeRunId: request.requesterWorkLoopNodeRunId,
      repairRequestId: request.repairRequestId, orchestrationFrameId: frame.frameId
    });
    const parent = this.repairs.openFrameForCallee(frame.callerLoopRunId);
    if (parent) this.failRepair(parent, terminal, revision, outcome, undefined, failure);
    else this.progress.finishRoot(frame.rootRunId, outcome, {
      code: failure?.code ?? "repair_target_terminal", message
    });
  }

}

const requestProjection = (request: RepairRequest) => ({
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

const summaryOf = (outcome: CanonicalNodeOutcome | undefined, fallback: string): string =>
  outcome && "summary" in outcome && outcome.summary.trim() ? outcome.summary : fallback;
