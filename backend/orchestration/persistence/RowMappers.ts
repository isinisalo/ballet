import { z } from "zod";
import type {
  StoredActionExecution, StoredAgentRun, StoredEnvironmentRun, StoredStateExecution
} from "../../../shared/orchestration/persistenceRecords.js";
import { rootSnapshotV19Schema } from "../../../shared/orchestration/schemas/runtimeSchemas.js";

const nullableString = z.string().nullable();

const environmentRowSchema = z.object({
  environment_run_id: z.string(), environment_definition_id: z.string(), source: z.enum(["manual", "continuation"]),
  previous_run_id: nullableString, input_text: nullableString,
  status: z.enum(["pending", "running", "blocked", "completed", "cancelled", "interrupted"]),
  revision: z.number().int(), base_commit: z.string(), result_commit: nullableString, worktree_path: z.string(), branch: z.string(),
  execution_snapshot_json: z.string(), execution_snapshot_hash: z.string(), active_state_execution_id: nullableString,
  active_action_execution_id: nullableString, active_agent_run_id: nullableString, transition_count: z.number().int(),
  transition_limit: z.number().int(), finalization_status: nullableString, finalization_json: nullableString,
  error_code: nullableString, error_message: nullableString, created_at: z.string(), updated_at: z.string(), completed_at: nullableString
}).strict();

const stateRowSchema = z.object({
  state_execution_id: z.string(), environment_run_id: z.string(), state_definition_id: z.string(),
  state_order: z.number().int(), definition_snapshot_json: z.string(), definition_snapshot_hash: z.string(),
  status: z.enum(["pending", "running", "blocked", "done", "cancelled", "interrupted"]),
  revision: z.number().int(), created_at: z.string(), updated_at: z.string(), completed_at: nullableString
}).strict();

const actionRowSchema = z.object({
  action_execution_id: z.string(), state_execution_id: z.string(), environment_run_id: z.string(),
  action_definition_id: z.string(), action_priority: z.number().int(), definition_snapshot_json: z.string(),
  definition_snapshot_hash: z.string(),
  status: z.enum(["pending", "prechecking", "working", "postchecking", "blocked", "done", "cancelled", "interrupted"]),
  revision: z.number().int(), work_attempt: z.number().int(), max_retries: z.number().int(), active_agent_run_id: nullableString,
  originating_run_id: nullableString, prior_action_execution_id: nullableString, imported_done_evidence_json: nullableString,
  created_at: z.string(), updated_at: z.string(), completed_at: nullableString
}).strict();

const agentRowSchema = z.object({
  agent_run_id: z.string(), environment_run_id: z.string(), action_execution_id: nullableString,
  parent_agent_run_id: nullableString,
  critic_run_id: nullableString, refinement_run_id: nullableString,
  role: z.enum(["validation", "work", "critic", "refinement"]), phase: z.enum(["precheck", "work", "postwork", "proposal"]),
  status: z.enum(["queued", "running", "waiting_for_input", "completed", "failed", "cancelled", "interrupted"]),
  revision: z.number().int(), attempt: z.number().int(), task_envelope_version: z.number().int(),
  task_envelope_json: z.string(), task_envelope_hash: z.string(), execution_task_id: nullableString,
  provider_outcome_key: nullableString, input_json: nullableString, context_json: nullableString, outcome_json: nullableString,
  evidence_json: nullableString, error_code: nullableString, error_message: nullableString, created_at: z.string(),
  started_at: nullableString, updated_at: z.string(), completed_at: nullableString
}).strict();

export const toEnvironmentRun = (value: unknown): StoredEnvironmentRun => {
  const row = environmentRowSchema.parse(value);
  return {
    environmentRunId: row.environment_run_id, environmentDefinitionId: row.environment_definition_id,
    source: row.source, previousRunId: optional(row.previous_run_id), input: optional(row.input_text), status: row.status, revision: row.revision,
    baseCommit: row.base_commit, resultCommit: optional(row.result_commit), worktreePath: row.worktree_path,
    branch: row.branch, executionSnapshot: rootSnapshotV19Schema.parse(JSON.parse(row.execution_snapshot_json)),
    executionSnapshotHash: row.execution_snapshot_hash, activeStateExecutionId: optional(row.active_state_execution_id),
    activeActionExecutionId: optional(row.active_action_execution_id), activeAgentRunId: optional(row.active_agent_run_id),
    transitionCount: row.transition_count, transitionLimit: row.transition_limit,
    finalizationStatus: optional(row.finalization_status) as StoredEnvironmentRun["finalizationStatus"],
    createdAt: row.created_at, updatedAt: row.updated_at, completedAt: optional(row.completed_at)
  };
};

export const toStateExecution = (value: unknown): StoredStateExecution => {
  const row = stateRowSchema.parse(value);
  return {
    stateExecutionId: row.state_execution_id, environmentRunId: row.environment_run_id,
    stateDefinitionId: row.state_definition_id, order: row.state_order,
    definitionSnapshot: JSON.parse(row.definition_snapshot_json), definitionSnapshotHash: row.definition_snapshot_hash,
    status: row.status, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at,
    completedAt: optional(row.completed_at)
  };
};

export const toActionExecution = (value: unknown): StoredActionExecution => {
  const row = actionRowSchema.parse(value);
  return {
    actionExecutionId: row.action_execution_id, stateExecutionId: row.state_execution_id,
    environmentRunId: row.environment_run_id, actionDefinitionId: row.action_definition_id,
    priority: row.action_priority, definitionSnapshot: JSON.parse(row.definition_snapshot_json),
    definitionSnapshotHash: row.definition_snapshot_hash, status: row.status, revision: row.revision,
    workAttempt: row.work_attempt, maxRetries: row.max_retries, activeAgentRunId: optional(row.active_agent_run_id),
    createdAt: row.created_at, updatedAt: row.updated_at, completedAt: optional(row.completed_at)
  };
};

export const toAgentRun = (value: unknown): StoredAgentRun => {
  const row = agentRowSchema.parse(value);
  return {
    agentRunId: row.agent_run_id, environmentRunId: row.environment_run_id,
    parentAgentRunId: optional(row.parent_agent_run_id),
    actionExecutionId: optional(row.action_execution_id), criticRunId: optional(row.critic_run_id),
    refinementRunId: optional(row.refinement_run_id), role: row.role, phase: row.phase, status: row.status,
    revision: row.revision, attempt: row.attempt, providerOutcomeKey: optional(row.provider_outcome_key),
    outcome: row.outcome_json ? JSON.parse(row.outcome_json) : undefined,
    createdAt: row.created_at, updatedAt: row.updated_at, completedAt: optional(row.completed_at)
  };
};

const optional = (value: string | null): string | undefined => value ?? undefined;
