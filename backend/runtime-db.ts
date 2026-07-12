import type Database from "better-sqlite3";
import type { ProjectAutomationConfig } from "../shared/domain/automation.js";
import type { EventRecord, RuntimeEvent } from "../shared/domain/events.js";
import type { LoopTheme } from "../shared/domain/loopThemes.js";
import type {
  AgentOutcome,
  ExecutionRuntimeSnapshot,
  LoopExecutionPlan,
  LoopRunDetails,
  LoopRunSource,
  LoopScheduleState,
  StepRun,
  StepRunResult
} from "../shared/domain/runtime.js";
import { EventStore } from "./runtime/EventStore.js";
import { LoopRunEngine } from "./runtime/LoopRunEngine.js";
import { LoopRunStore } from "./runtime/LoopRunStore.js";
import {
  LoopScheduleStateStore,
  type CompleteScheduleOccurrenceInput,
  type ScheduleDefinitionState
} from "./runtime/LoopScheduleStateStore.js";
import { RuntimeDbConnection, isPatchedSqliteVersion } from "./runtime/RuntimeDbConnection.js";
import type { IntakeEventInput, PublishEventResult } from "./runtime/RuntimeDbTypes.js";
import { resolveRuntimeDbPath } from "./runtime/runtimeDbPath.js";

export { isPatchedSqliteVersion, resolveRuntimeDbPath };
export type { IntakeEventInput, PublishEventResult };

export interface DispatchLoopScheduleInput {
  loopId: string;
  themeSnapshot: LoopTheme;
  stepId: string;
  definitionHash: string;
  scheduledFor: string;
  nextRunAt?: string;
  runtimeDeviceId?: string;
  executionPlan?: LoopExecutionPlan;
  updatedAt: string;
}

export type DispatchLoopScheduleResult =
  | { status: "started"; run: LoopRunDetails }
  | { status: "skipped"; error: string }
  | { status: "missed"; error: string }
  | { status: "stale" };

export class RuntimeDatabase {
  private readonly connectionManager: RuntimeDbConnection;
  private readonly eventStore: EventStore;
  private readonly loopRunStore: LoopRunStore;
  private readonly loopRunEngine: LoopRunEngine;
  private readonly loopScheduleStateStore: LoopScheduleStateStore;

  constructor(dbPath: string, readonly projectId = "project") {
    this.connectionManager = new RuntimeDbConnection(dbPath, projectId);
    const connection = () => this.connection();
    this.eventStore = new EventStore(connection, projectId);
    this.loopRunStore = new LoopRunStore(connection, projectId);
    this.loopRunEngine = new LoopRunEngine(connection, this.loopRunStore);
    this.loopScheduleStateStore = new LoopScheduleStateStore(connection, projectId);
  }

  close(): void {
    this.connectionManager.close();
  }

  get path(): string {
    return this.connectionManager.path;
  }

  connection(): Database.Database {
    return this.connectionManager.connection();
  }

  sqliteVersion(): string {
    return this.connectionManager.sqliteVersion();
  }

  health(): Record<string, unknown> {
    return this.connectionManager.health();
  }

  intakeEvent(input: IntakeEventInput): PublishEventResult {
    return this.eventStore.intake(input);
  }

  listRuntimeEvents(limit = 500): RuntimeEvent[] {
    return this.eventStore.listRuntimeEvents(limit);
  }

  listEventRecords(limit = 500): EventRecord[] {
    return this.eventStore.listEventRecords(limit);
  }

  deleteEvent(eventId: string): void {
    this.eventStore.deleteEvent(eventId);
  }

  startLoopRun(
    config: ProjectAutomationConfig,
    loopId: string,
    themeSnapshot: LoopTheme,
    input?: string,
    source: LoopRunSource = "manual",
    runtimeDeviceId?: string,
    executionPlan?: LoopExecutionPlan,
    schedule?: { stepId: string; scheduledFor: string }
  ): LoopRunDetails {
    return this.loopRunEngine.start(config, loopId, themeSnapshot, { input, source, runtimeDeviceId, executionPlan, schedule });
  }

  bindStepExecution(stepRunId: string, taskId: string, snapshot: ExecutionRuntimeSnapshot): StepRun {
    return this.loopRunStore.bindStepExecution(stepRunId, taskId, snapshot);
  }

  clearStepExecution(stepRunId: string, expectedTaskId: string): StepRun {
    return this.loopRunStore.clearStepExecution(stepRunId, expectedTaskId);
  }

  markStepRunRunning(stepRunId: string): StepRun {
    return this.loopRunStore.markStepRunning(stepRunId);
  }

  latestLoopRun(loopId: string): LoopRunDetails | undefined {
    return this.loopRunStore.latest(loopId);
  }

  listLoopRuns(limit = 500): LoopRunDetails[] {
    return this.loopRunStore.list(limit);
  }

  listActiveLoopRuns(): LoopRunDetails[] {
    return this.loopRunStore.listActive();
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

  dispatchLoopScheduleOccurrence(
    config: ProjectAutomationConfig,
    input: DispatchLoopScheduleInput
  ): DispatchLoopScheduleResult {
    const transaction = this.connection().transaction((): DispatchLoopScheduleResult => {
      const state = this.loopScheduleStateStore.get(input.loopId, input.stepId);
      if (state?.definition_hash !== input.definitionHash || state.next_run_at !== input.scheduledFor) {
        return { status: "stale" };
      }
      if (this.loopRunStore.hasActiveLoop(input.loopId)) {
        const error = `Loop ${input.loopId} already has an active run.`;
        this.loopScheduleStateStore.completeOccurrence({
          ...input,
          status: "skipped",
          error
        });
        return { status: "skipped", error };
      }
      const run = this.loopRunEngine.start(config, input.loopId, input.themeSnapshot, {
        source: "schedule",
        runtimeDeviceId: input.runtimeDeviceId,
        executionPlan: input.executionPlan,
        schedule: { stepId: input.stepId, scheduledFor: input.scheduledFor }
      });
      const completed = this.loopScheduleStateStore.completeOccurrence({
        ...input,
        status: "started",
        runId: run.runId
      });
      if (!completed) throw new Error("Scheduled Loop state changed while dispatching its occurrence.");
      return { status: "started", run };
    });
    return transaction() as DispatchLoopScheduleResult;
  }

  respondToStepRun(
    config: ProjectAutomationConfig,
    loopThemes: readonly LoopTheme[],
    runId: string,
    stepRunId: string,
    result: StepRunResult,
    input: string
  ): LoopRunDetails {
    return this.loopRunEngine.respond(config, loopThemes, runId, stepRunId, result, input);
  }

  cancelLoopRun(runId: string): LoopRunDetails {
    return this.loopRunEngine.cancel(runId);
  }

  completeAgentStep(
    config: ProjectAutomationConfig,
    loopThemes: readonly LoopTheme[],
    input: {
      stepRunId: string;
      outcome?: AgentOutcome;
      error?: string;
    }
  ): LoopRunDetails {
    return this.loopRunEngine.completeAgentStep(config, loopThemes, input);
  }

  getLoopRun(runId: string): LoopRunDetails | undefined {
    return this.loopRunStore.details(runId);
  }

  getStepRun(stepRunId: string): StepRun | undefined {
    return this.loopRunStore.getStepRun(stepRunId);
  }

}
