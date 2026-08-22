import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  JsonValue, NodeResult, ProjectGraphNode, ProjectGraphNodeRouteTarget,
  ProjectGraphRouteTarget, ProjectJobNode, ProjectRouteCandidate
} from "../shared/domain/automation.js";
import { routeTargetKey } from "../shared/domain/automation.js";
import type {
  CanonicalNodeOutcome, ControlFlowEvent, GraphNodeInvocation, GraphNodeInvocationDetails,
  GraphStateRevisionMetadata, JobNodeInvocation, NodeRun, OrchestrationScope, RepairFrame,
  RepairNodeOutcome, RepairRequest, RepairResult, RootExecutionSnapshot, RoutingDecision,
  RoutingRequest, ValidationNodeOutcome
} from "../shared/domain/runtime.js";
import type {
  RootRunOrchestrationProjection, RootRunRepairProjection, RootRunStateProjection
} from "../shared/domain/runs.js";
import type { TaskEnvelopeV7, TaskEnvelopeHistoryEntry } from "../shared/domain/taskEnvelope.js";
import {
  hasRepairCapacity, resolveOrchestratorOutcome, resolveRepairOutcome, resolveValidation
} from "./runtime/GraphRoutingEngine.js";
import { RuntimeDbConnection, isPatchedSqliteVersion } from "./runtime/RuntimeDbConnection.js";
import { applyStatePatch } from "./runtime/state/StatePatch.js";
import { jsonSha256, parseJsonValue } from "./runtime/state/CanonicalJson.js";

export { isPatchedSqliteVersion };

type DbRow = Record<string, unknown>;

export class RuntimeDatabase {
  private readonly manager: RuntimeDbConnection;
  constructor(dbPath: string) { this.manager = new RuntimeDbConnection(dbPath); }
  close(): void { this.manager.close(); }
  connection(): Database.Database { return this.manager.connection(); }

  initializeRoot(rootRunId: string): void {
    const snapshot = this.snapshot(rootRunId);
    const root = this.rootRow(rootRunId);
    this.connection().prepare("UPDATE root_runs SET status = 'running', updated_at = ? WHERE root_run_id = ?")
      .run(now(), rootRunId);
    if (root.kind === "graph") {
      this.requestOrchestrator(rootRunId, "graph", "start", undefined, undefined, undefined, {});
      return;
    }
    const graphNode = requireGraphNode(snapshot, String(root.target_id));
    const invocation = this.createGraphNodeInvocation(rootRunId, graphNode, "root", undefined, 0);
    this.requestOrchestrator(rootRunId, "graph_node", "start", invocation, undefined, undefined, {});
  }

  activeGraphNodeIds(): Set<string> {
    return new Set((this.connection().prepare(`
      SELECT DISTINCT graph_node_id FROM graph_node_invocations
      WHERE status IN ('queued','running','waiting_for_input')
    `).all() as DbRow[]).map((row) => String(row.graph_node_id)));
  }

  listGraphNodeInvocations(limit = 2_000): GraphNodeInvocationDetails[] {
    return (this.connection().prepare(
      "SELECT * FROM graph_node_invocations ORDER BY updated_at DESC, rowid DESC LIMIT ?"
    ).all(limit) as DbRow[]).map((row) => this.graphNodeDetails(String(row.graph_node_invocation_id)));
  }

  listRootGraphNodeInvocations(rootRunId: string): GraphNodeInvocationDetails[] {
    return (this.connection().prepare(
      "SELECT * FROM graph_node_invocations WHERE root_run_id = ? ORDER BY created_at, rowid"
    ).all(rootRunId) as DbRow[]).map((row) => this.graphNodeDetails(String(row.graph_node_invocation_id)));
  }

  pendingNodeRuns(rootRunId: string): NodeRun[] {
    return (this.connection().prepare(
      "SELECT * FROM node_runs WHERE root_run_id = ? AND status = 'queued' ORDER BY created_at, rowid"
    ).all(rootRunId) as DbRow[]).map(mapNodeRun);
  }

  getNodeRun(nodeRunId: string): NodeRun | undefined {
    const row = this.connection().prepare("SELECT * FROM node_runs WHERE node_run_id = ?").get(nodeRunId);
    return row ? mapNodeRun(row as DbRow) : undefined;
  }

  markNodeRunRunning(nodeRunId: string): NodeRun {
    const at = now();
    const result = this.connection().prepare(`
      UPDATE node_runs SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ?
      WHERE node_run_id = ? AND status = 'queued'
    `).run(at, at, nodeRunId);
    if (result.changes !== 1) throw new Error(`Node Run ${nodeRunId} is not queued.`);
    return this.getNodeRun(nodeRunId)!;
  }

  failExecutionNode(rootRunId: string, nodeRunId: string, status: "failed" | "cancelled", message: string): void {
    const at = now();
    this.connection().transaction(() => {
      this.connection().prepare(`
        UPDATE node_runs SET status = ?, error_code = ?, error_message = ?,
          state_revision_after = state_revision_before, completed_at = ?, updated_at = ?
        WHERE node_run_id = ? AND root_run_id = ? AND status IN ('queued','running')
      `).run(status, status === "failed" ? "execution_failed" : null,
        status === "failed" ? message : null, at, at, nodeRunId, rootRunId);
      this.connection().prepare(`
        UPDATE root_runs SET status = ?, error_code = ?, error_message = ?, active_node_run_id = NULL,
          completed_at = ?, updated_at = ? WHERE root_run_id = ?
      `).run(status, status === "failed" ? "execution_failed" : null,
        status === "failed" ? message : null, at, at, rootRunId);
      this.event(rootRunId, status === "cancelled" ? "root_cancelled" : "root_terminal", { sourceNodeRunId: nodeRunId });
    })();
  }

  isExecutionNodeRunnable(rootRunId: string, nodeRunId: string, taskId: string): boolean {
    return Boolean(this.connection().prepare(`
      SELECT 1 FROM root_runs root JOIN node_runs node ON node.root_run_id = root.root_run_id
      WHERE root.root_run_id = ? AND root.status IN ('queued','running','waiting_for_input')
        AND root.active_node_run_id = node.node_run_id AND node.node_run_id = ?
        AND node.execution_task_id = ? AND node.status IN ('queued','running')
    `).get(rootRunId, nodeRunId, taskId));
  }

  applyNodeOutcome(rootRunId: string, nodeRunId: string, outcome: CanonicalNodeOutcome): void {
    this.connection().transaction(() => {
      const node = this.requireNode(rootRunId, nodeRunId);
      if (node.role !== outcome.role || !["queued","running","waiting_for_input"].includes(node.status)) {
        throw new Error(`Node Run ${nodeRunId} cannot accept this ${outcome.role} outcome.`);
      }
      if (hasPatch(outcome)) this.applyPatch(rootRunId, nodeRunId, outcome.statePatch, outcome);
      const stateRevision = this.stateRevision(rootRunId);
      const at = now();
      this.connection().prepare(`
        UPDATE node_runs SET status = ?, outcome_json = ?, state_revision_after = ?, completed_at = ?,
          updated_at = ? WHERE node_run_id = ?
      `).run(outcome.state === "needs_input" ? "waiting_for_input"
        : outcome.role === "work" && outcome.state !== "completed" ? outcome.state
          : "completed", JSON.stringify(outcome), stateRevision,
        outcome.state === "needs_input" ? null : at, at, nodeRunId);
      if (outcome.state === "needs_input") {
        this.pauseRoot(rootRunId, outcome.summary);
        return;
      }
      if (outcome.role === "work") {
        if (outcome.state === "completed") this.afterWork(node);
        else this.terminalize(rootRunId, outcome.state, outcome);
      } else if (outcome.role === "validation") this.afterValidation(node, outcome);
      else if (outcome.role === "orchestrator") this.afterOrchestrator(node, outcome);
      else this.afterRepair(node, outcome);
    })();
  }

