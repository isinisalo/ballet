import type { ProjectLoop } from "../../shared/domain/automation.js";
import type { LoopTheme } from "../../shared/domain/loopThemes.js";
import type {
  AgentOutcome,
  ExecutionRuntimeSnapshot,
  LoopExecutionPlan,
  LoopRun,
  LoopRunTermination,
  StepRun
} from "../../shared/domain/runtime.js";
import { migrateLegacyBinaryV8 } from "../../shared/domain/automationMigration.js";
import type {
  LoopRunRow,
  StepRunRow
} from "./RuntimeDbTypes.js";

interface StoredLoopRunSnapshot {
  loop: ProjectLoop;
  theme: LoopTheme;
}

export const toLoopRun = (row: LoopRunRow): LoopRun => {
  const snapshot = JSON.parse(row.snapshot_json) as StoredLoopRunSnapshot;
  const migrated = migrateLegacyBinaryV8({ version: 8, loops: [snapshot.loop] }) as { loops: ProjectLoop[] };
  return {
    runId: row.run_id,
    loopId: row.loop_id,
    rootRunId: row.root_run_id,
    parentRunId: row.parent_run_id ?? undefined,
    parentStepRunId: row.parent_step_run_id ?? undefined,
    source: row.source,
    status: row.status,
    executionPlan: row.execution_plan_json ? JSON.parse(row.execution_plan_json) as LoopExecutionPlan : undefined,
    schedule: row.schedule_step_id && row.scheduled_for
      ? { stepId: row.schedule_step_id, scheduledFor: row.scheduled_for }
      : undefined,
    input: row.input ?? undefined,
    snapshot: migrated.loops[0] ?? snapshot.loop,
    themeSnapshot: snapshot.theme,
    transitionCount: row.transition_count,
    termination: row.termination_json ? JSON.parse(row.termination_json) as LoopRunTermination : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined
  };
};

export const toStepRun = (row: StepRunRow): StepRun => {
  const outcome = row.outcome_json
    ? JSON.parse(row.outcome_json) as AgentOutcome
    : row.step_type === "agent" && row.result === "rejected"
      ? {
        outcome: "failed" as const,
        summary: row.error ?? "Legacy agent execution failed without a structured outcome.",
        checks: [],
        failure: { classification: "permanent" as const, code: "execution_failed" }
      }
      : undefined;
  const result = row.step_type === "human"
    ? row.result === "approved"
      ? { kind: "human" as const, decision: "approved" as const }
      : row.result === "rejected"
        ? { kind: "human" as const, decision: "rejected" as const }
      : undefined
    : outcome
      ? { kind: "agent" as const, outcome: outcome.outcome }
      : row.result
        ? { kind: "agent" as const, outcome: row.result as AgentOutcome["outcome"] }
        : undefined;
  return {
    stepRunId: row.step_run_id,
    runId: row.run_id,
    loopId: row.loop_id,
    stepId: row.step_id,
    type: row.step_type,
    agentId: row.agent_id ?? undefined,
    executionTaskId: row.execution_task_id ?? undefined,
    execution: row.execution_snapshot_json ? JSON.parse(row.execution_snapshot_json) as ExecutionRuntimeSnapshot : undefined,
    status: row.status,
    input: row.input ?? undefined,
    responseInput: row.response_input ?? undefined,
    result,
    transition: row.transition_json ? JSON.parse(row.transition_json) as StepRun["transition"] : undefined,
    outcome,
    error: row.error ?? undefined,
    attempt: row.attempt,
    retryOfStepRunId: row.retry_of_step_run_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined
  };
};
