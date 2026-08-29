import type Database from "better-sqlite3";
import type {
  CreateAgentRunInput, ExecutionEventSeed, ExecutionSpecV12, ExecutionTaskSeed, JsonValue, StoredAgentRun
} from "../../../shared/orchestration/index.js";
import { canonicalJson, sha256 } from "../../../shared/orchestration/primitives.js";
import { executionSpecV12Schema } from "../../../shared/orchestration/schemas/executionSchemas.js";
import { roleOutcomeV10Schema } from "../../../shared/orchestration/schemas/outcomeSchemas.js";
import { taskEnvelopeV10Schema } from "../../../shared/orchestration/schemas/taskEnvelopeSchemas.js";
import { toAgentRun } from "./RowMappers.js";
import { ConflictError, NotFoundError } from "./PersistenceErrors.js";

export interface AppliedAgentOutcome {
  agent: StoredAgentRun;
  applied: boolean;
}

export interface StoredExecutionTask {
  taskId: string;
  agentRunId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  providerOutcomeKey?: string;
  spec: ExecutionSpecV12;
}

export class AgentExecutionStore {
  constructor(private readonly connection: () => Database.Database) {}

  createAgent(input: CreateAgentRunInput): StoredAgentRun {
    const envelope = taskEnvelopeV10Schema.parse(input.taskEnvelope);
    if (envelope.environmentRunId !== input.environmentRunId || envelope.role !== input.role || envelope.phase !== input.phase) {
      throw new ConflictError("Agent Run identity differs from its Task Envelope.");
    }
    assertHash(envelope, input.taskEnvelopeHash, "Task Envelope");
    this.connection().prepare(`
      INSERT INTO agent_runs (
        agent_run_id, environment_run_id, action_execution_id, parent_agent_run_id, critic_run_id, refinement_run_id,
        role, phase, status, attempt, task_envelope_version, task_envelope_json, task_envelope_hash,
        input_json, context_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, 10, ?, ?, ?, ?, ?, ?)
    `).run(input.agentRunId, input.environmentRunId, input.actionExecutionId ?? null, input.parentAgentRunId ?? null,
      input.criticRunId ?? null, input.refinementRunId ?? null, input.role, input.phase, input.attempt, canonical(envelope),
      input.taskEnvelopeHash, json(input.input), json(input.context), input.createdAt, input.createdAt);
    return this.requireAgent(input.agentRunId);
  }

  requireAgent(agentRunId: string): StoredAgentRun {
    const row = this.connection().prepare("SELECT * FROM agent_runs WHERE agent_run_id = ?").get(agentRunId);
    if (!row) throw new NotFoundError(`Agent Run ${agentRunId} was not found.`);
    return toAgentRun(row);
  }

  completeAgent(agentRunId: string, providerOutcomeKey: string, outcome: unknown, completedAt: string): AppliedAgentOutcome {
    const existing = this.requireAgent(agentRunId);
    if (["completed", "failed", "cancelled", "interrupted"].includes(existing.status)) {
      if (existing.providerOutcomeKey !== providerOutcomeKey) {
        throw new ConflictError(`Agent Run ${agentRunId} already has a different terminal outcome.`);
      }
      const duplicate = roleOutcomeV10Schema.parse(outcome);
      if (canonical(duplicate) !== canonical(existing.outcome)) {
        throw new ConflictError(`Agent Run ${agentRunId} idempotency key was reused with different content.`);
      }
      return { agent: existing, applied: false };
    }
    const parsed = roleOutcomeV10Schema.parse(outcome);
    if (parsed.role !== existing.role) throw new ConflictError("Agent role differs from provider outcome.");
    if (parsed.role === "validation" && parsed.result.phase !== existing.phase) {
      throw new ConflictError("Validation outcome phase differs from its Agent Run.");
    }
    const updated = this.connection().prepare(`
      UPDATE agent_runs SET status = 'completed', revision = revision + 1, provider_outcome_key = ?,
        outcome_json = ?, evidence_json = ?, completed_at = ?, updated_at = ?
      WHERE agent_run_id = ? AND revision = ? AND status IN ('queued','running')
    `).run(providerOutcomeKey, canonical(parsed), canonical(parsed.checks), completedAt, completedAt,
      agentRunId, existing.revision);
    if (updated.changes !== 1) throw new ConflictError(`Agent Run ${agentRunId} changed while applying its outcome.`);
    return { agent: this.requireAgent(agentRunId), applied: true };
  }

