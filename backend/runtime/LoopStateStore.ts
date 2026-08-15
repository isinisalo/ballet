import type Database from "better-sqlite3";
import { parseNodeOutcomeForRole } from "../../shared/api/runtime-schemas.js";
import type {
  CanonicalNodeOutcome, ControlFlowEventKind, LoopStateRevision, NodeRunStatus,
  WorkLoopNodeRunStatus
} from "../../shared/domain/runtime.js";
import { nodeRunRowSchema, stateRevisionRowSchema } from "./RuntimeDbTypes.js";
import { toStateRevision } from "./RuntimeRowMappers.js";
import { assertJsonValue, canonicalJson, jsonSha256 } from "./state/CanonicalJson.js";
import { applyStatePatch, statePatchSha256 } from "./state/StatePatch.js";

export interface CommitNodeOutcomeInput {
  rootRunId: string;
  nodeRunId: string;
  baseRevision: number;
  outcome: CanonicalNodeOutcome;
  nodeStatus?: Extract<NodeRunStatus, "completed" | "blocked" | "failed">;
  workLoopNodeStatus?: WorkLoopNodeRunStatus;
  workLoopNodeTerminal?: "completed" | "blocked" | "failed" | "cancelled";
  errorCode?: string;
  errorMessage?: string;
  control: {
    kind: ControlFlowEventKind;
    targetLoopRunId?: string;
    targetWorkLoopNodeRunId?: string;
    repairRequestId?: string;
    orchestrationFrameId?: string;
  };
  committedAt?: string;
}

export interface CommitNodeOutcomeResult {
  revision: LoopStateRevision;
  controlFlowEventId: number;
}

export class LoopStateStore {
  constructor(private readonly connection: () => Database.Database) {}

  current(rootRunId: string): LoopStateRevision {
    const revision = this.currentRevisionNumber(rootRunId);
    return this.require(rootRunId, revision);
  }

  get(rootRunId: string, revision: number): LoopStateRevision | undefined {
    const value = this.connection().prepare(`
      SELECT * FROM state_revisions WHERE root_run_id = ? AND revision = ?
    `).get(rootRunId, revision);
    return value ? this.verify(toStateRevision(stateRevisionRowSchema.parse(value))) : undefined;
  }

  require(rootRunId: string, revision: number): LoopStateRevision {
    const state = this.get(rootRunId, revision);
    if (!state) throw new Error(`Root Run ${rootRunId} state revision ${revision} was not found.`);
    return state;
  }

  list(rootRunId: string): LoopStateRevision[] {
    return this.connection().prepare(`
      SELECT * FROM state_revisions WHERE root_run_id = ? ORDER BY revision
    `).all(rootRunId).map((row) => this.verify(toStateRevision(stateRevisionRowSchema.parse(row))));
  }

