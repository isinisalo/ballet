import type Database from "better-sqlite3";
import { isProjectNodeTerminalTarget } from "../../shared/domain/automation.js";
import { parseNodeOutcomeForRole } from "../../shared/api/runtime-schemas.js";
import type {
  CanonicalNodeOutcome, LoopRunDetails, LoopRunSource, NodeRun,
  ValidationNodeOutcome, WorkNodeOutcome
} from "../../shared/domain/runtime.js";
import { maxControlFlowTransitions } from "../../shared/domain/runtime.js";
import { LocalRetryEngine } from "./LocalRetryEngine.js";
import { LoopCompletionEngine } from "./LoopCompletionEngine.js";
import { LoopOrchestrator, type LoopOrchestratorCallbacks } from "./LoopOrchestrator.js";
import { LoopRunIntegrityError, LoopRunStateError } from "./LoopRunErrors.js";
import { LoopRunStore } from "./LoopRunStore.js";
import { LoopStateStore } from "./LoopStateStore.js";
import { RepairResultStore } from "./RepairResultStore.js";
import { RepairStore } from "./RepairStore.js";
import { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import { WorkLoopPhaseFactory } from "./WorkLoopPhaseFactory.js";
import { WorkLoopProgressStore } from "./WorkLoopProgressStore.js";
import { readInteger, requireOutcome, requireWorkLoopNode, resumeContext } from "./WorkLoopEngineSupport.js";

export class WorkLoopEngine {
  private readonly snapshots: RootExecutionSnapshotStore;
  private readonly progress: WorkLoopProgressStore;
  private readonly phases: WorkLoopPhaseFactory;
  private readonly completion: LoopCompletionEngine;
  private readonly localRetry: LocalRetryEngine;
  private readonly orchestrator: LoopOrchestrator;

  constructor(
    private readonly connection: () => Database.Database,
    private readonly loops: LoopRunStore,
    private readonly states: LoopStateStore,
    private readonly repairs: RepairStore
  ) {
    this.snapshots = new RootExecutionSnapshotStore(connection);
    this.progress = new WorkLoopProgressStore(connection);
    this.phases = new WorkLoopPhaseFactory(loops, this.snapshots, this.progress);
    this.completion = new LoopCompletionEngine(
      connection, loops, repairs, new RepairResultStore(connection), this.snapshots, this.progress
    );
    this.localRetry = new LocalRetryEngine(loops, states, repairs, this.progress);
    this.orchestrator = new LoopOrchestrator(
      connection, loops, states, repairs, this.snapshots, this.progress, this.completion
    );
  }

  start(
    rootRunId: string,
    input?: string,
    source: LoopRunSource = "manual",
    schedule?: { workLoopNodeId: string; scheduledFor: string }
  ): LoopRunDetails {
    return this.connection().transaction(() => {
      const started = this.phases.startRoot(rootRunId, input, source, schedule);
      return this.requireDetails(started.loopRunId);
    })();
  }

  applyNodeOutcome(rootRunId: string, nodeRunId: string, input: CanonicalNodeOutcome): LoopRunDetails {
    return this.connection().transaction(() => {
      const node = this.requireActiveNode(rootRunId, nodeRunId);
      const outcome = parseNodeOutcomeForRole(node.role, input);
      if (outcome.state === "needs_input") {
        this.states.pauseNodeOutcome({ rootRunId, nodeRunId, baseRevision: node.stateRevisionBefore, outcome });
        return this.requireDetails(node.loopRunId);
      }
      if (this.transitionLimitReached(rootRunId)) {
        this.progress.blockAtTransitionLimit(node, this.states.current(rootRunId).revision, maxControlFlowTransitions);
        this.reconcileTerminalNode(node.nodeRunId);
        return this.requireDetails(node.loopRunId);
      }
      if (node.role === "work") this.applyWork(node, parseNodeOutcomeForRole("work", outcome));
      else if (node.role === "validation") this.applyValidation(node, parseNodeOutcomeForRole("validation", outcome));
      else this.orchestrator.apply(node, parseNodeOutcomeForRole("orchestrator", outcome), this.callbacks(rootRunId));
      return this.requireDetails(node.loopRunId);
    })();
  }

  resumeNode(rootRunId: string, nodeRunId: string, response: string): LoopRunDetails {
    return this.connection().transaction(() => {
      const node = this.requireActiveNode(rootRunId, nodeRunId);
      if (node.status !== "waiting_for_input" || node.outcome?.state !== "needs_input") {
        throw new LoopRunStateError(`Node Run ${nodeRunId} is not waiting on a resumable needs_input outcome.`);
      }
      const context = resumeContext(node, node.outcome.question, node.outcome.context, response);
      if (node.role === "orchestrator") {
        const request = this.repairs.requestForOrchestrator(node.nodeRunId);
        if (!request) throw new LoopRunIntegrityError(`Orchestrator Node Run ${node.nodeRunId} has no Repair Request.`);
        this.loops.resumeOrchestratorNode(
          node.nodeRunId, node.attempt + 1, this.states.current(rootRunId).revision,
          { repairRequestId: request.repairRequestId, ...context }
        );
        return this.requireDetails(node.loopRunId);
      }
      this.progress.resumeWaitingNode(node);
      if (!node.workLoopNodeRunId || !node.workLoopNodeId) {
        throw new LoopRunStateError(`Node Run ${nodeRunId} has no resumable Work Loop Node identity.`);
      }
      const loop = this.snapshots.loop(this.snapshots.require(rootRunId), node.loopId);
      const definition = requireWorkLoopNode(loop, node.workLoopNodeId);
      this.phases.createPhase(
        loop, definition, node.workLoopNodeRunId, node.loopRunId,
        node.role, node.attempt + 1, this.states.current(rootRunId).revision, context
      );
      return this.requireDetails(node.loopRunId);
    })();
  }

  markNodeRunning(nodeRunId: string): NodeRun {
    return this.loops.markNodeRunning(nodeRunId);
  }

  reconcileTerminalNode(nodeRunId: string): void {
    this.connection().transaction(() => {
      const node = this.loops.getNodeRun(nodeRunId);
      if (!node || !["blocked", "interrupted", "failed", "cancelled"].includes(node.status)) return;
      const revision = this.states.current(node.rootRunId).revision;
      const request = node.role === "orchestrator"
        ? this.repairs.requestForOrchestrator(node.nodeRunId)
        : undefined;
      if (request && ["pending", "routed"].includes(request.status)) {
        this.completion.failPendingRequest(
          request, node, node.status === "blocked" ? "blocked" : "failed", revision, node.outcome,
          node.errorCode ?? "orchestrator_interrupted",
          node.errorMessage ?? `Orchestrator Node Run ${node.nodeRunId} was interrupted.`
        );
        return;
      }
      const frame = this.repairs.openFrameForCallee(node.loopRunId);
      if (frame) this.completion.failOpenFrame(
        frame, node.status === "cancelled" ? "cancelled" : node.status === "blocked" ? "blocked" : "failed",
        revision, node.outcome, node.nodeRunId
      );
    })();
  }

  private applyWork(node: NodeRun, outcome: WorkNodeOutcome): void {
    if (outcome.state === "completed") {
      this.states.commitNodeOutcome({
        rootRunId: node.rootRunId, nodeRunId: node.nodeRunId, baseRevision: node.stateRevisionBefore,
        outcome, control: { kind: "work_completed", targetWorkLoopNodeRunId: node.workLoopNodeRunId }
      });
      const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "work", "completed");
      const { loop, definition, compositeId } = this.definitionFor(node);
      const attempt = this.loops.getWorkLoopNodeRun(compositeId)?.attempt;
      if (!attempt) throw new LoopRunIntegrityError(`Work Loop Node Run ${compositeId} was not found.`);
      this.phases.createPhase(
        loop, definition, compositeId, node.loopRunId, "validation", attempt,
        persisted.stateRevisionAfter ?? node.stateRevisionBefore
      );
      return;
    }
    if (outcome.state === "needs_input") throw new LoopRunIntegrityError("Paused Work outcome reached terminal flow.");
    this.finishTerminalNode(node, outcome, outcome.state);
  }

  private applyValidation(node: NodeRun, outcome: ValidationNodeOutcome): void {
    if (outcome.state === "needs_input") throw new LoopRunIntegrityError("Paused Validation outcome reached terminal flow.");
    if (outcome.state !== "completed") {
      this.finishTerminalNode(node, outcome, outcome.state);
      return;
    }
    if (outcome.decision === "OK") {
      this.validationOk(node, outcome);
      return;
    }
    const { loop, definition, compositeId } = this.definitionFor(node);
    const details = this.requireDetails(node.loopRunId);
    if (outcome.repair.mode === "LOCAL_RETRY") {
      this.localRetry.apply(node, outcome, {
        loop, definition, compositeId, nestingDepth: details.nestingDepth,
        createWork: (attempt, revision, context) => {
          this.phases.createPhase(loop, definition, compositeId, node.loopRunId, "work", attempt, revision, context);
        },
        completeBlocked: (source, revision, persisted) => {
          this.completion.complete(source, "blocked", revision, persisted, this.callbacks(node.rootRunId));
        }
      });
    } else {
      if (outcome.repair.mode !== "ORCHESTRATOR_REPAIR") {
        throw new LoopRunIntegrityError("Validation repair mode changed during control-flow dispatch.");
      }
      this.orchestrator.request(
        node, outcome, loop, definition, compositeId, details.nestingDepth, this.callbacks(node.rootRunId)
      );
    }
  }

  private validationOk(
    node: NodeRun,
    outcome: ValidationNodeOutcome & { state: "completed"; decision: "OK" }
  ): void {
    const { loop, definition } = this.definitionFor(node);
    const edges = loop.edges.filter((edge) => edge.source === definition.id);
    if (edges.length !== 1) throw new LoopRunIntegrityError(
      `Validation OK for ${loop.id}:${definition.id} has ${edges.length} persisted Node Edges; expected one.`
    );
    const edge = edges[0]!;
    if (isProjectNodeTerminalTarget(edge.target)) {
      this.states.commitNodeOutcome({
        rootRunId: node.rootRunId, nodeRunId: node.nodeRunId, baseRevision: node.stateRevisionBefore,
        outcome, workLoopNodeStatus: "completed", workLoopNodeTerminal: "completed",
        control: { kind: "validation_ok" }
      });
      const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "validation", "completed");
      this.completion.complete(
        node, edge.target.terminal, persisted.stateRevisionAfter ?? node.stateRevisionBefore,
        persisted.outcome, this.callbacks(node.rootRunId)
      );
      return;
    }
    const committed = this.states.commitNodeOutcome({
      rootRunId: node.rootRunId, nodeRunId: node.nodeRunId, baseRevision: node.stateRevisionBefore,
      outcome, workLoopNodeStatus: "completed", workLoopNodeTerminal: "completed",
      control: { kind: "validation_ok" }
    });
    const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "validation", "completed");
    const target = requireWorkLoopNode(loop, edge.target.nodeId);
    const targetRun = this.loops.createWorkLoopNodeRun({
      rootRunId: node.rootRunId, loopRunId: node.loopRunId, loopId: node.loopId,
      workLoopNodeId: target.id, attempt: 1,
      stateRevisionBefore: persisted.stateRevisionAfter ?? node.stateRevisionBefore
    });
    this.connection().prepare(`
      UPDATE control_flow_events SET target_work_loop_node_run_id = ? WHERE id = ?
    `).run(targetRun.workLoopNodeRunId, committed.controlFlowEventId);
    this.phases.createPhase(
      loop, target, targetRun.workLoopNodeRunId, node.loopRunId, "work", 1,
      persisted.stateRevisionAfter ?? node.stateRevisionBefore
    );
  }

  private finishTerminalNode(
    node: NodeRun,
    outcome: WorkNodeOutcome | ValidationNodeOutcome,
    terminal: "blocked" | "failed"
  ): void {
    this.states.commitNodeOutcome({
      rootRunId: node.rootRunId, nodeRunId: node.nodeRunId, baseRevision: node.stateRevisionBefore,
      outcome, nodeStatus: terminal, workLoopNodeStatus: terminal, workLoopNodeTerminal: terminal,
      control: { kind: outcome.role === "work" ? "work_terminal" : "validation_terminal" }
    });
    const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), outcome.role, terminal);
    this.completion.complete(
      node, terminal, persisted.stateRevisionAfter ?? node.stateRevisionBefore,
      persisted.outcome, this.callbacks(node.rootRunId)
    );
  }

  private callbacks(rootRunId: string): LoopOrchestratorCallbacks {
    return {
      createOrchestrator: (loop, loopRunId, requestId, attempt, revision, context) =>
        this.phases.createOrchestrator(loop, rootRunId, loopRunId, requestId, attempt, revision, context),
      startRepair: (loop, callerLoopRunId, request, input, revision) =>
        this.phases.startRepair(loop, callerLoopRunId, request, input, revision),
      startFlow: (loop, _sourceLoopRunId, revision) => this.phases.startFlow(loop, rootRunId, revision),
      returnValidation: (frame, context, revision) => {
        const node = this.phases.returnValidation(frame, context, revision);
        return { nodeRunId: node.nodeRunId, workLoopNodeRunId: node.workLoopNodeRunId! };
      }
    };
  }

  private definitionFor(node: NodeRun) {
    if (!node.workLoopNodeRunId || !node.workLoopNodeId) throw new LoopRunIntegrityError(
      `Node Run ${node.nodeRunId} is missing its Work Loop Node Run identity.`
    );
    const loop = this.snapshots.loop(this.snapshots.require(node.rootRunId), node.loopId);
    return { loop, definition: requireWorkLoopNode(loop, node.workLoopNodeId), compositeId: node.workLoopNodeRunId };
  }

  private requireActiveNode(rootRunId: string, nodeRunId: string): NodeRun {
    const node = this.loops.getNodeRun(nodeRunId);
    if (!node || node.rootRunId !== rootRunId) throw new LoopRunStateError(
      `Node Run ${nodeRunId} does not belong to Root Run ${rootRunId}.`
    );
    if (!["queued", "running", "waiting_for_input"].includes(node.status)) {
      throw new LoopRunStateError(`Node Run ${nodeRunId} is not active.`);
    }
    return node;
  }

  private transitionLimitReached(rootRunId: string): boolean {
    const row = this.connection().prepare("SELECT transition_count FROM root_runs WHERE root_run_id = ?").get(rootRunId);
    return readInteger(row, "transition_count") >= maxControlFlowTransitions;
  }

  private requireDetails(loopRunId: string): LoopRunDetails {
    const details = this.loops.details(loopRunId);
    if (!details) throw new LoopRunIntegrityError(`Loop Run ${loopRunId} was not found.`);
    return details;
  }
}