  failAgent(agentRunId: string, providerOutcomeKey: string, errorCode: string, errorMessage: string, at: string): boolean {
    const existing = this.requireAgent(agentRunId);
    if (["completed", "failed", "cancelled", "interrupted"].includes(existing.status)) {
      if (existing.status === "failed" && existing.providerOutcomeKey === providerOutcomeKey) return false;
      throw new ConflictError(`Agent Run ${agentRunId} already has a different terminal outcome.`);
    }
    const updated = this.connection().prepare(`
      UPDATE agent_runs SET status = 'failed', revision = revision + 1, provider_outcome_key = ?,
        error_code = ?, error_message = ?, completed_at = ?, updated_at = ?
      WHERE agent_run_id = ? AND revision = ? AND status IN ('queued','running')
    `).run(providerOutcomeKey, errorCode, errorMessage, at, at, agentRunId, existing.revision);
    return updated.changes === 1;
  }

  createTask(input: ExecutionTaskSeed): void {
    const spec = executionSpecV12Schema.parse(input.spec);
    assertHash(spec, input.specHash, "ExecutionSpec");
    const agent = this.requireAgent(spec.agentRunId);
    if (agent.environmentRunId !== spec.environmentRunId || agent.role !== spec.evidence.role) {
      throw new ConflictError("Execution task differs from its Agent Run.");
    }
    this.connection().transaction(() => {
      this.connection().prepare(`
        INSERT INTO execution_tasks (
          execution_task_id, environment_run_id, agent_run_id, provider, role, kind, status,
          spec_version, spec_json, spec_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'agent_execution', 'queued', 12, ?, ?, ?, ?)
      `).run(spec.taskId, spec.environmentRunId, spec.agentRunId, spec.runtime.provider,
        spec.evidence.role, canonical(spec), input.specHash, spec.createdAt, spec.createdAt);
      const attached = this.connection().prepare(`
        UPDATE agent_runs SET execution_task_id = ?, updated_at = ?
        WHERE agent_run_id = ? AND execution_task_id IS NULL AND status = 'queued'
      `).run(spec.taskId, spec.createdAt, spec.agentRunId);
      if (attached.changes !== 1) throw new ConflictError(`Agent Run ${spec.agentRunId} cannot accept a task.`);
    })();
  }

  requireTask(executionTaskId: string): StoredExecutionTask {
    const row = this.connection().prepare(`
      SELECT execution_task_id, agent_run_id, status, provider_outcome_key, spec_json
      FROM execution_tasks WHERE execution_task_id = ?
    `).get(executionTaskId) as Record<string, unknown> | undefined;
    if (!row) throw new NotFoundError(`Execution task ${executionTaskId} was not found.`);
    return {
      taskId: String(row.execution_task_id), agentRunId: String(row.agent_run_id),
      status: row.status as StoredExecutionTask["status"],
      providerOutcomeKey: row.provider_outcome_key === null ? undefined : String(row.provider_outcome_key),
      spec: executionSpecV12Schema.parse(JSON.parse(String(row.spec_json)))
    };
  }

  pendingTasks(): StoredExecutionTask[] {
    const rows = this.connection().prepare(`
      SELECT execution_task_id FROM execution_tasks WHERE status = 'queued' ORDER BY created_at, execution_task_id
    `).all() as Array<{ execution_task_id: string }>;
    return rows.map(({ execution_task_id }) => this.requireTask(execution_task_id));
  }

