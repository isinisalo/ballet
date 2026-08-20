import type Database from "better-sqlite3";
import type { ControlFlowEventKind } from "../../shared/domain/runtime.js";
import { maxControlFlowTransitions } from "../../shared/domain/runtime.js";

export interface AppendControlFlowInput {
  rootRunId: string;
  kind: ControlFlowEventKind;
  stateRevision: number;
  sourceLoopRunId?: string;
  sourceJobRunId?: string;
  sourceNodeRunId?: string;
  targetLoopRunId?: string;
  targetJobRunId?: string;
  orchestrationRequestId?: string;
  repairRequestId?: string;
  orchestrationFrameId?: string;
  createdAt?: string;
}

export class ControlFlowTransitionStore {
  constructor(private readonly connection: () => Database.Database) {}

  append(input: AppendControlFlowInput): number {
    const current = this.connection().prepare(`
      SELECT transition_count FROM root_runs WHERE root_run_id = ?
    `).get(input.rootRunId);
    const sequence = readTransitionCount(current, input.rootRunId) + 1;
    if (sequence > maxControlFlowTransitions) {
      throw new Error(
        `Root Run ${input.rootRunId} exceeded the control-flow transition limit ${maxControlFlowTransitions}.`
      );
    }
    const timestamp = input.createdAt ?? new Date().toISOString();
    const result = this.connection().prepare(`
      INSERT INTO control_flow_events (
        root_run_id, sequence, kind, state_revision, source_loop_run_id,
        source_job_run_id, source_node_run_id, target_loop_run_id,
        target_job_run_id, orchestration_request_id, repair_request_id,
        orchestration_frame_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.rootRunId, sequence, input.kind, input.stateRevision,
      input.sourceLoopRunId ?? null, input.sourceJobRunId ?? null,
      input.sourceNodeRunId ?? null, input.targetLoopRunId ?? null,
      input.targetJobRunId ?? null, input.orchestrationRequestId ?? null,
      input.repairRequestId ?? null,
      input.orchestrationFrameId ?? null, timestamp);
    this.connection().prepare(`
      UPDATE root_runs SET transition_count = ?, updated_at = ? WHERE root_run_id = ?
    `).run(sequence, timestamp, input.rootRunId);
    return Number(result.lastInsertRowid);
  }
}

const readTransitionCount = (value: unknown, rootRunId: string): number => {
  if (typeof value === "object" && value !== null && "transition_count" in value
    && typeof value.transition_count === "number" && Number.isSafeInteger(value.transition_count)) {
    return value.transition_count;
  }
  throw new Error(`Root Run ${rootRunId} has invalid transition storage.`);
};
