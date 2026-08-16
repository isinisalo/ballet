import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { CanonicalNodeOutcome, RepairResult, RepairResultStatus } from "../../shared/domain/runtime.js";
import { repairResultRowSchema } from "./RuntimeDbTypes.js";
import { toRepairResult } from "./RuntimeRowMappers.js";
import { assertJsonValue, canonicalJson } from "./state/CanonicalJson.js";

export interface CreateRepairResultInput {
  repairResultId?: string;
  rootRunId: string;
  repairRequestId: string;
  orchestrationFrameId: string;
  targetLoopRunId: string;
  targetLoopId: string;
  status: RepairResultStatus;
  stateRevision: number;
  outcome?: CanonicalNodeOutcome;
  summary: string;
  createdAt?: string;
}

export class RepairResultStore {
  constructor(private readonly connection: () => Database.Database) {}

  create(input: CreateRepairResultInput): RepairResult {
    if (!input.summary.trim()) throw new Error("Repair Result summary must be non-empty.");
    const id = input.repairResultId ?? randomUUID();
    const outcome: unknown = input.outcome;
    if (outcome !== undefined) assertJsonValue(outcome, { label: `Repair Result ${id} outcome` });
    this.connection().prepare(`
      INSERT INTO repair_results (
        repair_result_id, root_run_id, repair_request_id, orchestration_frame_id,
        target_loop_run_id, target_loop_id, status, state_revision, outcome_json, summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.rootRunId, input.repairRequestId, input.orchestrationFrameId,
      input.targetLoopRunId, input.targetLoopId, input.status, input.stateRevision,
      outcome === undefined ? null : canonicalJson(outcome), input.summary,
      input.createdAt ?? new Date().toISOString());
    return this.require(id);
  }

  get(repairResultId: string): RepairResult | undefined {
    const value = this.connection().prepare(`
      SELECT * FROM repair_results WHERE repair_result_id = ?
    `).get(repairResultId);
    return value ? toRepairResult(repairResultRowSchema.parse(value)) : undefined;
  }

  forRequest(repairRequestId: string): RepairResult | undefined {
    const value = this.connection().prepare(`
      SELECT * FROM repair_results WHERE repair_request_id = ?
    `).get(repairRequestId);
    return value ? toRepairResult(repairResultRowSchema.parse(value)) : undefined;
  }

  list(rootRunId: string): RepairResult[] {
    return this.connection().prepare(`
      SELECT * FROM repair_results WHERE root_run_id = ? ORDER BY created_at, rowid
    `).all(rootRunId).map((row) => toRepairResult(repairResultRowSchema.parse(row)));
  }

  private require(repairResultId: string): RepairResult {
    const result = this.get(repairResultId);
    if (!result) throw new Error(`Repair Result ${repairResultId} was not found.`);
    return result;
  }
}