  appendEvent(executionTaskId: string, event: ExecutionEventSeed): void {
    this.connection().transaction(() => {
      const updated = this.connection().prepare(`
        UPDATE execution_tasks SET last_sequence = ?, updated_at = ?
        WHERE execution_task_id = ? AND last_sequence < ?
      `).run(event.sequence, event.createdAt, executionTaskId, event.sequence);
      if (updated.changes !== 1) throw new ConflictError("Execution event sequence is stale or duplicated.");
      this.connection().prepare(`
        INSERT INTO execution_events (
          execution_task_id, sequence, source, kind, level, phase, message, data_json, terminal, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(executionTaskId, event.sequence, event.source, event.kind, event.level, event.phase,
        event.message, json(event.data), event.terminal ? 1 : 0, event.createdAt);
    })();
  }

  claimTask(executionTaskId: string, at: string): boolean {
    return this.connection().prepare(`
      UPDATE execution_tasks SET status = 'running', started_at = ?, updated_at = ?
      WHERE execution_task_id = ? AND status = 'queued'
    `).run(at, at, executionTaskId).changes === 1;
  }

  finishTask(
    executionTaskId: string,
    providerOutcomeKey: string,
    status: "succeeded" | "failed" | "cancelled",
    detail: { outcome?: unknown; errorCode?: string; errorMessage?: string },
    at: string
  ): boolean {
    const row = this.connection().prepare(`
      SELECT role, status, provider_outcome_key FROM execution_tasks WHERE execution_task_id = ?
    `).get(executionTaskId) as Record<string, unknown> | undefined;
    if (!row) throw new NotFoundError(`Execution task ${executionTaskId} was not found.`);
    if (["succeeded", "failed", "cancelled"].includes(String(row.status))) {
      if (row.provider_outcome_key === providerOutcomeKey && row.status === status) return false;
      throw new ConflictError(`Execution task ${executionTaskId} already has a different terminal outcome.`);
    }
    let outcomeJson: string | null = null;
    if (status === "succeeded") {
      const outcome = roleOutcomeV10Schema.parse(detail.outcome);
      if (outcome.role !== row.role) throw new ConflictError("Execution task role differs from its outcome.");
      outcomeJson = canonical(outcome);
    }
    const updated = this.connection().prepare(`
      UPDATE execution_tasks SET status = ?, provider_outcome_key = ?, outcome_json = ?,
        error_code = ?, error_message = ?, completed_at = ?, updated_at = ?
      WHERE execution_task_id = ? AND status IN ('queued','running')
    `).run(status, providerOutcomeKey, outcomeJson, detail.errorCode ?? null, detail.errorMessage ?? null,
      at, at, executionTaskId);
    if (updated.changes !== 1) throw new ConflictError(`Execution task ${executionTaskId} changed during completion.`);
    return true;
  }

  cancelAgent(agentRunId: string, status: "cancelled" | "interrupted", at: string): void {
    this.connection().prepare(`
      UPDATE agent_runs SET status = ?, revision = revision + 1, completed_at = ?, updated_at = ?
      WHERE agent_run_id = ? AND status IN ('queued','running')
    `).run(status, at, at, agentRunId);
    this.connection().prepare(`
      UPDATE execution_tasks SET status = 'cancelled', completed_at = ?, updated_at = ?
      WHERE agent_run_id = ? AND status IN ('queued','running')
    `).run(at, at, agentRunId);
  }
}

const canonical = (value: unknown): string => canonicalJson(JSON.parse(JSON.stringify(value)) as JsonValue);
const json = (value: JsonValue | undefined): string | null => value === undefined ? null : canonical(value);
const assertHash = (value: unknown, expected: string, label: string): void => {
  if (sha256(canonical(value)) !== expected) throw new ConflictError(`${label} hash does not match.`);
};