  resumeNode(rootRunId: string, nodeRunId: string, response: string): void {
    const node = this.requireNode(rootRunId, nodeRunId);
    if (node.status !== "waiting_for_input" || !node.outcome || !("question" in node.outcome)) {
      throw new Error(`Node Run ${nodeRunId} is not waiting for input.`);
    }
    const context = {
      ...(isObject(node.context) ? node.context : {}),
      resume: { question: node.outcome.question, context: node.outcome.context, response }
    };
    this.connection().transaction(() => {
      this.connection().prepare(`
        UPDATE node_runs SET status = 'queued', context_json = ?, execution_task_id = NULL,
          completed_at = NULL, updated_at = ? WHERE node_run_id = ?
      `).run(JSON.stringify(context), now(), nodeRunId);
      this.connection().prepare(`
        UPDATE root_runs SET status = 'running', error_code = NULL, error_message = NULL,
          active_node_run_id = ?, updated_at = ? WHERE root_run_id = ?
      `).run(nodeRunId, now(), rootRunId);
    })();
  }

  cancelRoot(rootRunId: string): void {
    const at = now();
    this.connection().transaction(() => {
      this.connection().prepare(`
        UPDATE node_runs SET status = 'cancelled', completed_at = ?, updated_at = ?
        WHERE root_run_id = ? AND status IN ('queued','running','waiting_for_input')
      `).run(at, at, rootRunId);
      this.connection().prepare(`
        UPDATE job_node_invocations SET status = 'cancelled', completed_at = ?, updated_at = ?
        WHERE root_run_id = ? AND status IN ('queued','running','waiting_for_input')
      `).run(at, at, rootRunId);
      this.connection().prepare(`
        UPDATE graph_node_invocations SET status = 'cancelled', completed_at = ?, updated_at = ?
        WHERE root_run_id = ? AND status IN ('queued','running','waiting_for_input')
      `).run(at, at, rootRunId);
      this.connection().prepare(`
        UPDATE repair_frames SET status = 'cancelled', completed_at = ?, updated_at = ?
        WHERE root_run_id = ? AND status = 'open'
      `).run(at, at, rootRunId);
      this.connection().prepare(`
        UPDATE root_runs SET status = 'cancelled', active_node_run_id = NULL,
          active_graph_node_invocation_id = NULL, completed_at = ?, updated_at = ? WHERE root_run_id = ?
      `).run(at, at, rootRunId);
      this.event(rootRunId, "root_cancelled", {});
    })();
  }

  buildTaskEnvelope(nodeRunId: string): TaskEnvelopeV7 {
    const node = this.getNodeRun(nodeRunId);
    if (!node) throw new Error(`Node Run ${nodeRunId} was not found.`);
    const snapshot = this.snapshot(node.rootRunId);
    const state = this.currentState(node.rootRunId);
    const base = {
      version: 7 as const,
      run: {
        rootRunId: node.rootRunId,
        graphNodeInvocationId: node.graphNodeInvocationId,
        jobNodeInvocationId: node.jobNodeInvocationId,
        nodeRunId: node.nodeRunId
      },
      state: { revision: this.stateRevision(node.rootRunId), value: state, sha256: jsonSha256(state) },
      ...(isObject(node.context) && isObject(node.context.resume)
        ? { resume: node.context.resume as { question: string; context: string; response: string } } : {}),
      relevantHistory: this.history(node.rootRunId, node.nodeRunId)
    };
    const graphNode = node.graphNodeId ? requireGraphNode(snapshot, node.graphNodeId) : undefined;
    if (node.role === "work") {
      const job = requireJob(graphNode, node.jobNodeId);
      return {
        ...base, role: "work", task: job.workNode.task,
        graphNode: identity(graphNode!), jobNode: identity(job), workNode: identity(job.workNode),
        workAttempt: this.jobInvocation(node.jobNodeInvocationId!).workAttempt,
        ...this.previousFeedback(node.jobNodeInvocationId!)
      };
    }
    if (node.role === "validation") {
      const job = requireJob(graphNode, node.jobNodeId);
      const workOutcome = this.latestWorkOutcome(node.jobNodeInvocationId!);
      return {
        ...base, role: "validation", task: job.validationNode.task,
        graphNode: identity(graphNode!), jobNode: identity(job), validationNode: identity(job.validationNode),
        workAttempt: this.jobInvocation(node.jobNodeInvocationId!).workAttempt,
        workOutcome,
        ...this.repairReturn(node.jobNodeInvocationId!)
      };
    }
    if (node.role === "orchestrator") {
      const request = this.routingRequest(String((node.context as Record<string, JsonValue>).routingRequestId));
      const repairAvailable = request.scope === "graph"
        ? Boolean(snapshot.graph.repairNode)
        : Boolean(graphNode?.repairNode || snapshot.graph.repairNode);
      return {
        ...base, role: "orchestrator", task: request.scope === "graph"
          ? snapshot.graph.orchestrator.description : graphNode!.orchestrator.description,
        scope: request.scope, ...(graphNode ? { graphNode: identity(graphNode) } : {}),
        request: {
          id: request.routingRequestId, kind: request.kind, sourceChildId: request.sourceChildId,
          result: request.result, requestedCapability: request.requestedCapability, evidence: request.evidence
        },
        allowedCandidates: request.candidateKeys.map((key) => ({ key, description: key })),
        repairAvailable
      };
    }
    const request = this.repairRequest(String((node.context as Record<string, JsonValue>).repairRequestId));
    const definition = request.scope === "graph" ? snapshot.graph.repairNode : graphNode?.repairNode;
    if (!definition) throw new Error("Repair definition is absent from the immutable snapshot.");
    return {
      ...base, role: "repair", task: definition.task, scope: request.scope,
      ...(graphNode ? { graphNode: identity(graphNode) } : {}),
      request: {
        id: request.repairRequestId, reason: request.reason,
        requestedCapability: request.requestedCapability, evidence: request.evidence,
        returnValidationNodeId: request.returnValidationNodeId, attempt: request.attempt, depth: request.depth
      },
      allowedCandidates: request.candidateKeys.map((key) => ({ key, description: key })),
      parentEscalationAvailable: request.scope === "graph_node" && Boolean(snapshot.graph.repairNode)
    };
  }

  readRootState(rootRunId: string): RootRunStateProjection {
    const rows = this.connection().prepare(
      "SELECT * FROM graph_state_revisions WHERE root_run_id = ? ORDER BY revision DESC LIMIT 64"
    ).all(rootRunId) as DbRow[];
    const current = rows[0];
    if (!current) throw new Error(`Root Run ${rootRunId} has no State.`);
    const count = Number((this.connection().prepare(
      "SELECT COUNT(*) count FROM graph_state_revisions WHERE root_run_id = ?"
    ).get(rootRunId) as DbRow).count);
    return {
      currentRevision: Number(current.revision),
      currentState: parseJsonValue(String(current.state_json), "Graph State"),
      currentStateSha256: String(current.state_hash),
      revisions: rows.map(mapStateMetadata),
      totalRevisionCount: count,
      historyTruncated: count > rows.length
    };
  }

  readRootOrchestration(rootRunId: string): RootRunOrchestrationProjection {
    const requests = (this.connection().prepare(
      "SELECT * FROM routing_requests WHERE root_run_id = ? ORDER BY created_at, rowid"
    ).all(rootRunId) as DbRow[]).map(mapRoutingRequest);
    const decisions = (this.connection().prepare(
      "SELECT * FROM routing_decisions WHERE root_run_id = ? ORDER BY created_at, rowid"
    ).all(rootRunId) as DbRow[]).map(mapRoutingDecision);
    return {
      requests, decisions,
      pendingRequest: [...requests].reverse().find(({ status }) => ["pending","waiting_for_input"].includes(status)),
      selectedDecision: [...decisions].reverse().find(({ valid }) => valid)
    };
  }

  listRoutingDecisions(limit = 2_000): RoutingDecision[] {
    return (this.connection().prepare(
      "SELECT * FROM routing_decisions ORDER BY created_at DESC, rowid DESC LIMIT ?"
    ).all(limit) as DbRow[]).map(mapRoutingDecision);
  }

