import type Database from "better-sqlite3";
import type { ProjectAutomationConfig } from "../shared/domain/automation.js";
import type { LoopTheme } from "../shared/domain/loopThemes.js";
import type {
  AgentOutcome,
  ExecutionRuntimeSnapshot,
  LoopExecutionPlan,
  LoopRunDetails,
  LoopRunSource,
  LoopScheduleState,
  HumanDecision,
  StepRun,
} from "../shared/domain/runtime.js";
import { LoopRunEngine } from "./runtime/LoopRunEngine.js";
import { LoopRunStore } from "./runtime/LoopRunStore.js";
import {
  LoopScheduleStateStore,
  type CompleteScheduleOccurrenceInput,
  type ScheduleDefinitionState
} from "./runtime/LoopScheduleStateStore.js";
import { RuntimeDbConnection, isPatchedSqliteVersion } from "./runtime/RuntimeDbConnection.js";

export { isPatchedSqliteVersion };

export type DispatchLoopScheduleResult =
  | { status: "started"; run: LoopRunDetails }
  | { status: "skipped"; error: string }
  | { status: "missed"; error: string }
  | { status: "stale" };

export class RuntimeDatabase {
  private readonly connectionManager: RuntimeDbConnection;
  private readonly loopRunStore: LoopRunStore;
  private readonly loopRunEngine: LoopRunEngine;
  private readonly loopScheduleStateStore: LoopScheduleStateStore;

  constructor(dbPath: string) {
    this.connectionManager = new RuntimeDbConnection(dbPath);
    const connection = () => this.connection();
    this.loopRunStore = new LoopRunStore(connection);
    this.loopRunEngine = new LoopRunEngine(connection, this.loopRunStore);
    this.loopScheduleStateStore = new LoopScheduleStateStore(connection);
  }

  close(): void {
    this.connectionManager.close();
  }

  connection(): Database.Database {
    return this.connectionManager.connection();
  }

  startLoopRun(
    config: ProjectAutomationConfig,
    loopId: string,
    themeSnapshot: LoopTheme,
    rootRunId: string,
    input?: string,
    source: LoopRunSource = "manual",
    executionPlan?: LoopExecutionPlan,
    schedule?: { stepId: string; scheduledFor: string }
  ): LoopRunDetails {
    return this.loopRunEngine.start(config, loopId, themeSnapshot, { input, source, executionPlan, schedule, rootRunId });
  }

  bindStepExecution(stepRunId: string, taskId: string, snapshot: ExecutionRuntimeSnapshot): StepRun {
    return this.loopRunStore.bindStepExecution(stepRunId, taskId, snapshot);
  }

  markStepRunRunning(stepRunId: string): StepRun {
    return this.loopRunStore.markStepRunning(stepRunId);
  }

  listLoopRuns(limit = 500): LoopRunDetails[] {
    return this.loopRunStore.list(limit);
  }

  listRootLoopRuns(rootRunId: string): LoopRunDetails[] {
    return this.loopRunStore.listByRoot(rootRunId);
  }

  activeLoopIds(): string[] {
    return this.loopRunStore.activeLoopIds();
  }

  listLoopScheduleStates(): LoopScheduleState[] {
    return this.loopScheduleStateStore.list();
  }

  syncLoopScheduleDefinitions(definitions: ScheduleDefinitionState[], updatedAt: string): boolean {
    const validKeys = new Set(definitions.map((definition) => `${definition.loopId}\0${definition.stepId}`));
    const transaction = this.connection().transaction(() => {
      let changed = false;
      definitions.forEach((definition) => {
        changed = this.loopScheduleStateStore.replaceDefinition(definition, updatedAt) || changed;
      });
      return this.loopScheduleStateStore.prune(validKeys) || changed;
    });
    return transaction() as boolean;
  }

  completeLoopScheduleOccurrence(input: CompleteScheduleOccurrenceInput): boolean {
    return this.loopScheduleStateStore.completeOccurrence(input);
  }

  finishReservedScheduleOccurrence(input: {
    loopId: string;
    stepId: string;
    scheduledFor: string;
    status: "started" | "skipped";
    runId?: string;
    error?: string;
    updatedAt: string;
  }): boolean {
    const result = this.connection().prepare(`
      UPDATE loop_schedule_state SET last_status = ?, last_run_id = ?, last_error = ?, updated_at = ?
      WHERE loop_id = ? AND step_id = ? AND last_scheduled_at = ?
    `).run(input.status, input.runId ?? null, input.error ?? null, input.updatedAt,
      input.loopId, input.stepId, input.scheduledFor);
    return result.changes === 1;
  }

  recoverReservedScheduleOccurrences(updatedAt = new Date().toISOString()): void {
    const rows = this.connection().prepare(`
      SELECT loop_id, step_id, last_scheduled_at FROM loop_schedule_state
      WHERE last_status = 'started' AND last_run_id IS NULL AND last_scheduled_at IS NOT NULL
    `).all() as Array<{ loop_id: string; step_id: string; last_scheduled_at: string }>;
    const transaction = this.connection().transaction(() => {
      for (const row of rows) {
        const run = this.connection().prepare(`
          SELECT run_id FROM loop_runs WHERE loop_id = ? AND schedule_step_id = ? AND scheduled_for = ? LIMIT 1
        `).get(row.loop_id, row.step_id, row.last_scheduled_at) as { run_id: string } | undefined;
        this.connection().prepare(`
          UPDATE loop_schedule_state SET last_status = ?, last_run_id = ?, last_error = ?, updated_at = ?
          WHERE loop_id = ? AND step_id = ? AND last_scheduled_at = ?
        `).run(run ? "started" : "missed", run?.run_id ?? null,
          run ? null : "Scheduled occurrence was interrupted before its Run was stored.", updatedAt,
          row.loop_id, row.step_id, row.last_scheduled_at);
      }
    });
    transaction();
  }

  respondToStepRun(
    config: ProjectAutomationConfig,
    loopTheme: LoopTheme,
    runId: string,
    stepRunId: string,
    result: HumanDecision,
    input: string
  ): LoopRunDetails {
    return this.loopRunEngine.respond(config, loopTheme, runId, stepRunId, result, input);
  }

  resumeAgentStepRun(
    runId: string,
    stepRunId: string,
    input: string
  ): LoopRunDetails {
    return this.loopRunEngine.resumeAgentInput(runId, stepRunId, input);
  }

  cancelLoopRun(runId: string): LoopRunDetails {
    return this.loopRunEngine.cancel(runId);
  }

  completeAgentStep(
    config: ProjectAutomationConfig,
    loopTheme: LoopTheme,
    input: {
      stepRunId: string;
      outcome?: AgentOutcome;
      error?: string;
    }
  ): LoopRunDetails {
    return this.loopRunEngine.completeAgentStep(config, loopTheme, input);
  }

  getStepRun(stepRunId: string): StepRun | undefined {
    return this.loopRunStore.getStepRun(stepRunId);
  }

}
