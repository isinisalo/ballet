import type Database from "better-sqlite3";
import type { ProjectAutomationConfig } from "../shared/domain/automation.js";
import type { EventRecord, RuntimeEvent } from "../shared/domain/events.js";
import type {
  AgentOutcome,
  LoopRunDetails,
  LoopRunSource,
  StepRun,
  StepRunConsoleEntry,
  StepRunConsolePage,
  StepRunLog,
  StepRunResult
} from "../shared/domain/runtime.js";
import { EventStore } from "./runtime/EventStore.js";
import { LoopRunEngine } from "./runtime/LoopRunEngine.js";
import { LoopRunStore, type AppendStepRunConsoleInput } from "./runtime/LoopRunStore.js";
import { RuntimeDbConnection, isPatchedSqliteVersion } from "./runtime/RuntimeDbConnection.js";
import type { IntakeEventInput, LeaseOptions, PublishEventResult } from "./runtime/RuntimeDbTypes.js";
import { resolveRuntimeDbPath } from "./runtime/runtimeDbPath.js";

export { isPatchedSqliteVersion, resolveRuntimeDbPath };
export type { IntakeEventInput, LeaseOptions, PublishEventResult };

export class RuntimeDatabase {
  private readonly connectionManager: RuntimeDbConnection;
  private readonly eventStore: EventStore;
  private readonly loopRunStore: LoopRunStore;
  private readonly loopRunEngine: LoopRunEngine;

  constructor(dbPath: string) {
    this.connectionManager = new RuntimeDbConnection(dbPath);
    const connection = () => this.connection();
    this.eventStore = new EventStore(connection);
    this.loopRunStore = new LoopRunStore(connection);
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
    source: LoopRunSource = "manual"
  ): LoopRunDetails {
    return this.loopRunEngine.start(config, loopId, { input, source });
  }

  latestLoopRun(loopId: string): LoopRunDetails | undefined {
    return this.loopRunStore.latest(loopId);
  }

  listLoopRuns(limit = 500): LoopRunDetails[] {
    return this.loopRunStore.list(limit);
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

  leaseNextStepRun(options: LeaseOptions): StepRun | undefined {
    return this.loopRunStore.leaseNext(options);
  }

  completeAgentStep(
    config: ProjectAutomationConfig,
    input: {
      stepRunId: string;
      outcome?: AgentOutcome;
      error?: string;
      threadId?: string;
      turnId?: string;
    }
  ): LoopRunDetails {
    return this.loopRunEngine.completeAgentStep(config, input);
  }

  getLoopRun(runId: string): LoopRunDetails | undefined {
    return this.loopRunStore.details(runId);
  }

  saveStepRunThread(stepRunId: string, threadId: string, turnId?: string): void {
    this.loopRunStore.saveThread(stepRunId, threadId, turnId);
  }

  getStepRun(stepRunId: string): StepRun | undefined {
    return this.loopRunStore.getStepRun(stepRunId);
  }

  getThreadBinding(workItemId: string, agentRole: string): string | undefined {
    return this.loopRunStore.getThreadBinding(workItemId, agentRole);
  }

  appendStepRunLog(
    stepRunId: string,
    level: StepRunLog["level"],
    message: string,
    data?: Record<string, unknown>
  ): StepRunConsoleEntry | undefined {
    return this.loopRunStore.appendLog(stepRunId, level, message, data);
  }

  appendStepRunConsole(stepRunId: string, input: AppendStepRunConsoleInput): StepRunConsoleEntry | undefined {
    return this.loopRunStore.appendConsole(stepRunId, input);
  }

  getStepRunConsole(stepRunId: string, afterId = 0, limit = 500): StepRunConsolePage {
    return this.loopRunStore.listConsole(stepRunId, afterId, limit);
  }

  listStepRunLogs(stepRunId?: string, limit = 500): StepRunLog[] {
    return this.loopRunStore.listLogs(stepRunId, limit);
  }
}
