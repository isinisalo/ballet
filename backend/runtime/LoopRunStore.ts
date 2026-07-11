import type Database from "better-sqlite3";
import { v4 as uuid } from "uuid";
import type { ProjectLoop, ProjectStep } from "../../shared/domain/automation.js";
import type {
  AgentOutcome,
  LoopRun,
  LoopRunDetails,
  LoopRunSource,
  StepRun,
  StepRunConsoleEntry,
  StepRunConsoleKind,
  StepRunConsolePage,
  StepRunConsolePhase,
  StepRunLog,
  StepRunResult
} from "../../shared/domain/runtime.js";
import { stringifyJson } from "./RuntimeJson.js";
import { toLoopRun, toStepRun, toStepRunLog } from "./RuntimeRowMappers.js";
import type {
  LeaseOptions,
  LoopRunRow,
  StepRunLogRow,
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
}

export interface AppendStepRunConsoleInput {
  source?: StepRunConsoleEntry["source"];
  kind: StepRunConsoleKind;
  level?: StepRunConsoleEntry["level"];
  phase?: StepRunConsolePhase;
  itemId?: string;
  message: string;
  data?: Record<string, unknown>;
  terminal?: boolean;
}

const STEP_RUN_CONSOLE_MAX_BYTES = 1024 * 1024;
const TRUNCATION_ITEM_ID = "__ballet_console_truncated__";

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

  latest(loopId: string): LoopRunDetails | undefined {
    const row = this.connection().prepare(`
      SELECT run_id FROM loop_runs WHERE loop_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get(loopId) as { run_id: string } | undefined;
    return row ? this.details(row.run_id) : undefined;
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
    const runId = input.runId ?? uuid();
    const timestamp = now();
    this.connection().prepare(`
      INSERT INTO loop_runs (
        run_id, loop_id, root_run_id, parent_run_id, parent_step_run_id,
        source, status, input, snapshot_json, transition_count, created_at, updated_at
      ) VALUES (
        @runId, @loopId, @rootRunId, @parentRunId, @parentStepRunId,
        @source, 'running', @input, @snapshotJson, 0, @createdAt, @updatedAt
      )
    `).run({
      runId,
      loopId: input.loop.id,
      rootRunId: input.rootRunId ?? runId,
      parentRunId: input.parentRunId ?? null,
      parentStepRunId: input.parentStepRunId ?? null,
      source: input.source,
      input: input.input ?? null,
      snapshotJson: stringifyJson(input.loop),
      createdAt: timestamp,
      updatedAt: timestamp
    });
    const run = this.getLoopRun(runId);
    if (!run) throw new Error("Loop run was not stored.");
    return run;
  }

  createStepRun(run: LoopRun, step: ProjectStep, input?: string): StepRun {
    const stepRunId = uuid();
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
    threadId?: string;
    turnId?: string;
    failed?: boolean;
  }): void {
    const timestamp = now();
    this.connection().prepare(`
      UPDATE step_runs SET status = @status, response_input = @responseInput, result = @result,
        outcome_json = @outcomeJson, error = @error, lease_owner = NULL, lease_until = NULL,
        thread_id = COALESCE(@threadId, thread_id), turn_id = COALESCE(@turnId, turn_id),
        completed_at = @completedAt, updated_at = @updatedAt WHERE step_run_id = @stepRunId
    `).run({
      stepRunId: stepRun.stepRunId,
      status: options.failed ? "failed" : "completed",
      responseInput: options.responseInput ?? null,
      result,
      outcomeJson: options.outcome ? stringifyJson(options.outcome) : null,
      error: options.error ?? null,
      threadId: options.threadId ?? null,
      turnId: options.turnId ?? null,
      completedAt: timestamp,
      updatedAt: timestamp
    });
  }

  rootTransitionCount(rootRunId: string): number {
    const row = this.connection().prepare(`
      SELECT COALESCE(SUM(transition_count), 0) AS count FROM loop_runs WHERE root_run_id = ?
    `).get(rootRunId) as { count: number };
    return row.count;
  }

  incrementTransitionCount(runId: string): void {
    this.connection().prepare(`
      UPDATE loop_runs SET transition_count = transition_count + 1, updated_at = @updatedAt WHERE run_id = @runId
    `).run({ runId, updatedAt: now() });
  }

  updateRunInput(runId: string, input: string): void {
    this.connection().prepare("UPDATE loop_runs SET input = ?, updated_at = ? WHERE run_id = ?")
      .run(input, now(), runId);
  }

  finishRun(runId: string, status: "completed" | "blocked" | "failed" | "cancelled"): void {
    const timestamp = now();
    this.connection().prepare(`
      UPDATE loop_runs SET status = @status, completed_at = @completedAt, updated_at = @updatedAt WHERE run_id = @runId
    `).run({ runId, status, completedAt: timestamp, updatedAt: timestamp });
  }

  leaseNext(options: LeaseOptions): StepRun | undefined {
    const leaseUntil = new Date(Date.now() + options.leaseSeconds * 1000).toISOString();
    const transaction = this.connection().transaction(() => {
      const row = this.connection().prepare(`
        SELECT step_run_id FROM step_runs
        WHERE status = 'queued' OR (status = 'running' AND lease_until IS NOT NULL AND lease_until < @now)
        ORDER BY created_at ASC, rowid ASC LIMIT 1
      `).get({ now: now() }) as { step_run_id: string } | undefined;
      if (!row) return undefined;
      this.connection().prepare(`
        UPDATE step_runs SET status = 'running', attempt = attempt + 1,
          lease_owner = @owner, lease_until = @leaseUntil, updated_at = @updatedAt
        WHERE step_run_id = @stepRunId
      `).run({
        stepRunId: row.step_run_id,
        owner: options.owner,
        leaseUntil,
        updatedAt: now()
      });
      return this.getStepRun(row.step_run_id);
    });
    return transaction() as StepRun | undefined;
  }

  saveThread(stepRunId: string, threadId: string, turnId?: string): void {
    this.connection().prepare(`
      UPDATE step_runs SET thread_id = @threadId, turn_id = COALESCE(@turnId, turn_id), updated_at = @updatedAt
      WHERE step_run_id = @stepRunId
    `).run({ stepRunId, threadId, turnId: turnId ?? null, updatedAt: now() });
  }

  appendLog(stepRunId: string, level: StepRunLog["level"], message: string, data?: Record<string, unknown>): StepRunConsoleEntry | undefined {
    return this.appendConsole(stepRunId, {
      source: "ballet",
      kind: level === "error" ? "error" : level === "warn" ? "warn" : "info",
      level,
      phase: "completed",
      message,
      data,
      terminal: level === "error"
    });
  }

  appendConsole(stepRunId: string, input: AppendStepRunConsoleInput): StepRunConsoleEntry | undefined {
    const contentBytes = Buffer.byteLength(input.message, "utf8") + (input.data ? Buffer.byteLength(stringifyJson(input.data), "utf8") : 0);
    if (!input.terminal) {
      const total = this.connection().prepare(`
        SELECT COALESCE(SUM(content_bytes), 0) AS bytes FROM step_run_logs
        WHERE step_run_id = ? AND (item_id IS NULL OR item_id != ?)
      `).get(stepRunId, TRUNCATION_ITEM_ID) as { bytes: number };
      if (total.bytes + contentBytes > STEP_RUN_CONSOLE_MAX_BYTES) return this.appendTruncationMarker(stepRunId);
      if (this.hasTruncationMarker(stepRunId)) return undefined;
    }
    const result = this.connection().prepare(`
      INSERT INTO step_run_logs (
        step_run_id, source, kind, level, phase, item_id, message,
        data_json, content_bytes, terminal, created_at
      ) VALUES (
        @stepRunId, @source, @kind, @level, @phase, @itemId, @message,
        @dataJson, @contentBytes, @terminal, @createdAt
      )
    `).run({
      stepRunId,
      source: input.source ?? "codex",
      kind: input.kind,
      level: input.level ?? (input.kind === "error" ? "error" : input.kind === "warn" ? "warn" : "info"),
      phase: input.phase ?? "completed",
      itemId: input.itemId ?? null,
      message: input.message,
      dataJson: input.data ? stringifyJson(input.data) : null,
      contentBytes,
      terminal: input.terminal ? 1 : 0,
      createdAt: now()
    });
    const row = this.connection().prepare("SELECT * FROM step_run_logs WHERE id = ?").get(Number(result.lastInsertRowid)) as StepRunLogRow | undefined;
    return row ? toStepRunLog(row) : undefined;
  }

  listConsole(stepRunId: string, afterId = 0, limit = 500): StepRunConsolePage {
    const safeLimit = Math.min(Math.max(limit, 1), 1000);
    const rows = this.connection().prepare(`
      SELECT * FROM step_run_logs WHERE step_run_id = ? AND id > ? ORDER BY id ASC LIMIT ?
    `).all(stepRunId, afterId, safeLimit + 1) as StepRunLogRow[];
    const pageRows = rows.slice(0, safeLimit);
    const entries = pageRows.map(toStepRunLog);
    return {
      entries,
      lastId: entries.at(-1)?.id ?? afterId,
      hasMore: rows.length > safeLimit,
      truncated: this.hasTruncationMarker(stepRunId)
    };
  }

  listLogs(stepRunId?: string, limit = 500): StepRunLog[] {
    const rows = stepRunId
      ? this.connection().prepare("SELECT * FROM step_run_logs WHERE step_run_id = ? ORDER BY id DESC LIMIT ?").all(stepRunId, limit) as StepRunLogRow[]
      : this.connection().prepare("SELECT * FROM step_run_logs ORDER BY id DESC LIMIT ?").all(limit) as StepRunLogRow[];
    return rows.map(toStepRunLog);
  }

  private hasTruncationMarker(stepRunId: string): boolean {
    return Boolean(this.connection().prepare("SELECT 1 FROM step_run_logs WHERE step_run_id = ? AND item_id = ? LIMIT 1")
      .get(stepRunId, TRUNCATION_ITEM_ID));
  }

  private appendTruncationMarker(stepRunId: string): StepRunConsoleEntry | undefined {
    if (this.hasTruncationMarker(stepRunId)) return undefined;
    return this.appendConsole(stepRunId, {
      source: "ballet",
      kind: "warn",
      level: "warn",
      phase: "completed",
      itemId: TRUNCATION_ITEM_ID,
      message: "Console output truncated after reaching the 1 MB StepRun limit.",
      data: { truncated: true, max_bytes: STEP_RUN_CONSOLE_MAX_BYTES },
      terminal: true
    });
  }

  getThreadBinding(workItemId: string, agentRole: string): string | undefined {
    const row = this.connection().prepare(`
      SELECT thread_id AS threadId FROM thread_bindings WHERE work_item_id = ? AND agent_role = ?
    `).get(workItemId, agentRole) as { threadId: string } | undefined;
    return row?.threadId;
  }

  upsertThreadBinding(workItemId: string, agentRole: string, threadId: string): void {
    this.connection().prepare(`
      INSERT INTO thread_bindings (work_item_id, agent_role, thread_id, updated_at)
      VALUES (@workItemId, @agentRole, @threadId, @updatedAt)
      ON CONFLICT(work_item_id, agent_role) DO UPDATE SET thread_id = excluded.thread_id, updated_at = excluded.updated_at
    `).run({ workItemId, agentRole, threadId, updatedAt: now() });
  }
}
