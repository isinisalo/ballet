import type { ProjectLoop } from "../../shared/domain/automation.js";
import type { LoopTheme } from "../../shared/domain/loopThemes.js";
import type {
  ExecutionRuntimeSnapshot,
  LoopRun,
  StepOutcome,
  StepRun,
  StepRunResult
} from "../../shared/domain/runtime.js";
import { LoopRunIntegrityError } from "./LoopRunErrors.js";
import type {
  LoopRunRow,
  StepRunRow
} from "./RuntimeDbTypes.js";

export const toLoopRun = (row: LoopRunRow, loop: ProjectLoop, theme: LoopTheme): LoopRun => {
  return {
    runId: row.run_id,
    loopId: row.loop_id,
    rootRunId: row.root_run_id,
    parentRunId: row.parent_run_id ?? undefined,
    parentStepRunId: row.parent_step_run_id ?? undefined,
    source: row.source,
    status: row.status,
    schedule: row.schedule_step_id && row.scheduled_for
      ? { stepId: row.schedule_step_id, scheduledFor: row.scheduled_for }
      : undefined,
    input: row.input ?? undefined,
    snapshot: loop,
    themeSnapshot: theme,
    transitionCount: row.transition_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined
  };
};

export const toStepRun = (row: StepRunRow): StepRun => {
  assertStepResultIntegrity(row.status, row.result, row.step_run_id);
  return {
    stepRunId: row.step_run_id,
    runId: row.run_id,
    loopId: row.loop_id,
    stepId: row.step_id,
    type: row.step_type,
    executionTaskId: row.execution_task_id ?? undefined,
    execution: row.execution_snapshot_json ? JSON.parse(row.execution_snapshot_json) as ExecutionRuntimeSnapshot : undefined,
    status: row.status,
    input: row.input ?? undefined,
    responseInput: row.response_input ?? undefined,
    result: row.result ?? undefined,
    outcome: row.outcome_json ? JSON.parse(row.outcome_json) as StepOutcome : undefined,
    error: row.error ?? undefined,
    attempt: row.attempt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined
  };
};

const assertStepResultIntegrity = (
  status: StepRun["status"],
  result: StepRunResult | null,
  stepRunId: string
): void => {
  const validResult = result === "approved" || result === "rejected";
  if ((status === "completed") !== validResult) {
    throw new LoopRunIntegrityError(
      `Step Run ${stepRunId} has invalid persisted status/result combination: ${status}/${result ?? "null"}.`
    );
  }
};
