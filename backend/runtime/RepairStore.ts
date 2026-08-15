import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { JsonValue } from "../../shared/domain/automation.js";
import type {
  OrchestrationFrame, OrchestratorRoute, RepairRequest
} from "../../shared/domain/runtime.js";
import {
  orchestrationFrameRowSchema, orchestratorRouteRowSchema, repairRequestRowSchema
} from "./RuntimeDbTypes.js";
import {
  toOrchestrationFrame, toOrchestratorRoute, toRepairRequest
} from "./RuntimeRowMappers.js";
import { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import { canonicalJson, assertJsonValue } from "./state/CanonicalJson.js";

export type CreateRepairRequestInput = Omit<
  RepairRequest,
  "repairRequestId" | "status" | "createdAt" | "updatedAt" | "completedAt" | "routedLoopEdgeId" | "routedTargetLoopId"
> & { repairRequestId?: string; createdAt?: string };

export type CreateOrchestrationFrameInput = Omit<
  OrchestrationFrame,
  "frameId" | "status" | "createdAt" | "updatedAt" | "completedAt"
> & { frameId?: string; createdAt?: string };

export class RepairStore {
  private readonly snapshots: RootExecutionSnapshotStore;

  constructor(private readonly connection: () => Database.Database) {
    this.snapshots = new RootExecutionSnapshotStore(connection);
  }

  createRequest(input: CreateRepairRequestInput): RepairRequest {
    const id = input.repairRequestId ?? randomUUID();
    const timestamp = input.createdAt ?? new Date().toISOString();
    if (!input.reason.trim()) throw new Error("Repair Request reason must be non-empty.");
    const snapshot = this.snapshots.require(input.rootRunId);
    if (input.nestingDepth > snapshot.orchestrator.maxRepairDepth) {
      throw new Error(`Repair Request nesting depth ${input.nestingDepth} exceeds limit ${snapshot.orchestrator.maxRepairDepth}.`);
    }
    this.connection().prepare(`
      INSERT INTO repair_requests (
        repair_request_id, root_run_id, requester_loop_run_id, requester_work_loop_node_run_id,
        requester_validation_node_run_id, requested_capability, requested_outcome_json, reason,
        evidence_json, state_revision_at_request, status, return_loop_id, return_work_loop_node_id,
        return_validation_node_definition_id, nesting_depth, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
    `).run(id, input.rootRunId, input.requesterLoopRunId, input.requesterWorkLoopNodeRunId,
      input.requesterValidationNodeRunId, input.requestedCapability ?? null,
      jsonOrNull(input.requestedOutcome, "Repair Request requested outcome"), input.reason,
      jsonOrNull(input.evidence, "Repair Request evidence"), input.stateRevisionAtRequest,
      input.returnLoopId, input.returnWorkLoopNodeId, input.returnValidationNodeDefinitionId,
      input.nestingDepth, timestamp, timestamp);
    return this.requireRequest(id);
  }

  getRequest(repairRequestId: string): RepairRequest | undefined {
    const value = this.connection().prepare(`
      SELECT * FROM repair_requests WHERE repair_request_id = ?
    `).get(repairRequestId);
    return value ? toRepairRequest(repairRequestRowSchema.parse(value)) : undefined;
  }

  requireRequest(repairRequestId: string): RepairRequest {
    const request = this.getRequest(repairRequestId);
    if (!request) throw new Error(`Repair Request ${repairRequestId} was not found.`);
    return request;
  }

  pending(rootRunId: string): RepairRequest[] {
    return this.connection().prepare(`
      SELECT * FROM repair_requests WHERE root_run_id = ? AND status IN ('pending','routed')
      ORDER BY created_at, rowid
    `).all(rootRunId).map((row) => toRepairRequest(repairRequestRowSchema.parse(row)));
  }

  getRoute(routeId: string): OrchestratorRoute | undefined {
    const value = this.connection().prepare("SELECT * FROM orchestrator_routes WHERE route_id = ?").get(routeId);
    return value ? toOrchestratorRoute(orchestratorRouteRowSchema.parse(value)) : undefined;
  }

  routeForRequest(repairRequestId: string): OrchestratorRoute | undefined {
    const value = this.connection().prepare(`
      SELECT * FROM orchestrator_routes WHERE repair_request_id = ?
    `).get(repairRequestId);
    return value ? toOrchestratorRoute(orchestratorRouteRowSchema.parse(value)) : undefined;
  }

  routeRequest(input: {
    repairRequestId: string;
    loopEdgeId: string;
    sourceLoopId: string;
    targetLoopId: string;
    orchestratorNodeRunId: string;
    evidence?: JsonValue;
    routeId?: string;
    routedAt?: string;
  }): RepairRequest {
    const timestamp = input.routedAt ?? new Date().toISOString();
    const routeId = input.routeId ?? randomUUID();
    this.connection().transaction(() => {
      const request = this.requireRequest(input.repairRequestId);
      const snapshot = this.snapshots.require(request.rootRunId);
      const edge = snapshot.loopEdges.find((candidate) => candidate.id === input.loopEdgeId);
      if (!edge || edge.kind !== "repair" || edge.source !== input.sourceLoopId || edge.target !== input.targetLoopId) {
        throw new Error(`Loop Edge ${input.loopEdgeId} is not an allowed repair route from ${input.sourceLoopId} to ${input.targetLoopId}.`);
      }
      const orchestrator = this.connection().prepare(`
        SELECT role, root_run_id FROM node_runs WHERE node_run_id = ?
      `).get(input.orchestratorNodeRunId);
      if (readString(orchestrator, "role") !== "orchestrator"
        || readString(orchestrator, "root_run_id") !== request.rootRunId) {
        throw new Error(`Node Run ${input.orchestratorNodeRunId} is not the Root Run orchestrator.`);
      }
      const result = this.connection().prepare(`
        UPDATE repair_requests SET status = 'routed', routed_loop_edge_id = ?, routed_target_loop_id = ?, updated_at = ?
        WHERE repair_request_id = ? AND status = 'pending'
      `).run(input.loopEdgeId, input.targetLoopId, timestamp, input.repairRequestId);
      if (result.changes !== 1) throw new Error(`Repair Request ${input.repairRequestId} is not pending.`);
      this.connection().prepare(`
        INSERT INTO orchestrator_routes (
          route_id, root_run_id, repair_request_id, orchestrator_node_run_id, loop_edge_id,
          source_loop_id, target_loop_id, route_evidence_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(routeId, request.rootRunId, input.repairRequestId,
        input.orchestratorNodeRunId, input.loopEdgeId, input.sourceLoopId, input.targetLoopId,
        jsonOrNull(input.evidence, "Orchestrator route evidence"), timestamp);
    })();
    return this.requireRequest(input.repairRequestId);
  }

  createFrame(input: CreateOrchestrationFrameInput): OrchestrationFrame {
    const id = input.frameId ?? randomUUID();
    const timestamp = input.createdAt ?? new Date().toISOString();
    const request = this.requireRequest(input.repairRequestId);
    if (request.status !== "routed" || request.rootRunId !== input.rootRunId) {
      throw new Error(`Repair Request ${input.repairRequestId} is not routed for Root Run ${input.rootRunId}.`);
    }
    if (request.nestingDepth !== input.nestingDepth) {
      throw new Error(`Orchestration Frame depth does not match Repair Request ${input.repairRequestId}.`);
    }
    this.connection().prepare(`
      INSERT INTO orchestration_frames (
        frame_id, root_run_id, repair_request_id, caller_loop_run_id, callee_loop_run_id,
        parent_frame_id, return_loop_id, return_work_loop_node_id,
        return_validation_node_definition_id, state_revision_at_call, nesting_depth,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(id, input.rootRunId, input.repairRequestId, input.callerLoopRunId,
      input.calleeLoopRunId, input.parentFrameId ?? null, input.returnLoopId,
      input.returnWorkLoopNodeId, input.returnValidationNodeDefinitionId,
      input.stateRevisionAtCall, input.nestingDepth, timestamp, timestamp);
    return this.requireFrame(id);
  }

  getFrame(frameId: string): OrchestrationFrame | undefined {
    const value = this.connection().prepare(`
      SELECT * FROM orchestration_frames WHERE frame_id = ?
    `).get(frameId);
    return value ? toOrchestrationFrame(orchestrationFrameRowSchema.parse(value)) : undefined;
  }

  requireFrame(frameId: string): OrchestrationFrame {
    const frame = this.getFrame(frameId);
    if (!frame) throw new Error(`Orchestration Frame ${frameId} was not found.`);
    return frame;
  }

  openFrames(rootRunId: string): OrchestrationFrame[] {
    return this.connection().prepare(`
      SELECT * FROM orchestration_frames WHERE root_run_id = ? AND status = 'open'
      ORDER BY nesting_depth, created_at, rowid
    `).all(rootRunId).map((row) => toOrchestrationFrame(orchestrationFrameRowSchema.parse(row)));
  }
}

const jsonOrNull = (value: JsonValue | undefined, label: string): string | null => {
  if (value === undefined) return null;
  assertJsonValue(value, { label });
  return canonicalJson(value);
};
const readString = (value: unknown, key: string): string => {
  if (typeof value === "object" && value !== null && key in value) {
    const field = Reflect.get(value, key);
    if (typeof field === "string") return field;
  }
  throw new Error(`Runtime database returned an invalid ${key} value.`);
};
