import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import type { Agent, AgentOutcome, AgentRun, AgentRunLog, AgentRunStatus, EventRecord, EventRoutingSummary, EventStatus, Policy, RouteDecision, RuntimeEvent } from "./shared/domain.js";
import { routeEvent } from "./shared/policy.js";

const PROJECTOR_CONSUMER = "policy-projector";
const MAX_CORRELATION_DEPTH = 20;

const now = () => new Date().toISOString();

export const resolveRuntimeDbPath = (root: string): string => {
  const configured = process.env.BALLET_DB_PATH?.trim();
  if (configured) return path.isAbsolute(configured) ? configured : path.resolve(root, configured);
  return path.join(root, "data", "ballet-runtime.sqlite");
};

const parseVersion = (version: string): [number, number, number] => {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map((part) => Number.parseInt(part, 10));
  return [major, minor, patch];
};

export const isPatchedSqliteVersion = (version: string): boolean => {
  const [major, minor, patch] = parseVersion(version);
  if (major > 3) return true;
  if (major < 3) return false;
  if (minor > 51) return true;
  if (minor === 51) return patch >= 3;
  if (minor === 50) return patch >= 7;
  if (minor === 44) return patch >= 6;
  return false;
};

const stringifyJson = (value: unknown): string => JSON.stringify(value ?? {});

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const hashDedupeKey = (value: unknown): string =>
  createHash("sha256").update(stableJson(value)).digest("hex").slice(0, 32);

const parseJsonObject = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
};

const parseJsonArray = (value: string): string[] => {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
};

const parseRoutingSummary = (value: string | null): EventRoutingSummary | undefined => {
  if (!value) return undefined;
  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as EventRoutingSummary : undefined;
};

interface EventRow {
  seq: number;
  event_id: string;
  type: string;
  source: string;
  subject: string;
  correlation_id: string;
  causation_id: string | null;
  dedupe_key: string | null;
  correlation_depth: number;
  occurred_at: string;
  project_id: string;
  tags_json: string;
  status: EventStatus;
  matched_policy_id: string | null;
  assigned_agent_id: string | null;
  routing_json: string | null;
  handling_result: string | null;
  payload_json: string;
}

interface AgentRunRow {
  run_id: string;
  trigger_event_id: string;
  trigger_event_seq: number | null;
  policy_id: string;
  policy_version: number;
  agent_role: string;
  status: AgentRunStatus;
  attempt: number;
  lease_owner: string | null;
  lease_until: string | null;
  thread_id: string | null;
  turn_id: string | null;
  outcome_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface AgentRunLogRow {
  id: number;
  run_id: string;
  level: "info" | "warn" | "error";
  message: string;
  data_json: string | null;
  created_at: string;
}

export interface IntakeEventInput {
  projectId: string;
  eventType: string;
  source?: string;
  subject?: string;
  correlationId?: string;
  causationId?: string;
  dedupeKey?: string;
  correlationDepth?: number;
  tags?: string[];
  payload?: Record<string, unknown>;
  body?: string;
}

export interface LeaseOptions {
  owner: string;
  leaseSeconds: number;
}

export interface CompleteRunInput {
  runId: string;
  status: AgentRunStatus;
  outcome?: AgentOutcome;
  error?: string;
  threadId?: string;
  turnId?: string;
  domainEvent?: {
    type: string;
    payload: Record<string, unknown>;
  };
  policies?: Policy[];
  agents?: Agent[];
}

export interface PublishEventResult {
  event: EventRecord;
  run?: AgentRun;
  runs: AgentRun[];
  duplicate: boolean;
}

export class RuntimeDatabase {
  private db?: Database.Database;

  constructor(private readonly dbPath: string) {}

  close(): void {
    this.db?.close();
    this.db = undefined;
  }

  get path(): string {
    return this.dbPath;
  }

  connection(): Database.Database {
    if (this.db) return this.db;

    mkdirSync(path.dirname(this.dbPath), { recursive: true });
    const db = new Database(this.dbPath);
    const sqliteVersion = db.prepare("SELECT sqlite_version() AS version").get() as { version: string };
    if (!isPatchedSqliteVersion(sqliteVersion.version)) {
      db.close();
      throw new Error(`SQLite ${sqliteVersion.version} is not supported for WAL runtime storage. Use 3.51.3+, 3.50.7+, or 3.44.6+.`);
    }

    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = FULL");
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");
    this.migrate(db);
    this.db = db;
    return db;
  }

