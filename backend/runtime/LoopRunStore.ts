import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { ProjectExecutableStep, ProjectLoop } from "../../shared/domain/automation.js";
import type {
  ExecutionRuntimeSnapshot,
  LoopRun,
  LoopRunDetails,
  LoopRunSource,
  StepOutcome,
  StepRun,
  StepRunResult
} from "../../shared/domain/runtime.js";
import { stringifyJson } from "./RuntimeJson.js";
import { toLoopRun, toStepRun } from "./RuntimeRowMappers.js";
import { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import type {
  LoopRunRow,
  StepRunRow
} from "./RuntimeDbTypes.js";
import { now } from "./RuntimeDbTypes.js";

export interface CreateLoopRunInput {
  runId?: string;
  loop: ProjectLoop;
  rootRunId?: string;
  parentRunId?: string;
  parentStepRunId?: string;
  source: LoopRunSource;
  input?: string;
  schedule?: { stepId: string; scheduledFor: string };
}

export class LoopRunStore {
  private readonly snapshots: RootExecutionSnapshotStore;

  constructor(private readonly connection: () => Database.Database) {
    this.snapshots = new RootExecutionSnapshotStore(connection);
  }

  getLoopRun(runId: string): LoopRun | undefined {
    const row = this.connection().prepare("SELECT * FROM loop_runs WHERE run_id = ?").get(runId) as LoopRunRow | undefined;
    if (!row) return undefined;
    const snapshot = this.snapshots.require(row.root_run_id);
    return toLoopRun(row, this.snapshots.loop(snapshot, row.loop_id), snapshot.theme);
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
        source, status, schedule_step_id, scheduled_for,
        input, transition_count, created_at, updated_at
      ) VALUES (
        @runId, @loopId, @rootRunId, @parentRunId, @parentStepRunId,
        @source, 'running', @scheduleStepId, @scheduledFor,
        @input, 0, @createdAt, @updatedAt
      )
    `).run({
      runId,
      loopId: input.loop.id,
      rootRunId: input.rootRunId ?? runId,
      parentRunId: input.parentRunId ?? null,
      parentStepRunId: input.parentStepRunId ?? null,
      source: input.source,
      scheduleStepId: input.schedule?.stepId ?? null,
      scheduledFor: input.schedule?.scheduledFor ?? null,
      input: input.input ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    const run = this.getLoopRun(runId);
    if (!run) throw new Error("Loop run was not stored.");
    return run;
  }

  createStepRun(run: LoopRun, step: ProjectExecutableStep, input?: string): StepRun {
    const stepRunId = randomUUID();
    const timestamp = now();
    const status = step.type === "human" ? "waiting_for_human" : "queued";
    this.connection().prepare(`
      INSERT INTO step_runs (
        step_run_id, run_id, loop_id, step_id, step_type,
        status, input, attempt, created_at, updated_at
      ) VALUES (
        @stepRunId, @runId, @loopId, @stepId, @stepType,
        @status, @input, 0, @createdAt, @updatedAt
      )
    `).run({
      stepRunId,
      runId: run.runId,
      loopId: run.loopId,
      stepId: step.id,
      stepType: step.type,
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
    outcome?: StepOutcome;
    error?: string;
  }): StepRun {
    const timestamp = now();
    const update = this.connection().prepare(`
      UPDATE step_runs SET status = 'completed',
        response_input = COALESCE(@responseInput, response_input), result = @result,
        outcome_json = @outcomeJson, error = @error,
        completed_at = @completedAt, updated_at = @updatedAt
        WHERE step_run_id = @stepRunId
    `).run({
      stepRunId: stepRun.stepRunId,
      responseInput: options.responseInput ?? null,
      result,
      outcomeJson: options.outcome ? stringifyJson(options.outcome) : null,
      error: options.error ?? null,
      completedAt: timestamp,
      updatedAt: timestamp
    });
    if (update.changes !== 1) throw new Error(`Step run ${stepRun.stepRunId} was not completed.`);
    const stored = this.getStepRun(stepRun.stepRunId);
    if (!stored) throw new Error(`Step run ${stepRun.stepRunId} was not found after completion.`);
    return stored;
  }

  pauseStepRunForInput(stepRun: StepRun, outcome: StepOutcome): void {
    this.connection().prepare(`
      UPDATE step_runs SET status = 'needs_input', result = NULL,
        response_input = NULL, outcome_json = ?, error = NULL, completed_at = NULL, updated_at = ?
      WHERE step_run_id = ?
    `).run(stringifyJson(outcome), now(), stepRun.stepRunId);
  }

  finishStepRunWithoutTransition(
    stepRun: StepRun,
    status: "blocked" | "failed",
    outcome: StepOutcome,
    error?: string
  ): void {
    const timestamp = now();
    this.connection().prepare(`
      UPDATE step_runs SET status = ?, result = NULL, outcome_json = ?, error = ?,
        completed_at = ?, updated_at = ? WHERE step_run_id = ?
    `).run(status, stringifyJson(outcome), error ?? null, timestamp, timestamp, stepRun.stepRunId);
  }

  blockStepRunWithoutTransition(stepRun: StepRun, runId: string, summary: string): void {
    this.finishStepRunWithoutTransition(stepRun, "blocked", { state: "blocked", summary, checks: [] });
    this.finishRun(runId, "blocked");
  }

  resumeStepRun(stepRun: StepRun, input: string, responseInput: string): StepRun {
    const timestamp = now();
    const result = this.connection().prepare(`
      UPDATE step_runs SET status = 'queued', execution_task_id = NULL, input = ?,
        response_input = ?, result = NULL, error = NULL, completed_at = NULL, updated_at = ?
      WHERE step_run_id = ? AND step_type IN ('agent','scheduled') AND status = 'needs_input'
    `).run(input, responseInput, timestamp, stepRun.stepRunId);
    if (result.changes !== 1) throw new Error(`Step run ${stepRun.stepRunId} is no longer waiting for input.`);
    const stored = this.getStepRun(stepRun.stepRunId);
    if (!stored) throw new Error(`Step run ${stepRun.stepRunId} was not found.`);
    return stored;
  }

  bindStepExecution(stepRunId: string, taskId: string, snapshot: ExecutionRuntimeSnapshot): StepRun {
    const result = this.connection().prepare(`
      UPDATE step_runs SET execution_task_id = ?, execution_snapshot_json = ?, updated_at = ?
      WHERE step_run_id = ? AND step_type IN ('agent','scheduled') AND execution_task_id IS NULL
    `).run(taskId, stringifyJson(snapshot), now(), stepRunId);
    if (result.changes !== 1) throw new Error(`Step run ${stepRunId} already has an execution task.`);
    const stepRun = this.getStepRun(stepRunId);
    if (!stepRun) throw new Error(`Step run ${stepRunId} was not found.`);
    return stepRun;
  }

  markStepRunning(stepRunId: string): StepRun {
    this.connection().prepare(`
      UPDATE step_runs SET status = 'running', attempt = attempt + 1, updated_at = ?
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

  waitForStepInput(runId: string): void {
    this.connection().prepare(`
      UPDATE loop_runs SET status = 'waiting_for_human', updated_at = ? WHERE run_id = ?
    `).run(now(), runId);
  }

  resumeRun(runId: string, input: string): void {
    this.connection().prepare(`
      UPDATE loop_runs SET status = 'running', input = ?, completed_at = NULL, updated_at = ?
      WHERE run_id = ? AND status = 'waiting_for_human'
    `).run(input, now(), runId);
  }

  finishRun(runId: string, status: "completed" | "blocked" | "failed" | "cancelled"): void {
    const timestamp = now();
    this.connection().prepare(`
      UPDATE loop_runs SET status = @status, completed_at = @completedAt, updated_at = @updatedAt
      WHERE run_id = @runId
    `).run({ runId, status, completedAt: timestamp, updatedAt: timestamp });
  }
}