  readRootRepair(rootRunId: string): RootRunRepairProjection {
    const requests = (this.connection().prepare(
      "SELECT * FROM repair_requests WHERE root_run_id = ? ORDER BY created_at, rowid"
    ).all(rootRunId) as DbRow[]).map(mapRepairRequest);
    const frames = (this.connection().prepare(
      "SELECT * FROM repair_frames WHERE root_run_id = ? ORDER BY created_at, rowid"
    ).all(rootRunId) as DbRow[]).map(mapRepairFrame);
    const results = (this.connection().prepare(
      "SELECT * FROM repair_results WHERE root_run_id = ? ORDER BY created_at, rowid"
    ).all(rootRunId) as DbRow[]).map(mapRepairResult);
    return {
      requests, frames, results, activeFrames: frames.filter(({ status }) => status === "open"),
      pendingRepair: [...requests].reverse().find(({ status }) => ["pending","running"].includes(status))
    };
  }

  listControlFlowEvents(rootRunId: string): ControlFlowEvent[] {
    return (this.connection().prepare(
      "SELECT * FROM control_flow_events WHERE root_run_id = ? ORDER BY sequence"
    ).all(rootRunId) as DbRow[]).map(mapControlFlowEvent);
  }

  private afterWork(node: NodeRun): void {
    this.event(node.rootRunId, "work_completed", {
      graphNodeInvocationId: node.graphNodeInvocationId,
      jobNodeInvocationId: node.jobNodeInvocationId,
      sourceNodeRunId: node.nodeRunId
    });
    const snapshot = this.snapshot(node.rootRunId);
    const graphNode = requireGraphNode(snapshot, node.graphNodeId!);
    const job = requireJob(graphNode, node.jobNodeId);
    this.createValidation(node.rootRunId, graphNode, job, node.graphNodeInvocationId!, node.jobNodeInvocationId!);
  }

  private afterValidation(node: NodeRun, outcome: ValidationNodeOutcome): void {
    const jobInvocation = this.jobInvocation(node.jobNodeInvocationId!);
    const graphNode = requireGraphNode(this.snapshot(node.rootRunId), node.graphNodeId!);
    const job = requireJob(graphNode, node.jobNodeId);
    const resolution = resolveValidation(outcome.decision, jobInvocation.workAttempt, job.maxRetries);
    if (resolution === "pass") {
      this.completeJob(node, "PASS");
      return;
    }
    if (resolution === "retry_work") {
      this.connection().prepare(`
        UPDATE job_node_invocations SET work_attempt = work_attempt + 1, status = 'running',
          active_node_run_id = NULL, updated_at = ? WHERE job_node_invocation_id = ?
      `).run(now(), node.jobNodeInvocationId);
      this.event(node.rootRunId, "validation_fail_retry", {
        graphNodeInvocationId: node.graphNodeInvocationId, jobNodeInvocationId: node.jobNodeInvocationId,
        sourceNodeRunId: node.nodeRunId
      });
      this.createWork(node.rootRunId, graphNode, job, node.graphNodeInvocationId!, node.jobNodeInvocationId!);
      return;
    }
    this.event(node.rootRunId, "validation_fail_repair", {
      graphNodeInvocationId: node.graphNodeInvocationId, jobNodeInvocationId: node.jobNodeInvocationId,
      sourceNodeRunId: node.nodeRunId
    });
    this.requestOrchestrator(
      node.rootRunId, "graph_node", "repair",
      this.graphNodeInvocation(node.graphNodeInvocationId!), node.jobNodeId, "FAIL",
      outcome.evidence, outcome.repairRequest?.requestedCapability, node.nodeRunId
    );
  }

  private afterOrchestrator(node: NodeRun, outcome: Extract<CanonicalNodeOutcome, { role: "orchestrator" }>): void {
    const context = node.context as Record<string, JsonValue>;
    const request = this.routingRequest(String(context.routingRequestId));
    const snapshot = this.snapshot(node.rootRunId);
    const graphNode = request.graphNodeId ? requireGraphNode(snapshot, request.graphNodeId) : undefined;
    const repairDefinition = request.scope === "graph" ? snapshot.graph.repairNode : graphNode?.repairNode ?? snapshot.graph.repairNode;
    const maxAttempts = request.scope === "graph"
      ? snapshot.graph.orchestrator.maxRouteAttempts : graphNode!.orchestrator.maxRouteAttempts;
    const resolution = resolveOrchestratorOutcome({
      outcome, candidateKeys: request.candidateKeys, attempt: request.attempt,
      maxAttempts: Math.min(3, maxAttempts), repairAvailable: Boolean(repairDefinition)
    });
    const valid = resolution.kind === "dispatch" || resolution.kind === "complete"
      || resolution.kind === "delegate_repair" && outcome.state === "completed" && outcome.action === "delegate_repair"
      || resolution.kind === "needs_input" && outcome.state === "needs_input";
    const decision: RoutingDecision = {
      routingDecisionId: randomUUID(), routingRequestId: request.routingRequestId, rootRunId: node.rootRunId,
      orchestratorNodeRunId: node.nodeRunId,
      action: outcome.state === "needs_input" ? "needs_input" : outcome.action,
      selectedTarget: outcome.state === "completed" && outcome.action === "dispatch" ? outcome.target : undefined,
      result: outcome.state === "completed" && outcome.action === "complete" ? outcome.result : undefined,
      reason: outcome.state === "needs_input" ? outcome.context : outcome.reason, valid, createdAt: now()
    };
    this.insertDecision(decision);
    this.connection().prepare(
      "UPDATE routing_requests SET status = ?, completed_at = ?, updated_at = ? WHERE routing_request_id = ?"
    ).run(valid ? "decided" : "failed", now(), now(), request.routingRequestId);
    this.event(node.rootRunId, valid ? "orchestrator_decided" : "orchestrator_invalid", {
      sourceNodeRunId: node.nodeRunId, routingRequestId: request.routingRequestId
    });
    if (resolution.kind === "retry_orchestrator") {
      this.repeatRoutingRequest(request);
    } else if (resolution.kind === "delegate_repair") {
      this.spawnRepair(request, node.nodeRunId);
    } else if (resolution.kind === "needs_input") {
      this.pauseRoot(node.rootRunId, outcome.summary);
    } else if (resolution.kind === "complete") {
      this.completeScope(node.rootRunId, request, resolution.result, outcome);
    } else {
      this.dispatchTarget(node.rootRunId, request.scope, request.graphNodeId, resolution.target, "orchestrator");
      this.connection().prepare(
        "UPDATE routing_requests SET status = 'dispatched', updated_at = ? WHERE routing_request_id = ?"
      ).run(now(), request.routingRequestId);
    }
  }

  private afterRepair(node: NodeRun, outcome: RepairNodeOutcome): void {
    const request = this.repairRequest(String((node.context as Record<string, JsonValue>).repairRequestId));
    const snapshot = this.snapshot(node.rootRunId);
    const resolution = resolveRepairOutcome({
      outcome, candidateKeys: request.candidateKeys, scope: request.scope,
      parentEscalationAvailable: request.scope === "graph_node" && Boolean(snapshot.graph.repairNode)
    });
    if (resolution.kind === "needs_input") {
      this.connection().prepare(
        "UPDATE repair_requests SET status = 'needs_input', updated_at = ? WHERE repair_request_id = ?"
      ).run(now(), request.repairRequestId);
      this.pauseRoot(node.rootRunId, outcome.summary);
      return;
    }
    if (resolution.kind === "escalate") {
      this.connection().prepare(
        "UPDATE repair_requests SET status = 'escalated', completed_at = ?, updated_at = ? WHERE repair_request_id = ?"
      ).run(now(), now(), request.repairRequestId);
      this.event(node.rootRunId, "repair_escalated", { sourceNodeRunId: node.nodeRunId, repairRequestId: request.repairRequestId });
      this.spawnGraphRepairFrom(request, node.nodeRunId);
      return;
    }
    if (resolution.kind === "dispatch") {
      this.dispatchTarget(node.rootRunId, request.scope, request.graphNodeId, resolution.target, "repair");
      return;
    }
    this.returnFromRepair(request, outcome, node.nodeRunId);
  }