  sqliteVersion(): string {
    const row = this.connection().prepare("SELECT sqlite_version() AS version").get() as { version: string };
    return row.version;
  }

  health(): Record<string, unknown> {
    const db = this.connection();
    const eventCount = db.prepare("SELECT COUNT(*) AS count FROM events").get() as { count: number };
    const queuedRuns = db.prepare("SELECT COUNT(*) AS count FROM agent_runs WHERE status = 'queued'").get() as { count: number };
    const runningRuns = db.prepare("SELECT COUNT(*) AS count FROM agent_runs WHERE status = 'running'").get() as { count: number };
    return {
      ok: true,
      dbPath: this.dbPath,
      sqliteVersion: this.sqliteVersion(),
      events: eventCount.count,
      queuedRuns: queuedRuns.count,
      runningRuns: runningRuns.count
    };
  }

  intakeEvent(input: IntakeEventInput, policies: Policy[], agents: Agent[]): PublishEventResult {
    return this.publishEventAndProjectPolicies(input, policies, agents);
  }

  publishEventAndProjectPolicies(input: IntakeEventInput, policies: Policy[], agents: Agent[]): PublishEventResult {
    const db = this.connection();
    const transaction = db.transaction(() => this.insertEventAndProjectPolicies(input, policies, agents));
    return transaction() as PublishEventResult;
  }

  listRuntimeEvents(limit = 500): RuntimeEvent[] {
    const rows = this.connection().prepare("SELECT * FROM events ORDER BY seq DESC LIMIT ?").all(limit) as EventRow[];
    return rows.map((row) => this.toRuntimeEvent(row));
  }

  listEventRecords(limit = 500): EventRecord[] {
    return this.listRuntimeEvents(limit).map((event) => this.runtimeEventToEventRecord(event));
  }

  deleteEvent(eventId: string): void {
    const db = this.connection();
    db.prepare("DELETE FROM events WHERE event_id = ?").run(eventId);
  }

  listRuns(limit = 500): AgentRun[] {
    const rows = this.connection().prepare("SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT ?").all(limit) as AgentRunRow[];
    return rows.map((row) => this.toAgentRun(row));
  }

  getRun(runId: string): AgentRun | undefined {
    const row = this.connection().prepare("SELECT * FROM agent_runs WHERE run_id = ?").get(runId) as AgentRunRow | undefined;
    return row ? this.toAgentRun(row) : undefined;
  }

  leaseNextRun(options: LeaseOptions): AgentRun | undefined {
    const db = this.connection();
    const leaseUntil = new Date(Date.now() + options.leaseSeconds * 1000).toISOString();
    const transaction = db.transaction(() => {
      const row = db.prepare(`
        SELECT *
        FROM agent_runs
        WHERE status = 'queued' OR (status = 'running' AND lease_until IS NOT NULL AND lease_until < @now)
        ORDER BY created_at ASC
        LIMIT 1
      `).get({ now: now() }) as AgentRunRow | undefined;
      if (!row) return undefined;
      db.prepare(`
        UPDATE agent_runs
        SET status = 'running',
            attempt = attempt + 1,
            lease_owner = @leaseOwner,
            lease_until = @leaseUntil,
            updated_at = @updatedAt
        WHERE run_id = @runId
      `).run({
        leaseOwner: options.owner,
        leaseUntil,
        updatedAt: now(),
        runId: row.run_id
      });
      return this.getRun(row.run_id);
    });
    return transaction() as AgentRun | undefined;
  }