  commitNodeOutcome(input: CommitNodeOutcomeInput): CommitNodeOutcomeResult {
    const committedAt = input.committedAt ?? new Date().toISOString();
    const transaction = this.connection().transaction(() => {
      const currentRevision = this.currentRevisionNumber(input.rootRunId);
      if (currentRevision !== input.baseRevision) {
        throw new Error(
          `State patch base revision ${input.baseRevision} is stale; Root Run ${input.rootRunId} is at revision ${currentRevision}.`
        );
      }
      const current = this.require(input.rootRunId, currentRevision);
      const node = this.requireActiveNode(input.nodeRunId, input.rootRunId, input.baseRevision);
      const parsedOutcome = parseNodeOutcomeForRole(node.role, input.outcome);
      const statePatch = "statePatch" in parsedOutcome ? parsedOutcome.statePatch : undefined;
      const outcomeValue: unknown = parsedOutcome;
      assertJsonValue(outcomeValue, { label: `Node Run ${input.nodeRunId} outcome` });
      const outcomeJson = canonicalJson(outcomeValue);
      const applied = statePatch
        ? applyStatePatch(current.state, statePatch)
        : undefined;
      const nextRevision = applied ? currentRevision + 1 : currentRevision;
      if (applied) this.connection().prepare(`
        INSERT INTO state_revisions (
          root_run_id, revision, parent_revision, state_json, state_hash, patch_json,
          patch_hash, source_node_run_id, outcome_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(input.rootRunId, nextRevision, currentRevision, applied.stateJson, applied.stateSha256,
        applied.patchJson, applied.patchSha256, input.nodeRunId, outcomeJson, committedAt);

      const nodeStatus = input.nodeStatus ?? "completed";
      this.connection().prepare(`
        UPDATE node_runs SET status = ?, outcome_json = ?, state_revision_after = ?,
          patch_json = ?, patch_hash = ?, error_code = ?, error_message = ?,
          completed_at = ?, updated_at = ? WHERE node_run_id = ?
      `).run(nodeStatus, outcomeJson, nextRevision, applied?.patchJson ?? null,
        applied?.patchSha256 ?? null, input.errorCode ?? null, input.errorMessage ?? null,
        committedAt, committedAt, input.nodeRunId);

      if (node.work_loop_node_run_id) this.updateWorkLoopNode(
        node.work_loop_node_run_id,
        input,
        nextRevision,
        committedAt
      );
      const sequence = this.nextControlSequence(input.rootRunId);
      this.connection().prepare(`
        UPDATE root_runs SET current_state_revision = ?, transition_count = ?,
          active_node_run_id = NULL, updated_at = ? WHERE root_run_id = ?
      `).run(nextRevision, sequence, committedAt, input.rootRunId);
      const result = this.connection().prepare(`
        INSERT INTO control_flow_events (
          root_run_id, sequence, kind, state_revision, source_loop_run_id,
          source_work_loop_node_run_id, source_node_run_id, target_loop_run_id,
          target_work_loop_node_run_id, repair_request_id, orchestration_frame_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(input.rootRunId, sequence, input.control.kind, nextRevision, node.loop_run_id,
        node.work_loop_node_run_id, input.nodeRunId, input.control.targetLoopRunId ?? null,
        input.control.targetWorkLoopNodeRunId ?? null, input.control.repairRequestId ?? null,
        input.control.orchestrationFrameId ?? null, committedAt);
      const revision = this.require(input.rootRunId, nextRevision);
      return { revision: { ...revision, controlFlowEventId: Number(result.lastInsertRowid) },
        controlFlowEventId: Number(result.lastInsertRowid) };
    });
    return transaction();
  }

  private updateWorkLoopNode(
    workLoopNodeRunId: string,
    input: CommitNodeOutcomeInput,
    revision: number,
    timestamp: string
  ): void {
    const status = input.workLoopNodeStatus ?? "running";
    const terminal = ["completed", "blocked", "failed", "cancelled"].includes(status);
    if (terminal !== Boolean(input.workLoopNodeTerminal)) {
      throw new Error("A terminal Work Loop Node Run status requires the matching terminal value.");
    }
    this.connection().prepare(`
      UPDATE work_loop_node_runs SET status = ?, state_revision_after = ?, active_node_run_id = NULL,
        terminal = ?, error_code = ?, error_message = ?,
        completed_at = CASE WHEN ? THEN ? ELSE NULL END, updated_at = ?
      WHERE work_loop_node_run_id = ?
    `).run(status, revision, input.workLoopNodeTerminal ?? null, input.errorCode ?? null,
      input.errorMessage ?? null, terminal ? 1 : 0, timestamp, timestamp, workLoopNodeRunId);
  }

  private requireActiveNode(nodeRunId: string, rootRunId: string, baseRevision: number) {
    const value = this.connection().prepare("SELECT * FROM node_runs WHERE node_run_id = ?").get(nodeRunId);
    if (!value) throw new Error(`Node Run ${nodeRunId} was not found.`);
    const node = nodeRunRowSchema.parse(value);
    if (node.root_run_id !== rootRunId || node.state_revision_before !== baseRevision) {
      throw new Error(`Node Run ${nodeRunId} does not belong to Root Run ${rootRunId} revision ${baseRevision}.`);
    }
    if (!["queued", "running", "waiting_for_input"].includes(node.status)) {
      throw new Error(`Node Run ${nodeRunId} is not active.`);
    }
    return node;
  }

  private currentRevisionNumber(rootRunId: string): number {
    const value = this.connection().prepare(`
      SELECT current_state_revision FROM root_runs WHERE root_run_id = ?
    `).get(rootRunId);
    if (typeof value === "object" && value !== null && "current_state_revision" in value
      && typeof value.current_state_revision === "number") return value.current_state_revision;
    throw new Error(`Root Run ${rootRunId} was not found.`);
  }

  private nextControlSequence(rootRunId: string): number {
    const value = this.connection().prepare("SELECT transition_count FROM root_runs WHERE root_run_id = ?")
      .get(rootRunId);
    if (typeof value === "object" && value !== null && "transition_count" in value
      && typeof value.transition_count === "number") return value.transition_count + 1;
    throw new Error(`Root Run ${rootRunId} was not found.`);
  }

  private verify(state: LoopStateRevision): LoopStateRevision {
    if (jsonSha256(state.state) !== state.stateSha256) {
      throw new Error(`Root Run ${state.rootRunId} state revision ${state.revision} has invalid hash evidence.`);
    }
    if (state.patch && statePatchSha256(state.patch.patch) !== state.patch.patchSha256) {
      throw new Error(`Root Run ${state.rootRunId} state revision ${state.revision} has invalid patch hash evidence.`);
    }
    return state;
  }
}
