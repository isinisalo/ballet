/* eslint-disable max-lines -- The transactional Workflow aggregate keeps outcome, State, retry, repair and RunBook ordering auditable in one unit. */
import type Database from "better-sqlite3";
import { parseNodeOutcomeForRole } from "../../shared/api/runtime-schemas.js";
import type {
  CanonicalNodeOutcome, JobNodeOutcome, LoopRunDetails, LoopRunSource, NodeRun,
  ValidationCompletedOutcome, ValidationNodeOutcome
} from "../../shared/domain/runtime.js";
import { GraphRunbookEngine } from "./GraphRunbookEngine.js";
import { LoopCompletionEngine } from "./LoopCompletionEngine.js";
import { LoopOrchestrator, type LoopOrchestratorCallbacks } from "./LoopOrchestrator.js";
import { LoopRunIntegrityError, LoopRunStateError } from "./LoopRunErrors.js";
import { LoopRunStore } from "./LoopRunStore.js";
import { LoopStateStore } from "./LoopStateStore.js";
import { OrchestrationStore } from "./OrchestrationStore.js";
import { RepairResultStore } from "./RepairResultStore.js";
import { RepairStore } from "./RepairStore.js";
import { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import { WorkflowPhaseFactory } from "./WorkflowPhaseFactory.js";
import { WorkflowProgressStore } from "./WorkflowProgressStore.js";
import { WorkflowRetryEngine } from "./WorkflowRetryEngine.js";
import {
  definitionForNode, requireActiveNode, requireJobNode, requireOutcome,
  requireValidationNode, resumeContext
} from "./WorkflowEngineSupport.js";

type ValidationPassOutcome = Extract<ValidationCompletedOutcome, { decision: "PASS" }>;
type ValidationFailOutcome = Extract<ValidationCompletedOutcome, { decision: "FAIL" }>;

export class WorkflowEngine {
  private readonly snapshots: RootExecutionSnapshotStore;
  private readonly progress: WorkflowProgressStore;
  private readonly phases: WorkflowPhaseFactory;
  private readonly completion: LoopCompletionEngine;
  private readonly retry: WorkflowRetryEngine;
  private readonly runbook: GraphRunbookEngine;
  private readonly orchestrator: LoopOrchestrator;
  private readonly orchestration: OrchestrationStore;

  constructor(
    private readonly connection: () => Database.Database,
    private readonly loops: LoopRunStore,
    private readonly states: LoopStateStore,
    private readonly repairs: RepairStore
  ) {
    this.snapshots = new RootExecutionSnapshotStore(connection);
    this.progress = new WorkflowProgressStore(connection);
    this.orchestration = new OrchestrationStore(connection);
    this.phases = new WorkflowPhaseFactory(connection, loops, this.snapshots, this.progress);
    this.completion = new LoopCompletionEngine(
      connection, loops, repairs, new RepairResultStore(connection), this.progress
    );
    this.retry = new WorkflowRetryEngine(loops, states, this.progress);
    this.runbook = new GraphRunbookEngine(connection, this.snapshots, this.progress);
    this.orchestrator = new LoopOrchestrator(
      connection, loops, states, repairs, this.orchestration, this.snapshots, this.progress, this.completion
    );
  }

  start(
    rootRunId: string,
    input?: string,
    source: LoopRunSource = "manual",
    schedule?: { jobNodeId: string; scheduledFor: string }
  ): LoopRunDetails {
    return this.connection().transaction(() => {
      const started = this.phases.startRoot(rootRunId, input, source, schedule);
      return this.requireDetails(started.loopRunId);
    })();
  }

  applyNodeOutcome(rootRunId: string, nodeRunId: string, input: CanonicalNodeOutcome): LoopRunDetails {
    return this.connection().transaction(() => {
      const node = requireActiveNode(this.loops, rootRunId, nodeRunId);
      const outcome = parseNodeOutcomeForRole(node.role, input);
      if (outcome.state === "needs_input") {
        if (node.role === "orchestrator") {
          const request = this.orchestration.forOrchestrator(node.nodeRunId);
          if (!request) throw new LoopRunIntegrityError(
            `Orchestrator Node Run ${node.nodeRunId} has no Orchestration Request.`
          );
          this.orchestration.markWaiting(request.orchestrationRequestId);
        }
        this.states.pauseNodeOutcome({ rootRunId, nodeRunId, baseRevision: node.stateRevisionBefore, outcome });
        return this.requireDetails(node.loopRunId);
      }
      if (node.role === "job") this.applyJob(node, parseNodeOutcomeForRole("job", outcome));
      else if (node.role === "validation") {
        this.applyValidation(node, parseNodeOutcomeForRole("validation", outcome));
      } else {
        this.orchestrator.apply(node, parseNodeOutcomeForRole("orchestrator", outcome), this.callbacks(rootRunId));
      }
      return this.requireDetails(node.loopRunId);
    })();
  }

  resumeNode(rootRunId: string, nodeRunId: string, response: string): LoopRunDetails {
    return this.connection().transaction(() => {
      const node = requireActiveNode(this.loops, rootRunId, nodeRunId);
      if (node.status !== "waiting_for_input" || node.outcome?.state !== "needs_input") {
        throw new LoopRunStateError(`Node Run ${nodeRunId} is not waiting on a resumable needs_input outcome.`);
      }
      const context = resumeContext(node, node.outcome.question, node.outcome.context, response);
      if (node.role === "orchestrator") {
        const request = this.orchestration.forOrchestrator(node.nodeRunId);
        if (!request) throw new LoopRunIntegrityError(
          `Orchestrator Node Run ${node.nodeRunId} has no Orchestration Request.`
        );
        this.orchestration.markPending(request.orchestrationRequestId);
        this.loops.resumeOrchestratorNode(
          node.nodeRunId, node.attempt + 1, this.states.current(rootRunId).revision,
          { orchestrationRequestId: request.orchestrationRequestId, ...context }
        );
        return this.requireDetails(node.loopRunId);
      }
      this.progress.resumeWaitingNode(node);
      if (!node.jobRunId || !node.jobNodeId) {
        throw new LoopRunStateError(`Node Run ${nodeRunId} has no resumable Job Run identity.`);
      }
      const loop = this.snapshots.loop(this.snapshots.require(rootRunId), node.loopId);
      const job = requireJobNode(loop, node.jobNodeId);
      this.phases.createPhase(
        loop, job, node.jobRunId, node.loopRunId,
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
        ? this.orchestration.forOrchestrator(node.nodeRunId)
        : undefined;
      if (request && ["pending", "waiting_for_input", "routed"].includes(request.status)) {
        this.orchestrator.failRequest(
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

  private applyJob(node: NodeRun, outcome: JobNodeOutcome): void {
    if (outcome.state === "completed") {
      this.states.commitNodeOutcome({
        rootRunId: node.rootRunId,
        nodeRunId: node.nodeRunId,
        baseRevision: node.stateRevisionBefore,
        outcome,
        control: { kind: "job_completed", targetJobRunId: node.jobRunId }
      });
      const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "job", "completed");
      const { loop, job, jobRunId } = definitionForNode(this.snapshots, node);
      const jobAttempt = this.loops.getJobRun(jobRunId)?.jobAttempt;
      if (!jobAttempt) throw new LoopRunIntegrityError(`Job Run ${jobRunId} was not found.`);
      this.phases.createPhase(
        loop, job, jobRunId, node.loopRunId, "validation", jobAttempt,
        persisted.stateRevisionAfter ?? node.stateRevisionBefore
      );
      return;
    }
    if (outcome.state === "needs_input") throw new LoopRunIntegrityError("Paused Job outcome reached terminal flow.");
    this.finishTechnicalFailure(node, outcome, outcome.state);
  }

  private applyValidation(node: NodeRun, outcome: ValidationNodeOutcome): void {
    if (outcome.state === "needs_input") {
      throw new LoopRunIntegrityError("Paused Validation outcome reached terminal flow.");
    }
    if (outcome.state !== "completed") {
      this.finishTechnicalFailure(node, outcome, outcome.state);
      return;
    }
    if (outcome.decision === "PASS") {
      this.applyPass(node, outcome);
      return;
    }
    this.applyFail(node, outcome);
  }

  private applyFail(node: NodeRun, outcome: ValidationFailOutcome): void {
    const { loop, job, jobRunId } = definitionForNode(this.snapshots, node);
    const validation = requireValidationNode(loop, job.validationNodeId);
    const failEdges = loop.workflow.failEdges.filter((edge) => edge.sourceValidationNodeId === validation.id);
    if (failEdges.length !== 1 || failEdges[0]?.target.workflowResult !== "FAIL") {
      throw new LoopRunIntegrityError(
        `Validation Node ${loop.id}:${validation.id} must have exactly one FailEdge to Workflow FAIL.`
      );
    }
    const jobRun = this.loops.getJobRun(jobRunId);
    if (!jobRun) throw new LoopRunIntegrityError(`Job Run ${jobRunId} was not found.`);
    if (jobRun.jobAttempt <= job.maxRetries) {
      this.retry.apply(node, outcome, {
        loop, job, jobRunId,
        createJob: (attempt, revision, context) => {
          this.phases.createPhase(loop, job, jobRunId, node.loopRunId, "job", attempt, revision, context);
        }
      });
      return;
    }
    const passEdge = loop.workflow.passEdges.find((edge) => edge.sourceValidationNodeId === validation.id);
    const terminalValidation = Boolean(passEdge && "workflowResult" in passEdge.target);
    if (!terminalValidation && outcome.transitionOutcome) {
      throw new LoopRunIntegrityError(
        `Intermediate Validation ${node.nodeDefinitionId} cannot select a graph transition outcome.`
      );
    }
    if (outcome.transitionOutcome && outcome.escalation) {
      throw new LoopRunIntegrityError(
        `Terminal Validation ${node.nodeDefinitionId} cannot select both a graph transition and a repair request.`
      );
    }
    const snapshot = this.snapshots.require(node.rootRunId);
    if (!terminalValidation && !outcome.escalation) {
      this.states.commitNodeOutcome({
        rootRunId: node.rootRunId,
        nodeRunId: node.nodeRunId,
        baseRevision: node.stateRevisionBefore,
        outcome,
        nodeStatus: "failed",
        jobRunStatus: "failed",
        jobRunTerminal: "failed",
        errorCode: "intermediate_validation_failed",
        errorMessage: outcome.feedback,
        control: { kind: "validation_terminal" }
      });
      const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "validation", "failed");
      this.completion.complete(
        persisted, "failed", persisted.stateRevisionAfter ?? node.stateRevisionBefore,
        persisted.outcome, this.callbacks(node.rootRunId)
      );
      return;
    }
    if (snapshot.rootKind === "graph" && !outcome.transitionOutcome && !outcome.escalation) {
      throw new LoopRunIntegrityError(
        `Terminal Validation ${node.nodeDefinitionId} must select a FAIL transition outcome or request repair.`
      );
    }
    if (!outcome.escalation) {
      this.states.commitNodeOutcome({
        rootRunId: node.rootRunId,
        nodeRunId: node.nodeRunId,
        baseRevision: node.stateRevisionBefore,
        outcome,
        jobRunStatus: "completed",
        jobRunTerminal: "completed",
        control: { kind: "validation_terminal" }
      });
      const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "validation", "completed");
      this.completion.complete(
        persisted,
        "completed",
        persisted.stateRevisionAfter ?? node.stateRevisionBefore,
        persisted.outcome,
        this.callbacks(node.rootRunId)
      );
      return;
    }
    const details = this.requireDetails(node.loopRunId);
    this.orchestrator.requestRepair(
      node, outcome, loop, job, jobRunId, details.nestingDepth, this.callbacks(node.rootRunId)
    );
  }

  private applyPass(node: NodeRun, outcome: ValidationPassOutcome): void {
    const { loop, job } = definitionForNode(this.snapshots, node);
    const validation = requireValidationNode(loop, job.validationNodeId);
    const edges = loop.workflow.passEdges.filter((edge) => edge.sourceValidationNodeId === validation.id);
    if (edges.length !== 1) throw new LoopRunIntegrityError(
      `Validation Node ${loop.id}:${validation.id} has ${edges.length} PassEdges; expected one.`
    );
    const edge = edges[0]!;
    if (!("workflowResult" in edge.target) && outcome.transitionOutcome) {
      throw new LoopRunIntegrityError(
        `Intermediate Validation ${node.nodeDefinitionId} cannot select a graph transition outcome.`
      );
    }
    const snapshot = this.snapshots.require(node.rootRunId);
    if ("workflowResult" in edge.target && snapshot.rootKind === "graph" && !outcome.transitionOutcome) {
      throw new LoopRunIntegrityError(
        `Terminal Validation ${node.nodeDefinitionId} must select a PASS transition outcome.`
      );
    }
    const committed = this.states.commitNodeOutcome({
      rootRunId: node.rootRunId,
      nodeRunId: node.nodeRunId,
      baseRevision: node.stateRevisionBefore,
      outcome,
      jobRunStatus: "completed",
      jobRunTerminal: "completed",
      control: { kind: "validation_pass" }
    });
    const persisted = requireOutcome(this.loops.getNodeRun(node.nodeRunId), "validation", "completed");
    const revision = persisted.stateRevisionAfter ?? node.stateRevisionBefore;
    if ("workflowResult" in edge.target) {
      if (edge.target.workflowResult !== "PASS") {
        throw new LoopRunIntegrityError(`PassEdge ${edge.id} has invalid Workflow result.`);
      }
      this.completion.complete(node, "completed", revision, persisted.outcome, this.callbacks(node.rootRunId));
      return;
    }
    const targetJob = requireJobNode(loop, edge.target.jobNodeId);
    const targetRun = this.loops.createJobRun({
      rootRunId: node.rootRunId,
      loopRunId: node.loopRunId,
      loopId: node.loopId,
      jobNodeId: targetJob.id,
      jobAttempt: 1,
      stateRevisionBefore: revision
    });
    this.connection().prepare(`
      UPDATE control_flow_events SET target_job_run_id = ? WHERE id = ?
    `).run(targetRun.jobRunId, committed.controlFlowEventId);
    this.phases.createPhase(loop, targetJob, targetRun.jobRunId, node.loopRunId, "job", 1, revision);
  }

  private finishTechnicalFailure(
    node: NodeRun,
    outcome: JobNodeOutcome | ValidationNodeOutcome,
    terminal: "blocked" | "failed"
  ): void {
    this.states.commitNodeOutcome({
      rootRunId: node.rootRunId,
      nodeRunId: node.nodeRunId,
      baseRevision: node.stateRevisionBefore,
      outcome,
      nodeStatus: terminal,
      jobRunStatus: terminal,
      jobRunTerminal: terminal,
      control: { kind: outcome.role === "job" ? "job_terminal" : "validation_terminal" }
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
      startRepair: (loop, callerLoopRunId, repairRequest, orchestrationRequest, input, revision) =>
        this.phases.startRepair(loop, callerLoopRunId, repairRequest, orchestrationRequest, input, revision),
      routeGraphTransition: (node, revision, outcome) => this.runbook.route(node, revision, outcome, {
        startTransition: (loop, input, stateRevision) =>
          this.phases.startTransition(rootRunId, loop, input, stateRevision)
      }),
      returnValidation: (frame, context, revision) => {
        const node = this.phases.returnValidation(frame, context, revision);
        return { nodeRunId: node.nodeRunId, jobRunId: node.jobRunId! };
      }
    };
  }

  private requireDetails(loopRunId: string): LoopRunDetails {
    const details = this.loops.details(loopRunId);
    if (!details) throw new LoopRunIntegrityError(`Loop Run ${loopRunId} was not found.`);
    return details;
  }
}