  private completeJob(node: NodeRun, result: NodeResult): void {
    const at = now();
    this.connection().prepare(`
      UPDATE job_node_invocations SET status = 'completed', state_revision_after = ?,
        active_node_run_id = NULL, completed_at = ?, updated_at = ? WHERE job_node_invocation_id = ?
    `).run(this.stateRevision(node.rootRunId), at, at, node.jobNodeInvocationId);
    this.event(node.rootRunId, result === "PASS" ? "validation_pass" : "validation_fail_repair", {
      graphNodeInvocationId: node.graphNodeInvocationId, jobNodeInvocationId: node.jobNodeInvocationId,
      sourceNodeRunId: node.nodeRunId
    });
    const repairTarget = this.openRepairTarget(node.rootRunId, node.jobNodeInvocationId!);
    if (repairTarget) {
      this.returnFromRepair(repairTarget.request, {
        role: "repair", state: "completed", action: "revalidate",
        summary: "Repair dispatch completed.", artifacts: {}
      }, node.nodeRunId);
      return;
    }
    this.requestOrchestrator(
      node.rootRunId, "graph_node", "continuation",
      this.graphNodeInvocation(node.graphNodeInvocationId!), node.jobNodeId, result, {}, undefined, node.nodeRunId
    );
  }

  private completeScope(
    rootRunId: string,
    request: RoutingRequest,
    result: NodeResult,
    outcome: CanonicalNodeOutcome
  ): void {
    if (request.scope === "graph") {
      this.terminalize(rootRunId, result === "PASS" ? "completed" : "failed", outcome);
      return;
    }
    const invocation = this.graphNodeInvocationByRoot(rootRunId, request.graphNodeId!);
    const at = now();
    this.connection().prepare(`
      UPDATE graph_node_invocations SET status = 'completed', completion_state_revision = ?,
        completed_at = ?, updated_at = ? WHERE graph_node_invocation_id = ?
    `).run(this.stateRevision(rootRunId), at, at, invocation.graphNodeInvocationId);
    const root = this.rootRow(rootRunId);
    const repairTarget = this.openRepairGraphTarget(rootRunId, invocation.graphNodeInvocationId);
    if (repairTarget) {
      this.returnFromRepair(repairTarget.request, {
        role: "repair", state: "completed", action: "revalidate",
        summary: "Repair Graph Node completed.", artifacts: {}
      }, request.sourceNodeRunId ?? "");
    } else if (root.kind === "graph_node") {
      this.terminalize(rootRunId, result === "PASS" ? "completed" : "failed", outcome);
    } else {
      this.requestOrchestrator(rootRunId, "graph", "continuation", undefined, invocation.graphNodeId, result, {});
    }
  }

  private requestOrchestrator(
    rootRunId: string,
    scope: OrchestrationScope,
    kind: RoutingRequest["kind"],
    invocation?: GraphNodeInvocation,
    sourceChildId?: string,
    result?: NodeResult,
    evidence: JsonValue = {},
    requestedCapability?: string,
    sourceNodeRunId?: string,
    attempt = 1
  ): void {
    const snapshot = this.snapshot(rootRunId);
    const graphNode = scope === "graph_node"
      ? requireGraphNode(snapshot, invocation?.graphNodeId ?? this.rootRow(rootRunId).target_id as string)
      : undefined;
    const orchestrator = scope === "graph" ? snapshot.graph.orchestrator : graphNode!.orchestrator;
    const candidates = ruleCandidates(
      orchestrator.routing as Parameters<typeof ruleCandidates>[0],
      kind, sourceChildId, result, requestedCapability
    );
    const request: RoutingRequest = {
      routingRequestId: randomUUID(), rootRunId, scope, kind,
      graphNodeId: graphNode?.id, sourceChildId, sourceNodeRunId, result, requestedCapability,
      stateRevision: this.stateRevision(rootRunId), evidence,
      candidateKeys: candidates.map(({ target }) => routeTargetKey(
        target as ProjectGraphRouteTarget | ProjectGraphNodeRouteTarget
      )),
      attempt, status: "pending", createdAt: now(), updatedAt: now()
    };
    this.insertRoutingRequest(request);
    const nodeRunId = randomUUID();
    this.insertNode({
      nodeRunId, rootRunId, graphNodeInvocationId: invocation?.graphNodeInvocationId,
      scope, role: "orchestrator", graphNodeId: graphNode?.id,
      nodeDefinitionId: orchestrator.id, context: { routingRequestId: request.routingRequestId },
      status: "queued", attempt, stateRevisionBefore: request.stateRevision
    });
    this.event(rootRunId, "orchestrator_requested", {
      graphNodeInvocationId: invocation?.graphNodeInvocationId,
      sourceNodeRunId, targetNodeRunId: nodeRunId, routingRequestId: request.routingRequestId
    });
  }

  private repeatRoutingRequest(request: RoutingRequest): void {
    const invocation = request.graphNodeId
      ? this.graphNodeInvocationByRoot(request.rootRunId, request.graphNodeId) : undefined;
    this.requestOrchestrator(
      request.rootRunId, request.scope, request.kind, invocation, request.sourceChildId,
      request.result, request.evidence, request.requestedCapability, request.sourceNodeRunId, request.attempt + 1
    );
  }

  private dispatchTarget(
    rootRunId: string,
    scope: OrchestrationScope,
    graphNodeId: string | undefined,
    target: string,
    source: "orchestrator" | "repair"
  ): void {
    const snapshot = this.snapshot(rootRunId);
    if (scope === "graph" && target.startsWith("graph-node:")) {
      const graphNode = requireGraphNode(snapshot, target.slice("graph-node:".length));
      const invocation = this.createGraphNodeInvocation(rootRunId, graphNode, source, undefined, this.openFrames(rootRunId).length);
      this.requestOrchestrator(rootRunId, "graph_node", "start", invocation, undefined, undefined, {});
      this.event(rootRunId, "graph_node_dispatched", { graphNodeInvocationId: invocation.graphNodeInvocationId });
      return;
    }
    if (scope === "graph_node" && target.startsWith("job-node:")) {
      const graphNode = requireGraphNode(snapshot, graphNodeId!);
      const job = requireJob(graphNode, target.slice("job-node:".length));
      const invocation = this.graphNodeInvocationByRoot(rootRunId, graphNode.id);
      this.createJob(rootRunId, graphNode, job, invocation);
      return;
    }
    if (target.startsWith("terminal:")) {
      const result = target.slice("terminal:".length) as NodeResult;
      const request = this.readRootOrchestration(rootRunId).pendingRequest;
      if (request) this.completeScope(rootRunId, request, result, {
        role: "orchestrator", state: "completed", action: "complete",
        summary: `${scope} completed ${result}.`, result, reason: "Selected terminal candidate."
      });
      return;
    }
    throw new Error(`Target ${target} is not valid in ${scope} scope.`);
  }

  private createGraphNodeInvocation(
    rootRunId: string,
    graphNode: ProjectGraphNode,
    source: GraphNodeInvocation["source"],
    parent: string | undefined,
    depth: number
  ): GraphNodeInvocation {
    const id = randomUUID();
    const at = now();
    this.connection().prepare(`
      INSERT INTO graph_node_invocations (
        graph_node_invocation_id, root_run_id, graph_node_id, parent_graph_node_invocation_id,
        source, status, snapshot_json, entry_state_revision, nesting_depth, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?)
    `).run(id, rootRunId, graphNode.id, parent ?? null, source, JSON.stringify(graphNode),
      this.stateRevision(rootRunId), Math.min(3, depth), at, at);
    this.connection().prepare(`
      UPDATE root_runs SET active_graph_node_invocation_id = ?, status = 'running', updated_at = ?
      WHERE root_run_id = ?
    `).run(id, at, rootRunId);
    return this.graphNodeInvocation(id);
  }

  private createJob(rootRunId: string, graphNode: ProjectGraphNode, job: ProjectJobNode, graphInvocation: GraphNodeInvocation): void {
    const id = randomUUID();
    const at = now();
    this.connection().prepare(`
      INSERT INTO job_node_invocations (
        job_node_invocation_id, root_run_id, graph_node_invocation_id, graph_node_id, job_node_id,
        work_attempt, status, state_revision_before, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, 'running', ?, ?, ?)
    `).run(id, rootRunId, graphInvocation.graphNodeInvocationId, graphNode.id, job.id,
      this.stateRevision(rootRunId), at, at);
    this.event(rootRunId, "job_node_dispatched", {
      graphNodeInvocationId: graphInvocation.graphNodeInvocationId, jobNodeInvocationId: id
    });
    this.createWork(rootRunId, graphNode, job, graphInvocation.graphNodeInvocationId, id);
  }

