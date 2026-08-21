import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { JsonValue, ProjectRepairEdge } from "../../shared/domain/automation.js";
import type {
  OrchestrationRequest, OrchestrationRequestKind, OrchestratorRoute
} from "../../shared/domain/runtime.js";
import { maxOrchestrationRequestEnvelopeBytes } from "../../shared/domain/taskEnvelope.js";
import {
  orchestrationRequestRowSchema, orchestratorRouteRowSchema
} from "./RuntimeDbTypes.js";
import { toOrchestrationRequest, toOrchestratorRoute } from "./RuntimeRowMappers.js";
import { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import { assertJsonValue, canonicalJson } from "./state/CanonicalJson.js";

export interface CreateOrchestrationRequestInput {
  orchestrationRequestId?: string;
  rootRunId: string;
  kind: OrchestrationRequestKind;
  sourceLoopRunId: string;
  sourceLoopId: string;
  sourceNodeRunId: string;
  stateRevisionAtRequest: number;
  completionSummary: string;
  completionEvidence: JsonValue;
  requestedCapability?: string;
  expectedOutcome?: JsonValue;
  repairRequestId?: string;
  createdAt?: string;
}

export class OrchestrationStore {
  private readonly snapshots: RootExecutionSnapshotStore;

  constructor(private readonly connection: () => Database.Database) {
    this.snapshots = new RootExecutionSnapshotStore(connection);
  }

  create(input: CreateOrchestrationRequestInput): OrchestrationRequest {
    const id = input.orchestrationRequestId ?? randomUUID();
    const timestamp = input.createdAt ?? new Date().toISOString();
    if (!input.completionSummary.trim()) throw new Error("Orchestration Request completion summary must be non-empty.");
    if (!input.repairRequestId) throw new Error("A repair Orchestration Request requires a Repair Request identity.");
    this.snapshots.loop(this.snapshots.require(input.rootRunId), input.sourceLoopId);
    assertJsonValue(input.completionEvidence, {
      label: `Orchestration Request ${id} completion evidence`, maxBytes: maxOrchestrationRequestEnvelopeBytes
    });
    if (input.expectedOutcome !== undefined) {
      assertJsonValue(input.expectedOutcome, {
        label: `Orchestration Request ${id} expected outcome`, maxBytes: maxOrchestrationRequestEnvelopeBytes
      });
    }
    this.connection().prepare(`
      INSERT INTO orchestration_requests (
        orchestration_request_id, root_run_id, kind, source_loop_run_id, source_loop_id,
        source_node_run_id, state_revision_at_request, completion_summary,
        completion_evidence_json, requested_capability, expected_outcome_json,
        repair_request_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      id, input.rootRunId, input.kind, input.sourceLoopRunId, input.sourceLoopId,
      input.sourceNodeRunId, input.stateRevisionAtRequest, input.completionSummary,
      canonicalJson(input.completionEvidence), input.requestedCapability ?? null,
      input.expectedOutcome === undefined ? null : canonicalJson(input.expectedOutcome),
      input.repairRequestId ?? null, timestamp, timestamp
    );
    return this.require(id);
  }

  get(orchestrationRequestId: string): OrchestrationRequest | undefined {
    const row = this.connection().prepare(`
      SELECT * FROM orchestration_requests WHERE orchestration_request_id = ?
    `).get(orchestrationRequestId);
    return row ? toOrchestrationRequest(orchestrationRequestRowSchema.parse(row)) : undefined;
  }

  require(orchestrationRequestId: string): OrchestrationRequest {
    const request = this.get(orchestrationRequestId);
    if (!request) throw new Error(`Orchestration Request ${orchestrationRequestId} was not found.`);
    return request;
  }

  list(rootRunId: string): OrchestrationRequest[] {
    return this.connection().prepare(`
      SELECT * FROM orchestration_requests WHERE root_run_id = ? ORDER BY created_at, rowid
    `).all(rootRunId).map((row) => toOrchestrationRequest(orchestrationRequestRowSchema.parse(row)));
  }

  bindOrchestrator(orchestrationRequestId: string, nodeRunId: string): OrchestrationRequest {
    const result = this.connection().prepare(`
      UPDATE orchestration_requests SET orchestrator_node_run_id = ?, updated_at = ?
      WHERE orchestration_request_id = ? AND status = 'pending' AND orchestrator_node_run_id IS NULL
    `).run(nodeRunId, new Date().toISOString(), orchestrationRequestId);
    if (result.changes !== 1) {
      throw new Error(`Orchestration Request ${orchestrationRequestId} cannot bind Orchestrator ${nodeRunId}.`);
    }
    return this.require(orchestrationRequestId);
  }

  forOrchestrator(nodeRunId: string): OrchestrationRequest | undefined {
    const row = this.connection().prepare(`
      SELECT * FROM orchestration_requests WHERE orchestrator_node_run_id = ?
    `).get(nodeRunId);
    return row ? toOrchestrationRequest(orchestrationRequestRowSchema.parse(row)) : undefined;
  }

  markWaiting(orchestrationRequestId: string): OrchestrationRequest {
    return this.changeStatus(orchestrationRequestId, "pending", "waiting_for_input");
  }

  markPending(orchestrationRequestId: string): OrchestrationRequest {
    return this.changeStatus(orchestrationRequestId, "waiting_for_input", "pending");
  }

  allowedCandidates(request: OrchestrationRequest): ProjectRepairEdge[] {
    const snapshot = this.snapshots.require(request.rootRunId);
    return snapshot.graph.repairEdges.filter((edge) => {
      if (edge.source !== request.sourceLoopId) return false;
      if (request.requestedCapability && edge.capability !== request.requestedCapability) return false;
      const target = snapshot.loops.find((loop) => loop.id === edge.target);
      return Boolean(target?.capabilities.provides.includes(edge.capability));
    });
  }

  route(input: {
    orchestrationRequestId: string;
    orchestratorNodeRunId: string;
    targetLoopId: string;
    routeReason: string;
    expectedOutcome: JsonValue;
    routeId?: string;
    routedAt?: string;
  }): OrchestratorRoute {
    const request = this.require(input.orchestrationRequestId);
    if (request.status !== "pending" || request.orchestratorNodeRunId !== input.orchestratorNodeRunId) {
      throw new Error(`Orchestration Request ${request.orchestrationRequestId} is not pending for this Orchestrator.`);
    }
    const edges = this.allowedCandidates(request).filter((edge) => edge.target === input.targetLoopId);
    if (edges.length !== 1) {
      throw new Error(
        `Loop ${input.targetLoopId} is not an unambiguous allowed ${request.kind} target from ${request.sourceLoopId}.`
      );
    }
    const edge = edges[0]!;
    const routeId = input.routeId ?? randomUUID();
    const timestamp = input.routedAt ?? new Date().toISOString();
    assertJsonValue(input.expectedOutcome, { label: `Orchestrator Route ${routeId} expected outcome` });
    this.connection().transaction(() => {
      const updated = this.connection().prepare(`
        UPDATE orchestration_requests SET status = 'routed', routed_loop_edge_id = ?,
          routed_target_loop_id = ?, updated_at = ?
        WHERE orchestration_request_id = ? AND status = 'pending'
      `).run(edge.id, edge.target, timestamp, request.orchestrationRequestId);
      if (updated.changes !== 1) throw new Error(`Orchestration Request ${request.orchestrationRequestId} is not pending.`);
      this.connection().prepare(`
        INSERT INTO orchestrator_routes (
          route_id, root_run_id, orchestration_request_id, kind, orchestrator_node_run_id,
          loop_edge_id, source_loop_id, target_loop_id, route_evidence_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        routeId, request.rootRunId, request.orchestrationRequestId, request.kind,
        input.orchestratorNodeRunId, edge.id, edge.source, edge.target,
        canonicalJson({ routeReason: input.routeReason, expectedOutcome: input.expectedOutcome }), timestamp
      );
    })();
    return this.requireRoute(routeId);
  }

  markDispatched(orchestrationRequestId: string, targetLoopRunId: string): OrchestrationRequest {
    const timestamp = new Date().toISOString();
    const result = this.connection().prepare(`
      UPDATE orchestration_requests SET status = 'dispatched', target_loop_run_id = ?,
        completed_at = ?, updated_at = ?
      WHERE orchestration_request_id = ? AND status = 'routed' AND target_loop_run_id IS NULL
    `).run(targetLoopRunId, timestamp, timestamp, orchestrationRequestId);
    if (result.changes !== 1) throw new Error(`Orchestration Request ${orchestrationRequestId} is not routed.`);
    return this.require(orchestrationRequestId);
  }

  fail(orchestrationRequestId: string, status: "failed" | "cancelled"): OrchestrationRequest {
    const timestamp = new Date().toISOString();
    const result = this.connection().prepare(`
      UPDATE orchestration_requests SET status = ?, completed_at = ?, updated_at = ?
      WHERE orchestration_request_id = ? AND status IN ('pending','waiting_for_input','routed')
    `).run(status, timestamp, timestamp, orchestrationRequestId);
    if (result.changes !== 1) throw new Error(`Orchestration Request ${orchestrationRequestId} is not active.`);
    return this.require(orchestrationRequestId);
  }

  routeForRequest(orchestrationRequestId: string): OrchestratorRoute | undefined {
    const row = this.connection().prepare(`
      SELECT route.*, request.repair_request_id
      FROM orchestrator_routes route
      JOIN orchestration_requests request
        ON request.orchestration_request_id = route.orchestration_request_id
      WHERE route.orchestration_request_id = ?
    `).get(orchestrationRequestId);
    return row ? toOrchestratorRoute(orchestratorRouteRowSchema.parse(row)) : undefined;
  }

  getRoute(routeId: string): OrchestratorRoute | undefined {
    const row = this.connection().prepare(`
      SELECT route.*, request.repair_request_id
      FROM orchestrator_routes route
      JOIN orchestration_requests request
        ON request.orchestration_request_id = route.orchestration_request_id
      WHERE route.route_id = ?
    `).get(routeId);
    return row ? toOrchestratorRoute(orchestratorRouteRowSchema.parse(row)) : undefined;
  }

  listRoutes(rootRunId: string): OrchestratorRoute[] {
    return this.connection().prepare(`
      SELECT route.*, request.repair_request_id
      FROM orchestrator_routes route
      JOIN orchestration_requests request
        ON request.orchestration_request_id = route.orchestration_request_id
      WHERE route.root_run_id = ? ORDER BY route.created_at, route.rowid
    `).all(rootRunId).map((row) => toOrchestratorRoute(orchestratorRouteRowSchema.parse(row)));
  }

  private requireRoute(routeId: string): OrchestratorRoute {
    const route = this.getRoute(routeId);
    if (!route) throw new Error(`Orchestrator Route ${routeId} was not found.`);
    return route;
  }

  private changeStatus(
    orchestrationRequestId: string,
    from: "pending" | "waiting_for_input",
    to: "pending" | "waiting_for_input"
  ): OrchestrationRequest {
    const result = this.connection().prepare(`
      UPDATE orchestration_requests SET status = ?, updated_at = ?
      WHERE orchestration_request_id = ? AND status = ?
    `).run(to, new Date().toISOString(), orchestrationRequestId, from);
    if (result.changes !== 1) {
      throw new Error(`Orchestration Request ${orchestrationRequestId} cannot move from ${from} to ${to}.`);
    }
    return this.require(orchestrationRequestId);
  }
}
