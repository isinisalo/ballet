import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { ProjectAgentStep, ProjectHumanStep, ProjectLoop } from "../../shared/domain/automation.js";
import type { LoopTheme } from "../../shared/domain/loopThemes.js";
import type {
  AgentOutcome,
  ExecutionRuntimeSnapshot,
  LoopExecutionPlan,
  LoopRun,
  LoopRunDetails,
  LoopRunSource,
  StepRun,
  StepRunResult
} from "../../shared/domain/runtime.js";
import { stringifyJson } from "./RuntimeJson.js";
import { toLoopRun, toStepRun } from "./RuntimeRowMappers.js";
import type {
  LoopRunRow,
  StepRunRow
} from "./RuntimeDbTypes.js";
import { now } from "./RuntimeDbTypes.js";

export interface CreateLoopRunInput {
  runId?: string;
  loop: ProjectLoop;
  themeSnapshot: LoopTheme;
  rootRunId?: string;
  parentRunId?: string;
  parentStepRunId?: string;
  source: LoopRunSource;
  input?: string;
  executionPlan?: LoopExecutionPlan;
  schedule?: { stepId: string; scheduledFor: string };
}

export class LoopRunStore {
  constructor(private readonly connection: () => Database.Database) {}

  getLoopRun(runId: string): LoopRun | undefined {
    const row = this.connection().prepare("SELECT * FROM loop_runs WHERE run_id = ?").get(runId) as LoopRunRow | undefined;
    return row ? toLoopRun(row) : undefined;
  }

  getStepRun(stepRunId: string): StepRun | undefined {
    const row = this.connection().prepare("SELECT * FROM step_runs WHERE step_run_id = ?").get(stepRunId) as StepRunRow | undefined;
    return row ? toStepRun(row) : undefined;
  }

  details(runId: string): LoopRunDetails | undefined {
    const run = this.getLoopRun(runId);
    if (!run) return undefined;
    const rootCount = this.connection().prepare(`
      SELECT COALESCE(SUM(transition_count), 0) AS count FROM loop_runs WHERE root_run_id = ?
    `).get(run.rootRunId) as { count: number };
    const rows = this.connection().prepare(`
      SELECT * FROM step_runs WHERE run_id = ? ORDER BY created_at ASC, rowid ASC
    `).all(runId) as StepRunRow[];
    return { ...run, transitionCount: rootCount.count, stepRuns: rows.map(toStepRun) };
  }

  list(limit = 500): LoopRunDetails[] {
    const rows = this.connection().prepare(`
      SELECT run_id FROM loop_runs ORDER BY created_at DESC, rowid DESC LIMIT ?
    `).all(limit) as Array<{ run_id: string }>;
    return rows.flatMap((row) => {
      const details = this.details(row.run_id);
      return details ? [details] : [];
    });
  }

  listByRoot(rootRunId: string): LoopRunDetails[] {
    const rows = this.connection().prepare(`
      SELECT run_id FROM loop_runs WHERE root_run_id = ? ORDER BY created_at ASC, rowid ASC
    `).all(rootRunId) as Array<{ run_id: string }>;
    return rows.flatMap((row) => {
      const details = this.details(row.run_id);
      return details ? [details] : [];
    });
  }

  hasActiveLoop(loopId: string): boolean {
    return Boolean(this.connection().prepare(`
      SELECT 1 FROM loop_runs WHERE loop_id = ? AND status IN ('running', 'waiting_for_human') LIMIT 1
    `).get(loopId));
  }

  activeLoopIds(): string[] {
    const rows = this.connection().prepare(`
      SELECT DISTINCT loop_id FROM loop_runs WHERE status IN ('running', 'waiting_for_human')
    `).all() as Array<{ loop_id: string }>;
    return rows.map((row) => row.loop_id);
  }

  createLoopRun(input: CreateLoopRunInput): LoopRun {
    const runId = input.runId ?? randomUUID();
    const timestamp = now();
    this.connection().prepare(`
      INSERT INTO loop_runs (
        run_id, loop_id, root_run_id, parent_run_id, parent_step_run_id,
        source, status, execution_plan_json, schedule_step_id, scheduled_for,
        input, snapshot_json, transition_count, created_at, updated_at
      ) VALUES (
        @runId, @loopId, @rootRunId, @parentRunId, @parentStepRunId,
        @source, 'running', @executionPlanJson, @scheduleStepId, @scheduledFor,
        @input, @snapshotJson, 0, @createdAt, @updatedAt
      )
    `).run({
      runId,
      loopId: input.loop.id,
      rootRunId: input.rootRunId ?? runId,
      parentRunId: input.parentRunId ?? null,
      parentStepRunId: input.parentStepRunId ?? null,
      source: input.source,
      executionPlanJson: input.executionPlan ? stringifyJson(input.executionPlan) : null,
      scheduleStepId: input.schedule?.stepId ?? null,
      scheduledFor: input.schedule?.scheduledFor ?? null,
      input: input.input ?? null,
      snapshotJson: stringifyJson({ loop: input.loop, theme: input.themeSnapshot }),
      createdAt: timestamp,
      updatedAt: timestamp
    });
    const run = this.getLoopRun(runId);
    if (!run) throw new Error("Loop run was not stored.");
    return run;
  }

