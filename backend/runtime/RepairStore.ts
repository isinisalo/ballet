import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { JsonValue } from "../../shared/domain/automation.js";
import type {
  OrchestrationFrame, RepairRequest
} from "../../shared/domain/runtime.js";
import {
  orchestrationFrameRowSchema, repairRequestRowSchema
} from "./RuntimeDbTypes.js";
import {
  toOrchestrationFrame, toRepairRequest
} from "./RuntimeRowMappers.js";
import { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import { assertOrchestrationFrameInput } from "./OrchestrationFrameValidation.js";
import { canonicalJson, assertJsonValue } from "./state/CanonicalJson.js";

export type CreateRepairRequestInput = Omit<
  RepairRequest,
  "repairRequestId" | "status" | "createdAt" | "updatedAt" | "completedAt"
  | "orchestratorNodeRunId" | "routedLoopEdgeId" | "routedTargetLoopId"
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
    if (!input.validationSummary.trim()) throw new Error("Repair Request Validation summary must be non-empty.");
    if ((input.requestedCapability === undefined) === (input.requestedOutcome === undefined)) {
      throw new Error("Repair Request requires exactly one requested capability or requested outcome.");
    }
    const snapshot = this.snapshots.require(input.rootRunId);
    if (input.nestingDepth > snapshot.orchestrator.maxRepairDepth) {
      throw new Error(`Repair Request nesting depth ${input.nestingDepth} exceeds limit ${snapshot.orchestrator.maxRepairDepth}.`);
    }
    this.connection().prepare(`
      INSERT INTO repair_requests (
        repair_request_id, root_run_id, requester_loop_run_id, requester_work_loop_node_run_id,
        requester_validation_node_run_id, mode, attempt, validation_summary, requested_capability,
        requested_outcome_json, reason, evidence_json, state_revision_at_request, status,
        return_loop_id, return_work_loop_node_id, return_validation_node_definition_id,
        nesting_depth, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
    `).run(id, input.rootRunId, input.requesterLoopRunId, input.requesterWorkLoopNodeRunId,
      input.requesterValidationNodeRunId, input.mode, input.attempt, input.validationSummary,
      input.requestedCapability ?? null,
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

  listRequests(rootRunId: string): RepairRequest[] {
    return this.connection().prepare(`
      SELECT * FROM repair_requests WHERE root_run_id = ? ORDER BY created_at, rowid
    `).all(rootRunId).map((row) => toRepairRequest(repairRequestRowSchema.parse(row)));
  }

  listFrames(rootRunId: string): OrchestrationFrame[] {
    return this.connection().prepare(`
      SELECT * FROM orchestration_frames WHERE root_run_id = ? ORDER BY created_at, rowid
    `).all(rootRunId).map((row) => toOrchestrationFrame(orchestrationFrameRowSchema.parse(row)));
  }

  finishRequest(
    repairRequestId: string,
    status: "repaired" | "failed" | "cancelled",
    completedAt = new Date().toISOString()
  ): RepairRequest {
    const result = this.connection().prepare(`
      UPDATE repair_requests SET status = ?, completed_at = ?, updated_at = ?
      WHERE repair_request_id = ? AND status IN ('pending','routed')
    `).run(status, completedAt, completedAt, repairRequestId);
    if (result.changes !== 1) {
      throw new Error(`Repair Request ${repairRequestId} is not pending or routed.`);
    }
    return this.requireRequest(repairRequestId);
  }

  bindOrchestrator(repairRequestId: string, nodeRunId: string): RepairRequest {
    const result = this.connection().prepare(`
      UPDATE repair_requests SET orchestrator_node_run_id = ?, updated_at = ?
      WHERE repair_request_id = ? AND mode = 'orchestrator' AND status = 'pending'
        AND orchestrator_node_run_id IS NULL
    `).run(nodeRunId, new Date().toISOString(), repairRequestId);
    if (result.changes !== 1) throw new Error(`Repair Request ${repairRequestId} cannot bind Orchestrator ${nodeRunId}.`);
    return this.requireRequest(repairRequestId);
  }

  requestForOrchestrator(nodeRunId: string): RepairRequest | undefined {
    const value = this.connection().prepare(`
      SELECT * FROM repair_requests WHERE orchestrator_node_run_id = ?
    `).get(nodeRunId);
    return value ? toRepairRequest(repairRequestRowSchema.parse(value)) : undefined;
  }

  markRouted(repairRequestId: string, loopEdgeId: string, targetLoopId: string): RepairRequest {
    const result = this.connection().prepare(`
      UPDATE repair_requests SET status = 'routed', routed_loop_edge_id = ?,
        routed_target_loop_id = ?, updated_at = ?
      WHERE repair_request_id = ? AND mode = 'orchestrator' AND status = 'pending'
    `).run(loopEdgeId, targetLoopId, new Date().toISOString(), repairRequestId);
    if (result.changes !== 1) throw new Error(`Repair Request ${repairRequestId} is not pending.`);
    return this.requireRequest(repairRequestId);
  }

  orchestratorAttemptCount(workLoopNodeRunId: string): number {
    const value = this.connection().prepare(`
      SELECT COUNT(*) AS count FROM repair_requests
      WHERE requester_work_loop_node_run_id = ? AND mode = 'orchestrator'
    `).get(workLoopNodeRunId);
    if (typeof value === "object" && value !== null && "count" in value
      && typeof value.count === "number" && Number.isSafeInteger(value.count)) return value.count;
    throw new Error(`Repair Request count for Work Loop Node Run ${workLoopNodeRunId} is invalid.`);
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
    assertOrchestrationFrameInput(this.connection(), request, input, id);
    this.connection().prepare(`
      INSERT INTO orchestration_frames (
        frame_id, root_run_id, repair_request_id, route_id, caller_loop_run_id, callee_loop_run_id,
        parent_frame_id, return_loop_id, return_work_loop_node_id,
        return_validation_node_definition_id, state_revision_at_call, nesting_depth,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(id, input.rootRunId, input.repairRequestId, input.routeId, input.callerLoopRunId,
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

  openFrameForCallee(loopRunId: string): OrchestrationFrame | undefined {
    const value = this.connection().prepare(`
      SELECT * FROM orchestration_frames WHERE callee_loop_run_id = ? AND status = 'open'
    `).get(loopRunId);
    return value ? toOrchestrationFrame(orchestrationFrameRowSchema.parse(value)) : undefined;
  }

  closeFrame(
    frameId: string,
    status: "returned" | "failed" | "cancelled",
    completedAt = new Date().toISOString()
  ): OrchestrationFrame {
    const frame = this.requireFrame(frameId);
    const top = this.openFrames(frame.rootRunId).at(-1);
    if (top?.frameId !== frameId) throw new Error(`Orchestration Frame ${frameId} is not the LIFO continuation.`);
    const result = this.connection().prepare(`
      UPDATE orchestration_frames SET status = ?, completed_at = ?, updated_at = ?
      WHERE frame_id = ? AND status = 'open'
    `).run(status, completedAt, completedAt, frameId);
    if (result.changes !== 1) throw new Error(`Orchestration Frame ${frameId} is not open.`);
    return this.requireFrame(frameId);
  }

}

const jsonOrNull = (value: JsonValue | undefined, label: string): string | null => {
  if (value === undefined) return null;
  assertJsonValue(value, { label });
  return canonicalJson(value);
};
