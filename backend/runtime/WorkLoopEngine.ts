import type Database from "better-sqlite3";
import {
  isProjectHumanValidationNode,
  isProjectHumanWorkNode,
  isProjectNodeTerminalTarget,
  resolveProjectLoopStartNode,
  type JsonValue,
  type ProjectLoop,
  type ProjectWorkLoopNode
} from "../../shared/domain/automation.js";
import { parseNodeOutcomeForRole } from "../../shared/api/runtime-schemas.js";
import type {
  CanonicalNodeOutcome, LoopRunDetails, LoopRunSource, NodeRun,
  ValidationNodeOutcome, WorkNodeOutcome
} from "../../shared/domain/runtime.js";
import { maxControlFlowTransitions } from "../../shared/domain/runtime.js";
import { LoopRunIntegrityError, LoopRunStateError } from "./LoopRunErrors.js";
import { LoopRunStore } from "./LoopRunStore.js";
import { LoopStateStore } from "./LoopStateStore.js";
import { RepairStore } from "./RepairStore.js";
import { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import { WorkLoopProgressStore } from "./WorkLoopProgressStore.js";
import { WorkLoopRepairEngine } from "./WorkLoopRepairEngine.js";
import {
  readInteger, requireOutcome, requireWorkLoopNode, resumeContext
} from "./WorkLoopEngineSupport.js";

export class WorkLoopEngine {
  private readonly snapshots: RootExecutionSnapshotStore;
  private readonly progress: WorkLoopProgressStore;
  private readonly repairEngine: WorkLoopRepairEngine;

  constructor(
    private readonly connection: () => Database.Database,
    private readonly loops: LoopRunStore,
    private readonly states: LoopStateStore,
    repairs: RepairStore
  ) {
    this.snapshots = new RootExecutionSnapshotStore(connection);
    this.progress = new WorkLoopProgressStore(connection);
    this.repairEngine = new WorkLoopRepairEngine(loops, states, repairs, this.progress);
  }

  start(
    rootRunId: string,
    input?: string,
    source: LoopRunSource = "manual",
    schedule?: { workLoopNodeId: string; scheduledFor: string }
  ): LoopRunDetails {
    return this.connection().transaction(() => {
      const snapshot = this.snapshots.require(rootRunId);
      const loop = this.snapshots.loop(snapshot, snapshot.rootLoopId);
      const start = resolveProjectLoopStartNode(loop);
      if (!start) throw new LoopRunIntegrityError(`Loop ${loop.id} has no start Work Loop Node ${loop.startNodeId}.`);
      this.assertSchedule(loop, start, source, schedule);
      const loopRun = this.loops.createLoopRun({
        rootRunId, loop, source, input, schedule, entryStateRevision: 0, nestingDepth: 0
      });
      const composite = this.loops.createWorkLoopNodeRun({
        rootRunId, loopRunId: loopRun.loopRunId, loopId: loop.id,
        workLoopNodeId: start.id, attempt: 1, stateRevisionBefore: 0
      });
      this.createPhase(loop, start, composite.workLoopNodeRunId, loopRun.loopRunId, "work", 1, 0);
      return this.requireDetails(loopRun.loopRunId);
    })();
  }

  applyNodeOutcome(rootRunId: string, nodeRunId: string, input: CanonicalNodeOutcome): LoopRunDetails {
    return this.connection().transaction(() => {
      const node = this.requireActiveNode(rootRunId, nodeRunId);
      const outcome = parseNodeOutcomeForRole(node.role, input);
      if (node.role === "orchestrator") {
        throw new LoopRunStateError("Orchestrator routing is not implemented in this runtime phase.");
      }
      if (outcome.state === "needs_input") {
        this.states.pauseNodeOutcome({
          rootRunId, nodeRunId, baseRevision: node.stateRevisionBefore, outcome
        });
        return this.requireDetails(node.loopRunId);
      }
      if (this.transitionLimitReached(rootRunId)) {
        this.progress.blockAtTransitionLimit(node, this.states.current(rootRunId).revision, maxControlFlowTransitions);
        return this.requireDetails(node.loopRunId);
      }
      if (node.role === "work") this.applyWork(node, parseNodeOutcomeForRole("work", outcome));
      else this.applyValidation(node, parseNodeOutcomeForRole("validation", outcome));
      return this.requireDetails(node.loopRunId);
    })();
  }

  resumeNode(rootRunId: string, nodeRunId: string, response: string): LoopRunDetails {
    return this.connection().transaction(() => {
      const node = this.requireActiveNode(rootRunId, nodeRunId);
      if (node.status !== "waiting_for_input" || node.outcome?.state !== "needs_input") {
        throw new LoopRunStateError(`Node Run ${nodeRunId} is not waiting on a resumable needs_input outcome.`);
      }
      if (!node.workLoopNodeRunId || !node.workLoopNodeId || node.role === "orchestrator") {
        throw new LoopRunStateError(`Node Run ${nodeRunId} cannot be resumed in this runtime phase.`);
      }
      const snapshot = this.snapshots.require(rootRunId);
      const loop = this.snapshots.loop(snapshot, node.loopId);
      const definition = requireWorkLoopNode(loop, node.workLoopNodeId);
      const previous = node.outcome;
      const context = resumeContext(node, previous.question, previous.context, response);
      this.progress.resumeWaitingNode(node);
      this.createPhase(
        loop, definition, node.workLoopNodeRunId, node.loopRunId,
        node.role, node.attempt + 1, this.states.current(rootRunId).revision, context
      );
      return this.requireDetails(node.loopRunId);
    })();
  }

  markNodeRunning(nodeRunId: string): NodeRun {
    return this.loops.markNodeRunning(nodeRunId);
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
      this.createPhase(
        loop, definition, compositeId, node.loopRunId, "validation", attempt,
        persisted.stateRevisionAfter ?? node.stateRevisionBefore
      );
      return;
    }
    if (outcome.state === "needs_input") throw new LoopRunIntegrityError("A paused Work outcome reached terminal flow.");
    this.finishTerminalNode(node, outcome, outcome.state);
  }

  private applyValidation(node: NodeRun, outcome: ValidationNodeOutcome): void {
    if (outcome.state === "needs_input") throw new LoopRunIntegrityError("A paused Validation outcome reached terminal flow.");
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
    const context = {
      loop, definition, compositeId, nestingDepth: details.nestingDepth,
      createWork: (attempt: number, revision: number, phaseContext: JsonValue) => {
        this.createPhase(loop, definition, compositeId, node.loopRunId, "work", attempt, revision, phaseContext);
      }
    };
    if (outcome.repair.mode === "LOCAL_RETRY") this.repairEngine.localRetry(node, outcome, context);
    else this.repairEngine.externalRepair(node, outcome, context);
  }

  private validationOk(node: NodeRun, outcome: ValidationNodeOutcome & { state: "completed"; decision: "OK" }): void {
    const { loop, definition, compositeId } = this.definitionFor(node);
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
      this.progress.finishLoop(node, edge.target.terminal, persisted.stateRevisionAfter ?? node.stateRevisionBefore, persisted.outcome);
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
    this.createPhase(
      loop, target, targetRun.workLoopNodeRunId, node.loopRunId, "work", 1,
      persisted.stateRevisionAfter ?? node.stateRevisionBefore
    );
    void compositeId;
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
    this.progress.finishLoop(node, terminal, persisted.stateRevisionAfter ?? node.stateRevisionBefore, persisted.outcome);
  }

  private createPhase(
    loop: ProjectLoop,
    definition: ProjectWorkLoopNode,
    compositeId: string,
    loopRunId: string,
    role: "work" | "validation",
    attempt: number,
    revision: number,
    context?: JsonValue
  ): NodeRun {
    const human = role === "work"
      ? isProjectHumanWorkNode(definition.work)
      : isProjectHumanValidationNode(definition.validation);
    const node = this.loops.createNodeRun({
      rootRunId: this.requireDetails(loopRunId).rootRunId, loopRunId,
      workLoopNodeRunId: compositeId, role, loopId: loop.id, workLoopNodeId: definition.id,
      nodeDefinitionId: `${loop.id}:${definition.id}:${role}`, attempt,
      stateRevisionBefore: revision, status: human ? "waiting_for_input" : "queued", context
    });
    if (human) this.progress.waitForHuman(node);
    return node;
  }

  private definitionFor(node: NodeRun) {
    if (!node.workLoopNodeRunId || !node.workLoopNodeId) throw new LoopRunIntegrityError(
      `Node Run ${node.nodeRunId} is missing its Work Loop Node Run identity.`
    );
    const snapshot = this.snapshots.require(node.rootRunId);
    const loop = this.snapshots.loop(snapshot, node.loopId);
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

  private assertSchedule(
    loop: ProjectLoop,
    start: ProjectWorkLoopNode,
    source: LoopRunSource,
    schedule?: { workLoopNodeId: string }
  ): void {
    if (source !== "schedule") return;
    if (!schedule || start.work.type !== "scheduled" || schedule.workLoopNodeId !== start.id) {
      throw new LoopRunStateError(`Scheduled Work Node is not the immutable start of Loop ${loop.id}.`);
    }
  }

  private requireDetails(loopRunId: string): LoopRunDetails {
    const details = this.loops.details(loopRunId);
    if (!details) throw new LoopRunIntegrityError(`Loop Run ${loopRunId} was not found.`);
    return details;
  }
}