  private createWork(rootRunId: string, graphNode: ProjectGraphNode, job: ProjectJobNode, graphInvocationId: string, jobInvocationId: string): void {
    const human = job.workNode.type === "human";
    const id = randomUUID();
    this.insertNode({
      nodeRunId: id, rootRunId, graphNodeInvocationId: graphInvocationId,
      jobNodeInvocationId: jobInvocationId,
      role: "work", graphNodeId: graphNode.id, jobNodeId: job.id, nodeDefinitionId: job.workNode.id,
      status: human ? "waiting_for_input" : "queued", attempt: this.jobInvocation(jobInvocationId).workAttempt,
      stateRevisionBefore: this.stateRevision(rootRunId)
    });
    this.connection().prepare(
      "UPDATE job_node_invocations SET active_node_run_id = ?, status = ?, updated_at = ? WHERE job_node_invocation_id = ?"
    ).run(id, human ? "waiting_for_input" : "running", now(), jobInvocationId);
    if (human) this.pauseRoot(rootRunId, "Human Work Node is awaiting an outcome.");
  }

  private createValidation(rootRunId: string, graphNode: ProjectGraphNode, job: ProjectJobNode, graphInvocationId: string, jobInvocationId: string): void {
    const human = job.validationNode.type === "human";
    const id = randomUUID();
    this.insertNode({
      nodeRunId: id, rootRunId, graphNodeInvocationId: graphInvocationId,
      jobNodeInvocationId: jobInvocationId,
      role: "validation", graphNodeId: graphNode.id, jobNodeId: job.id,
      nodeDefinitionId: job.validationNode.id, status: human ? "waiting_for_input" : "queued",
      attempt: this.jobInvocation(jobInvocationId).workAttempt, stateRevisionBefore: this.stateRevision(rootRunId)
    });
    this.connection().prepare(
      "UPDATE job_node_invocations SET active_node_run_id = ?, status = ?, updated_at = ? WHERE job_node_invocation_id = ?"
    ).run(id, human ? "waiting_for_input" : "running", now(), jobInvocationId);
    if (human) this.pauseRoot(rootRunId, "Human Validation Node is awaiting an outcome.");
  }

  private spawnRepair(request: RoutingRequest, requesterNodeRunId: string): void {
    const validation = request.sourceNodeRunId ? this.getNodeRun(request.sourceNodeRunId) : undefined;
    if (!validation?.jobNodeInvocationId || !validation.graphNodeInvocationId) {
      this.pauseRoot(request.rootRunId, "Repair requires a Validation return address.");
      return;
    }
    this.createRepair(
      request.rootRunId, request.scope, request.graphNodeId, requesterNodeRunId,
      validation.jobNodeInvocationId, validation.graphNodeInvocationId,
      validation.nodeDefinitionId, request.requestedCapability,
      request.evidence, request.candidateKeys
    );
  }

  private spawnGraphRepairFrom(request: RepairRequest, requesterNodeRunId: string): void {
    const frame = this.frameForRequest(request.repairRequestId);
    this.createRepair(
      request.rootRunId, "graph", request.graphNodeId, requesterNodeRunId,
      frame.returnJobNodeInvocationId, frame.returnGraphNodeInvocationId,
      frame.returnValidationNodeId, request.requestedCapability, request.evidence,
      request.candidateKeys, frame.repairFrameId
    );
  }