  createStepRun(run: LoopRun, step: ProjectAgentStep | ProjectHumanStep, input?: string): StepRun {
    const stepRunId = randomUUID();
    const timestamp = now();
    const status = step.type === "human" ? "waiting_for_human" : "queued";
    this.connection().prepare(`
      INSERT INTO step_runs (
        step_run_id, run_id, loop_id, step_id, step_type, agent_id,
        status, input, attempt, created_at, updated_at
      ) VALUES (
        @stepRunId, @runId, @loopId, @stepId, @stepType, @agentId,
        @status, @input, 0, @createdAt, @updatedAt
      )
    `).run({
      stepRunId,
      runId: run.runId,
      loopId: run.loopId,
      stepId: step.id,
      stepType: step.type,
      agentId: step.type === "agent" ? step.agentId : null,
      status,
      input: input ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    this.connection().prepare(`
      UPDATE loop_runs SET status = @status, updated_at = @updatedAt WHERE run_id = @runId
    `).run({
      runId: run.runId,
      status: step.type === "human" ? "waiting_for_human" : "running",
      updatedAt: timestamp
    });
    const stored = this.getStepRun(stepRunId);
    if (!stored) throw new Error("Step run was not stored.");
    return stored;
  }

  completeStepRun(stepRun: StepRun, result: StepRunResult, options: {
    responseInput?: string;
    outcome?: AgentOutcome;
    error?: string;
    failed?: boolean;
  }): void {
    const timestamp = now();
    this.connection().prepare(`
      UPDATE step_runs SET status = @status, response_input = @responseInput, result = @result,
        outcome_json = @outcomeJson, error = @error,
        completed_at = @completedAt, updated_at = @updatedAt
        WHERE step_run_id = @stepRunId
    `).run({
      stepRunId: stepRun.stepRunId,
      status: options.failed ? "failed" : "completed",
      responseInput: options.responseInput ?? null,
      result,
      outcomeJson: options.outcome ? stringifyJson(options.outcome) : null,
      error: options.error ?? null,
      completedAt: timestamp,
      updatedAt: timestamp
    });
  }

  bindStepExecution(stepRunId: string, taskId: string, snapshot: ExecutionRuntimeSnapshot): StepRun {
    this.connection().prepare(`
      UPDATE step_runs SET execution_task_id = ?, execution_snapshot_json = ?, updated_at = ?
      WHERE step_run_id = ? AND step_type = 'agent' AND execution_task_id IS NULL
    `).run(taskId, stringifyJson(snapshot), now(), stepRunId);
    const stepRun = this.getStepRun(stepRunId);
    if (!stepRun) throw new Error(`Step run ${stepRunId} was not found.`);
    return stepRun;
  }

  markStepRunning(stepRunId: string): StepRun {
    this.connection().prepare(`
      UPDATE step_runs SET status = 'running', attempt = 1, updated_at = ?
      WHERE step_run_id = ? AND status = 'queued'
    `).run(now(), stepRunId);
    const stepRun = this.getStepRun(stepRunId);
    if (!stepRun) throw new Error(`Step run ${stepRunId} was not found.`);
    return stepRun;
  }

  rootTransitionCount(rootRunId: string): number {
    const row = this.connection().prepare(`
      SELECT COALESCE(SUM(transition_count), 0) AS count FROM loop_runs WHERE root_run_id = ?
    `).get(rootRunId) as { count: number };
    return row.count;
  }

  incrementTransitionCount(runId: string): void {
    this.connection().prepare(`
      UPDATE loop_runs SET transition_count = transition_count + 1, updated_at = @updatedAt
      WHERE run_id = @runId
    `).run({ runId, updatedAt: now() });
  }

  updateRunInput(runId: string, input: string): void {
    this.connection().prepare("UPDATE loop_runs SET input = ?, updated_at = ? WHERE run_id = ?")
      .run(input, now(), runId);
  }

  finishRun(runId: string, status: "completed" | "blocked" | "failed" | "cancelled"): void {
    const timestamp = now();
    this.connection().prepare(`
      UPDATE loop_runs SET status = @status, completed_at = @completedAt, updated_at = @updatedAt
      WHERE run_id = @runId
    `).run({ runId, status, completedAt: timestamp, updatedAt: timestamp });
  }
}
