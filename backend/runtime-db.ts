import type Database from "better-sqlite3";
import type { Agent } from "../shared/domain/agents.js";
import type { Policy } from "../shared/domain/automation.js";
import type { EventRecord, RuntimeEvent } from "../shared/domain/events.js";
import type { AgentRun, AgentRunLog } from "../shared/domain/runtime.js";
import { AgentRunStore } from "./runtime/AgentRunStore.js";
import { EventStore } from "./runtime/EventStore.js";
import { RuntimeDbConnection, isPatchedSqliteVersion } from "./runtime/RuntimeDbConnection.js";
import type {
  CompleteRunInput,
  IntakeEventInput,
  LeaseOptions,
  PublishEventResult
} from "./runtime/RuntimeDbTypes.js";
import { RuntimeProjector } from "./runtime/RuntimeProjector.js";
import { RuntimeRunCompletion } from "./runtime/RuntimeRunCompletion.js";
import { resolveRuntimeDbPath } from "./runtime/runtimeDbPath.js";

export { isPatchedSqliteVersion, resolveRuntimeDbPath };
export type { CompleteRunInput, IntakeEventInput, LeaseOptions, PublishEventResult };

export class RuntimeDatabase {
  private readonly connectionManager: RuntimeDbConnection;
  private readonly eventStore: EventStore;
  private readonly runStore: AgentRunStore;
  private readonly projector: RuntimeProjector;
  private readonly runCompletion: RuntimeRunCompletion;

  constructor(dbPath: string) {
    this.connectionManager = new RuntimeDbConnection(dbPath);
    const connection = () => this.connection();
    this.eventStore = new EventStore(connection);
    this.runStore = new AgentRunStore(connection);
    this.projector = new RuntimeProjector(connection, this.eventStore, this.runStore);
    this.runCompletion = new RuntimeRunCompletion(connection, this.eventStore, this.runStore, this.projector);
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

  intakeEvent(input: IntakeEventInput, policies: Policy[], agents: Agent[]): PublishEventResult {
    return this.publishEventAndProjectPolicies(input, policies, agents);
  }

  publishEventAndProjectPolicies(input: IntakeEventInput, policies: Policy[], agents: Agent[]): PublishEventResult {
    return this.projector.publishEventAndProjectPolicies(input, policies, agents);
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

  listRuns(limit = 500): AgentRun[] {
    return this.runStore.listRuns(limit);
  }

  getRun(runId: string): AgentRun | undefined {
    return this.runStore.getRun(runId);
  }

  leaseNextRun(options: LeaseOptions): AgentRun | undefined {
    return this.runStore.leaseNextRun(options);
  }

  retryRun(runId: string): AgentRun {
    return this.runStore.retryRun(runId);
  }

  completeRun(input: CompleteRunInput): { run: AgentRun; event?: RuntimeEvent; runs?: AgentRun[] } {
    return this.runCompletion.completeRun(input);
  }

  saveRunThread(runId: string, threadId: string, turnId?: string): void {
    this.runStore.saveRunThread(runId, threadId, turnId);
  }

  getThreadBinding(workItemId: string, agentRole: string): string | undefined {
    return this.runStore.getThreadBinding(workItemId, agentRole);
  }

  upsertThreadBinding(workItemId: string, agentRole: string, threadId: string): void {
    this.runStore.upsertThreadBinding(workItemId, agentRole, threadId);
  }

  appendRunLog(runId: string, level: AgentRunLog["level"], message: string, data?: Record<string, unknown>): void {
    this.runStore.appendRunLog(runId, level, message, data);
  }

  listRunLogs(runId?: string, limit = 500): AgentRunLog[] {
    return this.runStore.listRunLogs(runId, limit);
  }

  getTriggerEvent(run: AgentRun): RuntimeEvent | undefined {
    return this.eventStore.getTriggerEvent(run);
  }
}