  retryRun(runId: string): AgentRun {
    const db = this.connection();
    const transaction = db.transaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error("Agent run not found.");
      if (!["failed", "blocked", "needs_input", "cancelled"].includes(run.status)) {
        throw new Error(`Agent run with status ${run.status} cannot be retried.`);
      }
      db.prepare(`
        UPDATE agent_runs
        SET status = 'queued',
            lease_owner = NULL,
            lease_until = NULL,
            turn_id = NULL,
            outcome_json = NULL,
            error = NULL,
            completed_at = NULL,
            updated_at = @updatedAt
        WHERE run_id = @runId
      `).run({ runId, updatedAt: now() });
      this.appendRunLog(runId, "info", "Run queued for retry.", {});
      const updated = this.getRun(runId);
      if (!updated) throw new Error("Agent run disappeared during retry.");
      return updated;
    });
    return transaction() as AgentRun;
  }

  completeRun(input: CompleteRunInput): { run: AgentRun; event?: RuntimeEvent; runs?: AgentRun[] } {
    const db = this.connection();
    const transaction = db.transaction(() => {
      const existing = this.getRun(input.runId);
      if (!existing) throw new Error("Agent run not found.");
      const completedAt = ["completed", "failed", "blocked", "needs_input", "cancelled"].includes(input.status) ? now() : undefined;
      db.prepare(`
        UPDATE agent_runs
        SET status = @status,
            lease_owner = NULL,
            lease_until = NULL,
            thread_id = COALESCE(@threadId, thread_id),
            turn_id = COALESCE(@turnId, turn_id),
            outcome_json = @outcomeJson,
            error = @error,
            completed_at = @completedAt,
            updated_at = @updatedAt
        WHERE run_id = @runId
      `).run({
        runId: input.runId,
        status: input.status,
        threadId: input.threadId ?? null,
        turnId: input.turnId ?? null,
        outcomeJson: input.outcome ? stringifyJson(input.outcome) : null,
        error: input.error ?? null,
        completedAt: completedAt ?? null,
        updatedAt: now()
      });

      let event: RuntimeEvent | undefined;
      let runs: AgentRun[] = [];
      if (input.domainEvent) {
        const run = this.getRun(input.runId);
        if (!run) throw new Error("Agent run not found after update.");
        const trigger = this.getEventById(run.triggerEventId);
        if (!trigger) throw new Error("Trigger event not found.");
        const nextDepth = trigger.correlation_depth + 1;
        if (nextDepth > MAX_CORRELATION_DEPTH) {
          this.appendRunLog(run.runId, "warn", "Domain event publication skipped because correlation depth exceeded the runtime limit.", {
            event_type: input.domainEvent.type,
            max_correlation_depth: MAX_CORRELATION_DEPTH,
            next_correlation_depth: nextDepth
          });
        } else {
          const published = this.insertEventAndProjectPolicies({
            projectId: trigger.project_id,
            eventType: input.domainEvent.type,
            source: "agentd",
            subject: trigger.subject,
            correlationId: trigger.correlation_id,
            causationId: trigger.event_id,
            dedupeKey: `domain:${run.runId}:${input.domainEvent.type}`,
            correlationDepth: nextDepth,
            tags: [],
            payload: {
              ...input.domainEvent.payload,
              run_id: run.runId,
              trigger_event_id: run.triggerEventId,
              policy_id: run.policyId,
              policy_version: run.policyVersion
            },
            body: `Agent run ${run.runId} produced ${input.domainEvent.type}.`
          }, input.policies ?? [], input.agents ?? []);
          const publishedRow = this.getEventById(published.event.eventId ?? published.event.id);
          event = publishedRow ? this.toRuntimeEvent(publishedRow) : undefined;
          runs = published.runs;
        }
      }

      const updated = this.getRun(input.runId);
      if (!updated) throw new Error("Agent run not found after completion.");
      return { run: updated, event, runs };
    });
    return transaction() as { run: AgentRun; event?: RuntimeEvent; runs?: AgentRun[] };
  }

  saveRunThread(runId: string, threadId: string, turnId?: string): void {
    this.connection().prepare(`
      UPDATE agent_runs
      SET thread_id = @threadId,
          turn_id = COALESCE(@turnId, turn_id),
          updated_at = @updatedAt
      WHERE run_id = @runId
    `).run({ runId, threadId, turnId: turnId ?? null, updatedAt: now() });
  }

  getThreadBinding(workItemId: string, agentRole: string): string | undefined {
    const row = this.connection().prepare(`
      SELECT thread_id AS threadId
      FROM thread_bindings
      WHERE work_item_id = ? AND agent_role = ?
    `).get(workItemId, agentRole) as { threadId: string } | undefined;
    return row?.threadId;
  }

  upsertThreadBinding(workItemId: string, agentRole: string, threadId: string): void {
    this.connection().prepare(`
      INSERT INTO thread_bindings (work_item_id, agent_role, thread_id, updated_at)
      VALUES (@workItemId, @agentRole, @threadId, @updatedAt)
      ON CONFLICT(work_item_id, agent_role) DO UPDATE SET
        thread_id = excluded.thread_id,
        updated_at = excluded.updated_at
    `).run({ workItemId, agentRole, threadId, updatedAt: now() });
  }

  appendRunLog(runId: string, level: AgentRunLog["level"], message: string, data?: Record<string, unknown>): void {
    this.connection().prepare(`
      INSERT INTO agent_run_logs (run_id, level, message, data_json, created_at)
      VALUES (@runId, @level, @message, @dataJson, @createdAt)
    `).run({
      runId,
      level,
      message,
      dataJson: data ? stringifyJson(data) : null,
      createdAt: now()
    });
  }

  listRunLogs(runId?: string, limit = 500): AgentRunLog[] {
    const db = this.connection();
    const rows = runId
      ? db.prepare("SELECT * FROM agent_run_logs WHERE run_id = ? ORDER BY id DESC LIMIT ?").all(runId, limit) as AgentRunLogRow[]
      : db.prepare("SELECT * FROM agent_run_logs ORDER BY id DESC LIMIT ?").all(limit) as AgentRunLogRow[];
    return rows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      level: row.level,
      message: row.message,
      data: row.data_json ? parseJsonObject(row.data_json) : undefined,
      createdAt: row.created_at
    }));
  }

  getTriggerEvent(run: AgentRun): RuntimeEvent | undefined {
    const row = this.getEventById(run.triggerEventId);
    return row ? this.toRuntimeEvent(row) : undefined;
  }

  private insertEventAndProjectPolicies(input: IntakeEventInput, policies: Policy[], agents: Agent[]): PublishEventResult {
    const createdAt = now();
    const eventId = uuid();
    const payload = input.payload ?? {};
    const tags = input.tags ?? [];
    const payloadWorkItemId = typeof payload.work_item_id === "string"
      ? payload.work_item_id
      : typeof payload.workItemId === "string" ? payload.workItemId : undefined;
    const source = input.source ?? "unknown";
    const subject = input.subject ?? payloadWorkItemId ?? input.projectId;
    const correlationId = input.correlationId ?? eventId;
    const correlationDepth = input.correlationDepth ?? 0;
    if (correlationDepth > MAX_CORRELATION_DEPTH) {
      throw new Error(`Event correlation depth ${correlationDepth} exceeds the runtime limit ${MAX_CORRELATION_DEPTH}.`);
    }

    const dedupeKey = input.dedupeKey ?? `event:${hashDedupeKey({
      projectId: input.projectId,
      eventType: input.eventType,
      source,
      subject,
      correlationId: input.correlationId ?? "",
      causationId: input.causationId ?? "",
      tags,
      payload
    })}`;
    const duplicate = this.getEventByDedupeKey(dedupeKey);
    if (duplicate) {
      const runs = this.getRunsForTrigger(duplicate.event_id);
      return { event: this.toEventRecord(duplicate), run: runs[0], runs, duplicate: true };
    }

    const baseEvent: EventRecord = {
      id: eventId,
      eventId,
      projectId: input.projectId,
      source,
      type: input.eventType,
      eventType: input.eventType,
      subject,
      correlationId,
      causationId: input.causationId,
      dedupeKey,
      correlationDepth,
      occurredAt: createdAt,
      tags,
      payload,
      status: "received",
      handlingResult: input.body,
      createdAt
    };
    const decisions = routeEvent(baseEvent, policies, agents);
    const routedDecisions = decisions.filter((decision) => decision.status === "routed");
    let routing = this.routingSummary(decisions);
    const status: EventStatus = routedDecisions.length > 0 ? "routed" : "unassigned";
    const matchedPolicyId = routedDecisions[0]?.policyId ?? decisions[0]?.policyId;
    const assignedAgentId = routedDecisions[0]?.targetAgentId;
    const handlingResult = input.body ? `${input.body}\n\n${routing.message}` : routing.message;

    this.connection().prepare(`
      INSERT INTO events (
        event_id, type, source, subject, correlation_id, causation_id, dedupe_key,
        correlation_depth, occurred_at, project_id, tags_json, status, matched_policy_id,
        assigned_agent_id, routing_json, handling_result, payload_json
      )
      VALUES (
        @eventId, @type, @source, @subject, @correlationId, @causationId, @dedupeKey,
        @correlationDepth, @occurredAt, @projectId, @tagsJson, @status, @matchedPolicyId,
        @assignedAgentId, @routingJson, @handlingResult, @payloadJson
      )
    `).run({
      eventId,
      type: baseEvent.eventType,
      source: baseEvent.source,
      subject: baseEvent.subject,
      correlationId: baseEvent.correlationId,
      causationId: baseEvent.causationId ?? null,
      dedupeKey,
      correlationDepth,
      occurredAt: baseEvent.occurredAt,
      projectId: baseEvent.projectId,
      tagsJson: stringifyJson(baseEvent.tags),
      status,
      matchedPolicyId: matchedPolicyId ?? null,
      assignedAgentId: assignedAgentId ?? null,
      routingJson: stringifyJson(routing),
      handlingResult,
      payloadJson: stringifyJson(baseEvent.payload)
    });

    const inserted = this.getEventById(eventId);
    if (!inserted) throw new Error("Failed to read inserted event.");

    const runs: AgentRun[] = [];
    for (const decision of routedDecisions) {
      const runId = uuid();
      this.connection().prepare(`
        INSERT OR IGNORE INTO agent_runs (
          run_id, trigger_event_id, trigger_event_seq, policy_id, policy_version,
          agent_role, status, attempt, created_at, updated_at
        )
        VALUES (
          @runId, @triggerEventId, @triggerEventSeq, @policyId, @policyVersion,
          @agentRole, 'queued', 0, @createdAt, @updatedAt
        )
      `).run({
        runId,
        triggerEventId: inserted.event_id,
        triggerEventSeq: inserted.seq,
        policyId: decision.policyId,
        policyVersion: decision.policyVersion,
        agentRole: decision.targetAgentId,
        createdAt,
        updatedAt: createdAt
      });
      const run = this.getRunByDedupe(inserted.event_id, decision.policyId, decision.policyVersion, decision.targetAgentId);
      if (run) {
        decision.runId = run.runId;
        runs.push(run);
      }
    }

    routing = this.routingSummary(decisions);
    this.connection().prepare(`
      UPDATE events
      SET routing_json = @routingJson,
          handling_result = @handlingResult
      WHERE event_id = @eventId
    `).run({
      eventId,
      routingJson: stringifyJson(routing),
      handlingResult: input.body ? `${input.body}\n\n${routing.message}` : routing.message
    });

    this.connection().prepare(`
      INSERT INTO consumer_offsets (consumer_name, last_seq)
      VALUES (@consumerName, @lastSeq)
      ON CONFLICT(consumer_name) DO UPDATE SET last_seq = max(last_seq, excluded.last_seq)
    `).run({ consumerName: PROJECTOR_CONSUMER, lastSeq: inserted.seq });

    const updated = this.getEventById(eventId);
    if (!updated) throw new Error("Failed to read updated event.");
    return { event: this.toEventRecord(updated), run: runs[0], runs, duplicate: false };
  }

  private routingSummary(decisions: RouteDecision[]): EventRoutingSummary {
    const routedRuns = decisions.filter((decision) => decision.status === "routed").length;
    const skippedPolicies = decisions.filter((decision) => decision.status === "skipped").length;
    let message = "No active policy matched project, event type, source, subject, tags, and payload predicates.";
    if (routedRuns > 0) {
      message = `Routed to ${routedRuns} agent run${routedRuns === 1 ? "" : "s"} by ${decisions.length} matching polic${decisions.length === 1 ? "y" : "ies"}.`;
    } else if (skippedPolicies > 0) {
      message = `${skippedPolicies} matching polic${skippedPolicies === 1 ? "y was" : "ies were"} skipped because target agents were disabled or missing.`;
    }

    return {
      matchedPolicies: decisions.length,
      routedRuns,
      skippedPolicies,
      decisions: decisions.map((decision) => ({ ...decision })),
      message
    };
  }

  private migrate(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        subject TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        causation_id TEXT,
        dedupe_key TEXT,
        correlation_depth INTEGER NOT NULL DEFAULT 0,
        occurred_at TEXT NOT NULL,
        project_id TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'received',
        matched_policy_id TEXT,
        assigned_agent_id TEXT,
        routing_json TEXT,
        handling_result TEXT,
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS consumer_offsets (
        consumer_name TEXT PRIMARY KEY,
        last_seq INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS agent_runs (
        run_id TEXT PRIMARY KEY,
        trigger_event_id TEXT NOT NULL,
        trigger_event_seq INTEGER,
        policy_id TEXT NOT NULL,
        policy_version INTEGER NOT NULL,
        agent_role TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt INTEGER NOT NULL DEFAULT 0,
        lease_owner TEXT,
        lease_until TEXT,
        thread_id TEXT,
        turn_id TEXT,
        outcome_json TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        UNIQUE(trigger_event_id, policy_id, policy_version, agent_role),
        FOREIGN KEY(trigger_event_seq) REFERENCES events(seq) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS agent_run_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        data_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(run_id) REFERENCES agent_runs(run_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS thread_bindings (
        work_item_id TEXT NOT NULL,
        agent_role TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(work_item_id, agent_role)
      );

      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
      CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status, lease_until);
      CREATE INDEX IF NOT EXISTS idx_agent_runs_trigger ON agent_runs(trigger_event_id);
    `);

    const eventColumns = new Set((db.prepare("PRAGMA table_info(events)").all() as Array<{ name: string }>).map((column) => column.name));
    if (!eventColumns.has("dedupe_key")) db.exec("ALTER TABLE events ADD COLUMN dedupe_key TEXT");
    if (!eventColumns.has("correlation_depth")) db.exec("ALTER TABLE events ADD COLUMN correlation_depth INTEGER NOT NULL DEFAULT 0");
    if (!eventColumns.has("routing_json")) db.exec("ALTER TABLE events ADD COLUMN routing_json TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedupe_key ON events(dedupe_key) WHERE dedupe_key IS NOT NULL");
  }

  private getEventById(eventId: string): EventRow | undefined {
    return this.connection().prepare("SELECT * FROM events WHERE event_id = ?").get(eventId) as EventRow | undefined;
  }

  private getEventByDedupeKey(dedupeKey: string): EventRow | undefined {
    return this.connection().prepare("SELECT * FROM events WHERE dedupe_key = ?").get(dedupeKey) as EventRow | undefined;
  }

  private getRunsForTrigger(triggerEventId: string): AgentRun[] {
    const rows = this.connection().prepare(`
      SELECT *
      FROM agent_runs
      WHERE trigger_event_id = ?
      ORDER BY created_at ASC, run_id ASC
    `).all(triggerEventId) as AgentRunRow[];
    return rows.map((row) => this.toAgentRun(row));
  }

  private getRunByDedupe(triggerEventId: string, policyId: string, policyVersion: number, agentRole: string): AgentRun | undefined {
    const row = this.connection().prepare(`
      SELECT *
      FROM agent_runs
      WHERE trigger_event_id = ? AND policy_id = ? AND policy_version = ? AND agent_role = ?
    `).get(triggerEventId, policyId, policyVersion, agentRole) as AgentRunRow | undefined;
    return row ? this.toAgentRun(row) : undefined;
  }

  private toRuntimeEvent(row: EventRow): RuntimeEvent {
    return {
      seq: row.seq,
      eventId: row.event_id,
      type: row.type,
      source: row.source,
      subject: row.subject,
      correlationId: row.correlation_id,
      causationId: row.causation_id ?? undefined,
      dedupeKey: row.dedupe_key ?? undefined,
      correlationDepth: row.correlation_depth,
      occurredAt: row.occurred_at,
      projectId: row.project_id,
      tags: parseJsonArray(row.tags_json),
      payload: parseJsonObject(row.payload_json),
      status: row.status,
      matchedPolicyId: row.matched_policy_id ?? undefined,
      assignedAgentId: row.assigned_agent_id ?? undefined,
      routing: parseRoutingSummary(row.routing_json),
      handlingResult: row.handling_result ?? undefined
    };
  }

  private runtimeEventToEventRecord(event: RuntimeEvent): EventRecord {
    return {
      seq: event.seq,
      id: event.eventId,
      eventId: event.eventId,
      projectId: event.projectId,
      source: event.source,
      type: event.type,
      eventType: event.type,
      subject: event.subject,
      correlationId: event.correlationId,
      causationId: event.causationId,
      dedupeKey: event.dedupeKey,
      correlationDepth: event.correlationDepth,
      occurredAt: event.occurredAt,
      tags: event.tags,
      payload: event.payload,
      status: event.status,
      matchedPolicyId: event.matchedPolicyId,
      assignedAgentId: event.assignedAgentId,
      routing: event.routing,
      handlingResult: event.handlingResult,
      createdAt: event.occurredAt
    };
  }

  private toEventRecord(row: EventRow): EventRecord {
    return this.runtimeEventToEventRecord(this.toRuntimeEvent(row));
  }

  private toAgentRun(row: AgentRunRow): AgentRun {
    return {
      runId: row.run_id,
      triggerEventId: row.trigger_event_id,
      triggerEventSeq: row.trigger_event_seq ?? undefined,
      policyId: row.policy_id,
      policyVersion: row.policy_version,
      agentRole: row.agent_role,
      status: row.status,
      attempt: row.attempt,
      leaseOwner: row.lease_owner ?? undefined,
      leaseUntil: row.lease_until ?? undefined,
      threadId: row.thread_id ?? undefined,
      turnId: row.turn_id ?? undefined,
      outcome: row.outcome_json ? JSON.parse(row.outcome_json) as AgentOutcome : undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at ?? undefined
    };
  }
}
