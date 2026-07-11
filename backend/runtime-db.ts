import type Database from "better-sqlite3";
import type { ProjectAutomationConfig } from "../shared/domain/automation.js";
import type { EventRecord, RuntimeEvent } from "../shared/domain/events.js";
import type {
  AgentOutcome,
  ExecutionRuntimeSnapshot,
  LoopExecutionPlan,
  LoopRunDetails,
  LoopRunSource,
  StepRun,
  StepRunResult
} from "../shared/domain/runtime.js";
import { EventStore } from "./runtime/EventStore.js";
import { LoopRunEngine } from "./runtime/LoopRunEngine.js";
import { LoopRunStore } from "./runtime/LoopRunStore.js";
import { RuntimeDbConnection, isPatchedSqliteVersion } from "./runtime/RuntimeDbConnection.js";
import type { IntakeEventInput, PublishEventResult } from "./runtime/RuntimeDbTypes.js";
import { resolveRuntimeDbPath } from "./runtime/runtimeDbPath.js";

export { isPatchedSqliteVersion, resolveRuntimeDbPath };
export type { IntakeEventInput, PublishEventResult };

export class RuntimeDatabase {
  private readonly connectionManager: RuntimeDbConnection;
  private readonly eventStore: EventStore;
  private readonly loopRunStore: LoopRunStore;
  private readonly loopRunEngine: LoopRunEngine;

  constructor(dbPath: string, readonly projectId = "project") {
    this.connectionManager = new RuntimeDbConnection(dbPath, projectId);
    const connection = () => this.connection();
    this.eventStore = new EventStore(connection, projectId);
    this.loopRunStore = new LoopRunStore(connection, projectId);
    this.loopRunEngine = new LoopRunEngine(connection, this.loopRunStore);
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
    input?: string,
    source: LoopRunSource = "manual",
    runtimeDeviceId?: string,
    executionPlan?: LoopExecutionPlan
  ): LoopRunDetails {
    return this.loopRunEngine.start(config, loopId, { input, source, runtimeDeviceId, executionPlan });
  }

  bindStepExecution(stepRunId: string, taskId: string, snapshot: ExecutionRuntimeSnapshot): StepRun {
    return this.loopRunStore.bindStepExecution(stepRunId, taskId, snapshot);
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

  listRootLoopRuns(rootRunId: string): LoopRunDetails[] {
    return this.loopRunStore.listByRoot(rootRunId);
  }

  activeLoopIds(): string[] {
    return this.loopRunStore.activeLoopIds();
  }

  respondToStepRun(
    config: ProjectAutomationConfig,
    runId: string,
    stepRunId: string,
    result: StepRunResult,
    input: string
  ): LoopRunDetails {
    return this.loopRunEngine.respond(config, runId, stepRunId, result, input);
  }

  cancelLoopRun(runId: string): LoopRunDetails {
    return this.loopRunEngine.cancel(runId);
  }

  completeAgentStep(
    config: ProjectAutomationConfig,
    input: {
      stepRunId: string;
      outcome?: AgentOutcome;
      error?: string;
    }
  ): LoopRunDetails {
    return this.loopRunEngine.completeAgentStep(config, input);
  }

  getLoopRun(runId: string): LoopRunDetails | undefined {
    return this.loopRunStore.details(runId);
  }

  getStepRun(stepRunId: string): StepRun | undefined {
    return this.loopRunStore.getStepRun(stepRunId);
  }

}
