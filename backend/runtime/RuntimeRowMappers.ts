import type { ProjectLoop } from "../../shared/domain/automation.js";
import type { LoopTheme } from "../../shared/domain/loopThemes.js";
import type {
  AgentOutcome,
  ExecutionRuntimeSnapshot,
  LoopExecutionPlan,
  LoopRun,
  StepRun
} from "../../shared/domain/runtime.js";
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
    snapshot: snapshot.loop,
    themeSnapshot: snapshot.theme,
    transitionCount: row.transition_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined
  };
};

export const toStepRun = (row: StepRunRow): StepRun => ({
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
  result: row.result ?? undefined,
  outcome: row.outcome_json ? JSON.parse(row.outcome_json) as AgentOutcome : undefined,
  error: row.error ?? undefined,
  attempt: row.attempt,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined
});