  private createRepair(
    rootRunId: string,
    scope: OrchestrationScope,
    graphNodeId: string | undefined,
    requesterNodeRunId: string,
    returnJobId: string,
    returnGraphId: string,
    returnValidationId: string,
    requestedCapability: string | undefined,
    evidence: JsonValue,
    candidateKeys: string[],
    parentFrameId?: string
  ): void {
    const snapshot = this.snapshot(rootRunId);
    const graphNode = graphNodeId ? requireGraphNode(snapshot, graphNodeId) : undefined;
    const definition = scope === "graph" ? snapshot.graph.repairNode : graphNode?.repairNode;
    const attempt = this.repairAttempt(rootRunId, scope, graphNodeId);
    const depth = this.openFrames(rootRunId).length + 1;
    if (!hasRepairCapacity(definition, attempt, depth)) {
      if (scope === "graph_node" && snapshot.graph.repairNode) {
        this.createRepair(rootRunId, "graph", graphNodeId, requesterNodeRunId, returnJobId,
          returnGraphId, returnValidationId, requestedCapability, evidence, candidateKeys, parentFrameId);
      } else this.pauseRoot(rootRunId, "Repair limits were exhausted; human input is required.");
      return;
    }
    const requestId = randomUUID();
    const frameId = randomUUID();
    const at = now();
    this.connection().prepare(`
      INSERT INTO repair_requests (
        repair_request_id, root_run_id, scope, graph_node_id, requester_node_run_id,
        requester_job_node_invocation_id, return_validation_node_id, attempt, depth, reason,
        requested_capability, evidence_json, state_revision, candidate_keys_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?)
    `).run(requestId, rootRunId, scope, graphNodeId ?? null, requesterNodeRunId, returnJobId,
      returnValidationId, attempt, depth, "Orchestrator delegated a bounded repair.",
      requestedCapability ?? null, JSON.stringify(evidence), this.stateRevision(rootRunId),
      JSON.stringify(candidateKeys), at, at);
    this.connection().prepare(`
      INSERT INTO repair_frames (
        repair_frame_id, root_run_id, repair_request_id, parent_frame_id,
        return_graph_node_invocation_id, return_job_node_invocation_id, return_validation_node_id,
        state_revision_at_call, depth, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(frameId, rootRunId, requestId, parentFrameId ?? null, returnGraphId, returnJobId,
      returnValidationId, this.stateRevision(rootRunId), depth, at, at);
    const nodeId = randomUUID();
    this.insertNode({
      nodeRunId: nodeId, rootRunId, graphNodeInvocationId: returnGraphId, scope, role: "repair",
      graphNodeId, nodeDefinitionId: definition!.id, context: { repairRequestId: requestId, repairFrameId: frameId },
      status: "queued", attempt, stateRevisionBefore: this.stateRevision(rootRunId)
    });
    this.event(rootRunId, "repair_dispatched", {
      graphNodeInvocationId: returnGraphId, jobNodeInvocationId: returnJobId,
      sourceNodeRunId: requesterNodeRunId, targetNodeRunId: nodeId,
      repairRequestId: requestId, repairFrameId: frameId
    });
  }

  private returnFromRepair(request: RepairRequest, outcome: RepairNodeOutcome, sourceNodeRunId: string): void {
    const frame = this.frameForRequest(request.repairRequestId);
    const resultId = randomUUID();
    const at = now();
    this.connection().prepare(`
      INSERT INTO repair_results (
        repair_result_id, root_run_id, repair_request_id, repair_frame_id,
        state_revision, outcome_json, summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(resultId, request.rootRunId, request.repairRequestId, frame.repairFrameId,
      this.stateRevision(request.rootRunId), JSON.stringify(outcome), outcome.summary, at);
    const frames = this.openFrames(request.rootRunId).filter((candidate) =>
      candidate.repairFrameId === frame.repairFrameId || candidate.repairFrameId === frame.parentFrameId);
    for (const candidate of frames) this.connection().prepare(`
      UPDATE repair_frames SET status = 'returned', completed_at = ?, updated_at = ? WHERE repair_frame_id = ?
    `).run(at, at, candidate.repairFrameId);
    this.connection().prepare(`
      UPDATE repair_requests SET status = 'repaired', completed_at = ?, updated_at = ? WHERE repair_request_id = ?
    `).run(at, at, request.repairRequestId);
    this.event(request.rootRunId, "repair_return", {
      graphNodeInvocationId: frame.returnGraphNodeInvocationId,
      jobNodeInvocationId: frame.returnJobNodeInvocationId,
      sourceNodeRunId, repairRequestId: request.repairRequestId, repairFrameId: frame.repairFrameId
    });
    const graphNode = requireGraphNode(this.snapshot(request.rootRunId), this.graphNodeInvocation(frame.returnGraphNodeInvocationId).graphNodeId);
    const job = requireJob(graphNode, this.jobInvocation(frame.returnJobNodeInvocationId).jobNodeId);
    this.connection().prepare(
      "UPDATE job_node_invocations SET status = 'running', active_node_run_id = NULL, updated_at = ? WHERE job_node_invocation_id = ?"
    ).run(at, frame.returnJobNodeInvocationId);
    this.createValidation(request.rootRunId, graphNode, job, frame.returnGraphNodeInvocationId, frame.returnJobNodeInvocationId);
  }

  private insertNode(input: {
    nodeRunId: string; rootRunId: string; graphNodeInvocationId?: string; jobNodeInvocationId?: string;
    scope?: OrchestrationScope; role: NodeRun["role"]; graphNodeId?: string; jobNodeId?: string;
    nodeDefinitionId: string; context?: JsonValue; status: NodeRun["status"]; attempt: number; stateRevisionBefore: number;
  }): void {
    const at = now();
    this.connection().prepare(`
      INSERT INTO node_runs (
        node_run_id, root_run_id, graph_node_invocation_id, job_node_invocation_id, scope, role,
        graph_node_id, job_node_id, node_definition_id, context_json, status, attempt,
        state_revision_before, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.nodeRunId, input.rootRunId, input.graphNodeInvocationId ?? null,
      input.jobNodeInvocationId ?? null, input.scope ?? null, input.role,
      input.graphNodeId ?? null, input.jobNodeId ?? null, input.nodeDefinitionId,
      input.context ? JSON.stringify(input.context) : null, input.status, input.attempt,
      input.stateRevisionBefore, at, at);
    this.connection().prepare(
      "UPDATE root_runs SET active_node_run_id = ?, status = ?, updated_at = ? WHERE root_run_id = ?"
    ).run(input.nodeRunId, input.status === "waiting_for_input" ? "waiting_for_input" : "running", at, input.rootRunId);
  }

  private insertRoutingRequest(request: RoutingRequest): void {
    this.connection().prepare(`
      INSERT INTO routing_requests (
        routing_request_id, root_run_id, scope, kind, graph_node_id, source_child_id,
        source_node_run_id, result, requested_capability, state_revision, evidence_json,
        candidate_keys_json, attempt, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(request.routingRequestId, request.rootRunId, request.scope, request.kind,
      request.graphNodeId ?? null, request.sourceChildId ?? null, request.sourceNodeRunId ?? null,
      request.result ?? null, request.requestedCapability ?? null, request.stateRevision,
      JSON.stringify(request.evidence), JSON.stringify(request.candidateKeys), request.attempt,
      request.status, request.createdAt, request.updatedAt);
  }

  private insertDecision(decision: RoutingDecision): void {
    this.connection().prepare(`
      INSERT INTO routing_decisions (
        routing_decision_id, routing_request_id, root_run_id, orchestrator_node_run_id,
        action, selected_target, result, reason, valid, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(decision.routingDecisionId, decision.routingRequestId, decision.rootRunId,
      decision.orchestratorNodeRunId, decision.action, decision.selectedTarget ?? null,
      decision.result ?? null, decision.reason, decision.valid ? 1 : 0, decision.createdAt);
  }

  private applyPatch(rootRunId: string, sourceNodeRunId: string, patch: unknown, outcome: CanonicalNodeOutcome): void {
    const current = this.currentState(rootRunId);
    const applied = applyStatePatch(current, patch);
    const revision = this.stateRevision(rootRunId) + 1;
    this.connection().prepare(`
      INSERT INTO graph_state_revisions (
        root_run_id, revision, parent_revision, state_json, state_hash, patch_json, patch_hash,
        source_node_run_id, outcome_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(rootRunId, revision, revision - 1, applied.stateJson, applied.stateSha256,
      applied.patchJson, applied.patchSha256, sourceNodeRunId, JSON.stringify(outcome), now());
    this.connection().prepare(
      "UPDATE root_runs SET current_state_revision = ?, updated_at = ? WHERE root_run_id = ?"
    ).run(revision, now(), rootRunId);
  }

  private event(rootRunId: string, kind: ControlFlowEvent["kind"], detail: {
    graphNodeInvocationId?: string; jobNodeInvocationId?: string; sourceNodeRunId?: string;
    targetNodeRunId?: string; routingRequestId?: string; repairRequestId?: string; repairFrameId?: string;
  }): void {
    const root = this.rootRow(rootRunId);
    const next = Number(root.transition_count) + 1;
    if (next > 256) {
      this.connection().prepare(`
        UPDATE root_runs SET status = 'failed', error_code = 'transition_limit',
          error_message = 'Orchestrator transition limit 256 was reached.',
          active_node_run_id = NULL, completed_at = ?, updated_at = ? WHERE root_run_id = ?
      `).run(now(), now(), rootRunId);
      return;
    }
    this.connection().prepare(`
      INSERT INTO control_flow_events (
        root_run_id, sequence, kind, state_revision, graph_node_invocation_id,
        job_node_invocation_id, source_node_run_id, target_node_run_id,
        routing_request_id, repair_request_id, repair_frame_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(rootRunId, next, kind, this.stateRevision(rootRunId),
      detail.graphNodeInvocationId ?? null, detail.jobNodeInvocationId ?? null,
      detail.sourceNodeRunId ?? null, detail.targetNodeRunId ?? null,
      detail.routingRequestId ?? null, detail.repairRequestId ?? null,
      detail.repairFrameId ?? null, now());
    this.connection().prepare(
      "UPDATE root_runs SET transition_count = ?, updated_at = ? WHERE root_run_id = ?"
    ).run(next, now(), rootRunId);
  }

  private terminalize(rootRunId: string, status: "completed"|"blocked"|"failed", outcome: CanonicalNodeOutcome): void {
    const at = now();
    this.connection().prepare(`
      UPDATE root_runs SET status = ?, outcome_json = ?, active_node_run_id = NULL,
        active_graph_node_invocation_id = NULL, completed_at = ?, updated_at = ? WHERE root_run_id = ?
    `).run(status, JSON.stringify(outcome), at, at, rootRunId);
    this.event(rootRunId, "root_terminal", {});
  }

  private pauseRoot(rootRunId: string, message: string): void {
    this.connection().prepare(`
      UPDATE root_runs SET status = 'waiting_for_input', error_message = ?, updated_at = ? WHERE root_run_id = ?
    `).run(message, now(), rootRunId);
    this.event(rootRunId, "root_needs_input", {});
  }

  private snapshot(rootRunId: string): RootExecutionSnapshot {
    const source = String(this.rootRow(rootRunId).execution_snapshot_json);
    const value = JSON.parse(source) as RootExecutionSnapshot;
    if (value.version !== 7) throw new Error("Persisted Root snapshot is not v7.");
    return value;
  }
  private rootRow(rootRunId: string): DbRow {
    const row = this.connection().prepare("SELECT * FROM root_runs WHERE root_run_id = ?").get(rootRunId);
    if (!row) throw new Error(`Root Run ${rootRunId} was not found.`);
    return row as DbRow;
  }
  private stateRevision(rootRunId: string): number { return Number(this.rootRow(rootRunId).current_state_revision); }
  private currentState(rootRunId: string): JsonValue {
    const row = this.connection().prepare(
      "SELECT state_json FROM graph_state_revisions WHERE root_run_id = ? ORDER BY revision DESC LIMIT 1"
    ).get(rootRunId) as DbRow | undefined;
    if (!row) throw new Error("Root State is missing.");
    return parseJsonValue(String(row.state_json), "Graph State");
  }
  private requireNode(rootRunId: string, nodeRunId: string): NodeRun {
    const node = this.getNodeRun(nodeRunId);
    if (!node || node.rootRunId !== rootRunId) throw new Error(`Node Run ${nodeRunId} was not found in Root Run ${rootRunId}.`);
    return node;
  }
  private graphNodeInvocation(id: string): GraphNodeInvocation {
    const row = this.connection().prepare("SELECT * FROM graph_node_invocations WHERE graph_node_invocation_id = ?").get(id);
    if (!row) throw new Error(`Graph Node invocation ${id} was not found.`);
    return mapGraphNodeInvocation(row as DbRow);
  }
  private graphNodeInvocationByRoot(rootRunId: string, graphNodeId: string): GraphNodeInvocation {
    const row = this.connection().prepare(`
      SELECT * FROM graph_node_invocations WHERE root_run_id = ? AND graph_node_id = ?
      ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get(rootRunId, graphNodeId);
    if (!row) throw new Error(`Graph Node ${graphNodeId} has no invocation in Root Run ${rootRunId}.`);
    return mapGraphNodeInvocation(row as DbRow);
  }
  private graphNodeDetails(id: string): GraphNodeInvocationDetails {
    const invocation = this.graphNodeInvocation(id);
    return {
      ...invocation,
      jobNodeInvocations: (this.connection().prepare(
        "SELECT * FROM job_node_invocations WHERE graph_node_invocation_id = ? ORDER BY created_at, rowid"
      ).all(id) as DbRow[]).map(mapJobNodeInvocation),
      nodeRuns: (this.connection().prepare(
        "SELECT * FROM node_runs WHERE graph_node_invocation_id = ? ORDER BY created_at, rowid"
      ).all(id) as DbRow[]).map(mapNodeRun)
    };
  }
  private jobInvocation(id: string): JobNodeInvocation {
    const row = this.connection().prepare("SELECT * FROM job_node_invocations WHERE job_node_invocation_id = ?").get(id);
    if (!row) throw new Error(`Job Node invocation ${id} was not found.`);
    return mapJobNodeInvocation(row as DbRow);
  }
  private routingRequest(id: string): RoutingRequest {
    const row = this.connection().prepare("SELECT * FROM routing_requests WHERE routing_request_id = ?").get(id);
    if (!row) throw new Error(`Routing request ${id} was not found.`);
    return mapRoutingRequest(row as DbRow);
  }
  private repairRequest(id: string): RepairRequest {
    const row = this.connection().prepare("SELECT * FROM repair_requests WHERE repair_request_id = ?").get(id);
    if (!row) throw new Error(`Repair request ${id} was not found.`);
    return mapRepairRequest(row as DbRow);
  }
  private frameForRequest(id: string): RepairFrame {
    const row = this.connection().prepare(
      "SELECT * FROM repair_frames WHERE repair_request_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1"
    ).get(id);
    if (!row) throw new Error(`Repair frame for ${id} was not found.`);
    return mapRepairFrame(row as DbRow);
  }
  private openFrames(rootRunId: string): RepairFrame[] {
    return (this.connection().prepare(
      "SELECT * FROM repair_frames WHERE root_run_id = ? AND status = 'open' ORDER BY depth, created_at"
    ).all(rootRunId) as DbRow[]).map(mapRepairFrame);
  }
  private openRepairTarget(rootRunId: string, jobInvocationId: string): { request: RepairRequest } | undefined {
    const frame = [...this.openFrames(rootRunId)].reverse().find((candidate) =>
      candidate.returnJobNodeInvocationId !== jobInvocationId);
    return frame ? { request: this.repairRequest(frame.repairRequestId) } : undefined;
  }
  private openRepairGraphTarget(rootRunId: string, graphInvocationId: string): { request: RepairRequest } | undefined {
    const frame = [...this.openFrames(rootRunId)].reverse().find((candidate) =>
      candidate.returnGraphNodeInvocationId !== graphInvocationId);
    return frame ? { request: this.repairRequest(frame.repairRequestId) } : undefined;
  }
  private repairAttempt(rootRunId: string, scope: OrchestrationScope, graphNodeId?: string): number {
    const row = this.connection().prepare(`
      SELECT COUNT(*) count FROM repair_requests WHERE root_run_id = ? AND scope = ?
        AND COALESCE(graph_node_id, '') = COALESCE(?, '')
    `).get(rootRunId, scope, graphNodeId ?? null) as DbRow;
    return Number(row.count) + 1;
  }
  private history(rootRunId: string, exclude: string): TaskEnvelopeHistoryEntry[] {
    return (this.connection().prepare(`
      SELECT node_run_id, role, outcome_json, state_revision_after FROM node_runs
      WHERE root_run_id = ? AND node_run_id <> ? AND outcome_json IS NOT NULL
      ORDER BY created_at DESC, rowid DESC LIMIT 8
    `).all(rootRunId, exclude) as DbRow[]).reverse().map((row, sequence) => {
      const outcome = JSON.parse(String(row.outcome_json)) as CanonicalNodeOutcome;
      return {
        sequence, nodeRunId: String(row.node_run_id), role: row.role as NodeRun["role"],
        state: outcome.state, summary: outcome.summary,
        stateRevision: Number(row.state_revision_after ?? this.stateRevision(rootRunId))
      };
    });
  }
  private latestWorkOutcome(jobInvocationId: string) {
    const row = this.connection().prepare(`
      SELECT outcome_json FROM node_runs WHERE job_node_invocation_id = ? AND role = 'work'
        AND outcome_json IS NOT NULL ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get(jobInvocationId) as DbRow | undefined;
    if (!row) throw new Error("Validation has no completed Work outcome.");
    const outcome = JSON.parse(String(row.outcome_json)) as CanonicalNodeOutcome;
    if (outcome.role !== "work") throw new Error("Persisted Work outcome has the wrong role.");
    return outcome;
  }
  private previousFeedback(jobInvocationId: string) {
    const row = this.connection().prepare(`
      SELECT outcome_json FROM node_runs WHERE job_node_invocation_id = ? AND role = 'validation'
        AND outcome_json IS NOT NULL ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get(jobInvocationId) as DbRow | undefined;
    if (!row) return {};
    const outcome = JSON.parse(String(row.outcome_json)) as ValidationNodeOutcome;
    return outcome.feedback && outcome.expectedCorrection
      ? { previousValidationFeedback: { feedback: outcome.feedback, expectedCorrection: outcome.expectedCorrection } }
      : {};
  }
  private repairReturn(jobInvocationId: string) {
    const row = this.connection().prepare(`
      SELECT result.repair_result_id, result.repair_request_id, result.state_revision, result.summary
      FROM repair_results result JOIN repair_frames frame ON frame.repair_frame_id = result.repair_frame_id
      WHERE frame.return_job_node_invocation_id = ? ORDER BY result.created_at DESC, result.rowid DESC LIMIT 1
    `).get(jobInvocationId) as DbRow | undefined;
    return row ? { repairReturn: {
      repairRequestId: String(row.repair_request_id), repairResultId: String(row.repair_result_id),
      stateRevision: Number(row.state_revision), summary: String(row.summary)
    } } : {};
  }
}

const ruleCandidates = <T>(
  routing: {
    start: { candidates: ProjectRouteCandidate<T>[] };
    continuation: Array<{ sourceId: string; result: NodeResult; candidates: ProjectRouteCandidate<T>[] }>;
    repair: Array<{ sourceId: string; capability: string; candidates: ProjectRouteCandidate<T>[] }>;
  },
  kind: RoutingRequest["kind"], source?: string, result?: NodeResult, capability?: string
): ProjectRouteCandidate<T>[] => kind === "start" ? routing.start.candidates
  : kind === "continuation"
    ? routing.continuation.find((rule) => rule.sourceId === source && rule.result === result)?.candidates ?? []
    : routing.repair.find((rule) => rule.sourceId === source && rule.capability === capability)?.candidates ?? [];

const requireGraphNode = (snapshot: RootExecutionSnapshot, id: string): ProjectGraphNode => {
  const node = snapshot.graph.graphNodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`Graph Node ${id} is outside the immutable snapshot.`);
  return node;
};
const requireJob = (graphNode: ProjectGraphNode | undefined, id: string | undefined): ProjectJobNode => {
  const job = graphNode?.jobNodes.find((candidate) => candidate.id === id);
  if (!job) throw new Error(`Job Node ${String(id)} is outside the immutable snapshot.`);
  return job;
};
const identity = (node: { id: string; description: string }) => ({ id: node.id, description: node.description });
const hasPatch = (outcome: CanonicalNodeOutcome): outcome is CanonicalNodeOutcome & { statePatch: NonNullable<unknown> } =>
  "statePatch" in outcome && Array.isArray(outcome.statePatch);
const now = (): string => new Date().toISOString();
const isObject = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const mapNodeRun = (row: DbRow): NodeRun => ({
  nodeRunId: String(row.node_run_id), rootRunId: String(row.root_run_id),
  graphNodeInvocationId: optional(row.graph_node_invocation_id),
  jobNodeInvocationId: optional(row.job_node_invocation_id),
  scope: optional(row.scope) as OrchestrationScope | undefined,
  role: row.role as NodeRun["role"], graphNodeId: optional(row.graph_node_id),
  jobNodeId: optional(row.job_node_id), nodeDefinitionId: String(row.node_definition_id),
  executionTaskId: optional(row.execution_task_id),
  input: json(row.input_json), context: json(row.context_json),
  outcome: row.outcome_json ? JSON.parse(String(row.outcome_json)) as CanonicalNodeOutcome : undefined,
  status: row.status as NodeRun["status"], attempt: Number(row.attempt),
  stateRevisionBefore: Number(row.state_revision_before),
  stateRevisionAfter: row.state_revision_after == null ? undefined : Number(row.state_revision_after),
  patch: row.patch_json && row.patch_hash ? {
    patch: JSON.parse(String(row.patch_json)), patchSha256: String(row.patch_hash)
  } : undefined,
  errorCode: optional(row.error_code), errorMessage: optional(row.error_message),
  createdAt: String(row.created_at), startedAt: optional(row.started_at),
  updatedAt: String(row.updated_at), completedAt: optional(row.completed_at)
});
const mapGraphNodeInvocation = (row: DbRow): GraphNodeInvocation => ({
  graphNodeInvocationId: String(row.graph_node_invocation_id), graphNodeId: String(row.graph_node_id),
  rootRunId: String(row.root_run_id), parentGraphNodeInvocationId: optional(row.parent_graph_node_invocation_id),
  source: row.source as GraphNodeInvocation["source"], status: row.status as GraphNodeInvocation["status"],
  input: json(row.input_json), snapshot: JSON.parse(String(row.snapshot_json)) as ProjectGraphNode,
  entryStateRevision: Number(row.entry_state_revision),
  completionStateRevision: row.completion_state_revision == null ? undefined : Number(row.completion_state_revision),
  nestingDepth: Number(row.nesting_depth), createdAt: String(row.created_at),
  updatedAt: String(row.updated_at), completedAt: optional(row.completed_at)
});
const mapJobNodeInvocation = (row: DbRow): JobNodeInvocation => ({
  jobNodeInvocationId: String(row.job_node_invocation_id), rootRunId: String(row.root_run_id),
  graphNodeInvocationId: String(row.graph_node_invocation_id), graphNodeId: String(row.graph_node_id),
  jobNodeId: String(row.job_node_id), workAttempt: Number(row.work_attempt),
  status: row.status as JobNodeInvocation["status"], stateRevisionBefore: Number(row.state_revision_before),
  stateRevisionAfter: row.state_revision_after == null ? undefined : Number(row.state_revision_after),
  activeNodeRunId: optional(row.active_node_run_id), createdAt: String(row.created_at),
  updatedAt: String(row.updated_at), completedAt: optional(row.completed_at)
});
const mapRoutingRequest = (row: DbRow): RoutingRequest => ({
  routingRequestId: String(row.routing_request_id), rootRunId: String(row.root_run_id),
  scope: row.scope as OrchestrationScope, kind: row.kind as RoutingRequest["kind"],
  graphNodeId: optional(row.graph_node_id), sourceChildId: optional(row.source_child_id),
  sourceNodeRunId: optional(row.source_node_run_id), result: optional(row.result) as NodeResult | undefined,
  requestedCapability: optional(row.requested_capability), stateRevision: Number(row.state_revision),
  evidence: JSON.parse(String(row.evidence_json)) as JsonValue,
  candidateKeys: JSON.parse(String(row.candidate_keys_json)) as string[], attempt: Number(row.attempt),
  status: row.status as RoutingRequest["status"], createdAt: String(row.created_at),
  updatedAt: String(row.updated_at), completedAt: optional(row.completed_at)
});
const mapRoutingDecision = (row: DbRow): RoutingDecision => ({
  routingDecisionId: String(row.routing_decision_id), routingRequestId: String(row.routing_request_id),
  rootRunId: String(row.root_run_id), orchestratorNodeRunId: String(row.orchestrator_node_run_id),
  action: row.action as RoutingDecision["action"], selectedTarget: optional(row.selected_target),
  result: optional(row.result) as NodeResult | undefined, reason: String(row.reason),
  valid: Boolean(row.valid), createdAt: String(row.created_at)
});
const mapRepairRequest = (row: DbRow): RepairRequest => ({
  repairRequestId: String(row.repair_request_id), rootRunId: String(row.root_run_id),
  scope: row.scope as OrchestrationScope, graphNodeId: optional(row.graph_node_id),
  requesterNodeRunId: String(row.requester_node_run_id),
  requesterJobNodeInvocationId: optional(row.requester_job_node_invocation_id),
  returnValidationNodeId: String(row.return_validation_node_id), attempt: Number(row.attempt),
  depth: Number(row.depth), reason: String(row.reason), requestedCapability: optional(row.requested_capability),
  evidence: JSON.parse(String(row.evidence_json)) as JsonValue, stateRevision: Number(row.state_revision),
  candidateKeys: JSON.parse(String(row.candidate_keys_json)) as string[], status: row.status as RepairRequest["status"],
  createdAt: String(row.created_at), updatedAt: String(row.updated_at), completedAt: optional(row.completed_at)
});
const mapRepairFrame = (row: DbRow): RepairFrame => ({
  repairFrameId: String(row.repair_frame_id), rootRunId: String(row.root_run_id),
  repairRequestId: String(row.repair_request_id), parentFrameId: optional(row.parent_frame_id),
  returnGraphNodeInvocationId: String(row.return_graph_node_invocation_id),
  returnJobNodeInvocationId: String(row.return_job_node_invocation_id),
  returnValidationNodeId: String(row.return_validation_node_id),
  stateRevisionAtCall: Number(row.state_revision_at_call), depth: Number(row.depth),
  status: row.status as RepairFrame["status"], createdAt: String(row.created_at),
  updatedAt: String(row.updated_at), completedAt: optional(row.completed_at)
});
const mapRepairResult = (row: DbRow): RepairResult => ({
  repairResultId: String(row.repair_result_id), rootRunId: String(row.root_run_id),
  repairRequestId: String(row.repair_request_id), repairFrameId: String(row.repair_frame_id),
  stateRevision: Number(row.state_revision), outcome: JSON.parse(String(row.outcome_json)) as CanonicalNodeOutcome,
  summary: String(row.summary), createdAt: String(row.created_at)
});
const mapStateMetadata = (row: DbRow): GraphStateRevisionMetadata => ({
  rootRunId: String(row.root_run_id), revision: Number(row.revision),
  parentRevision: row.parent_revision == null ? undefined : Number(row.parent_revision),
  stateSha256: String(row.state_hash), sourceNodeRunId: optional(row.source_node_run_id),
  patch: row.patch_json && row.patch_hash ? {
    patch: JSON.parse(String(row.patch_json)), patchSha256: String(row.patch_hash)
  } : undefined,
  patchOmitted: false, createdAt: String(row.created_at)
});
const mapControlFlowEvent = (row: DbRow): ControlFlowEvent => ({
  id: Number(row.id), rootRunId: String(row.root_run_id), sequence: Number(row.sequence),
  kind: row.kind as ControlFlowEvent["kind"], stateRevision: Number(row.state_revision),
  graphNodeInvocationId: optional(row.graph_node_invocation_id),
  jobNodeInvocationId: optional(row.job_node_invocation_id), sourceNodeRunId: optional(row.source_node_run_id),
  targetNodeRunId: optional(row.target_node_run_id), routingRequestId: optional(row.routing_request_id),
  repairRequestId: optional(row.repair_request_id), repairFrameId: optional(row.repair_frame_id),
  createdAt: String(row.created_at)
});
const optional = (value: unknown): string | undefined => value == null ? undefined : String(value);
const json = (value: unknown): JsonValue | undefined => value == null ? undefined : JSON.parse(String(value)) as JsonValue;
