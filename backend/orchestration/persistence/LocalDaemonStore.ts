import type Database from "better-sqlite3";
import type { ActionExecutionBinding, ActionRoleModelSelection, LocalDaemonEvent, LocalDaemonHeartbeat,
  LocalDaemonLogEntry, LocalDaemonStatus, LocalDaemonTaskClaim, LocalProviderStatus, RuntimeProvider } from "../../../shared/domain/runtime.js";
import { localProviderStatusSchema } from "../../../shared/api/runtime-schemas.js";
import { canonicalJson, type JsonValue } from "../../../shared/orchestration/primitives.js";
import { ConflictError, NotFoundError } from "./PersistenceErrors.js";
import { AgentExecutionStore } from "./AgentExecutionStore.js";

const LEASE_DURATION_MS = 60_000;
const RENEW_AFTER_MS = 20_000;
const OFFLINE_AFTER_MS = 45_000;

export class LocalDaemonStore {
  private readonly executions: AgentExecutionStore;

  constructor(private readonly connection: () => Database.Database, private readonly now: () => Date = () => new Date()) {
    this.executions = new AgentExecutionStore(connection);
  }

  actionBinding(actionId: string): ActionExecutionBinding | undefined {
    const row = this.connection().prepare("SELECT * FROM action_execution_bindings WHERE action_id = ?")
      .get(actionId) as ActionBindingRow | undefined;
    return row ? toActionBinding(row) : undefined;
  }

  putActionBinding(actionId: string, input: {
    validation: ActionRoleModelSelection; work: ActionRoleModelSelection;
  }): ActionExecutionBinding {
    this.assertBindingSupported(input.validation);
    this.assertBindingSupported(input.work);
    const provider = this.provider("codex")!;
    if (!provider.capabilities.policy.workspaceWrite) {
      throw new ConflictError("Codex cannot provide managed workspace-write for Work.");
    }
    const at = this.now().toISOString();
    this.connection().prepare(`
      INSERT INTO action_execution_bindings (
        action_id, version, validation_model, validation_reasoning_effort,
        work_model, work_reasoning_effort, updated_at
      ) VALUES (?, 3, ?, ?, ?, ?, ?)
      ON CONFLICT(action_id) DO UPDATE SET validation_model = excluded.validation_model,
        validation_reasoning_effort = excluded.validation_reasoning_effort,
        work_model = excluded.work_model, work_reasoning_effort = excluded.work_reasoning_effort,
        updated_at = excluded.updated_at
    `).run(actionId, input.validation.model, input.validation.reasoningEffort,
      input.work.model, input.work.reasoningEffort, at);
    return this.actionBinding(actionId)!;
  }

  removeActionBindings(actionIds: string[]): void {
    if (actionIds.length === 0) return;
    this.connection().transaction(() => {
      const remove = this.connection().prepare("DELETE FROM action_execution_bindings WHERE action_id = ?");
      for (const actionId of actionIds) remove.run(actionId);
    })();
  }

  heartbeat(input: LocalDaemonHeartbeat): { refreshRequested: boolean; restartRequested: boolean } {
    const at = this.now().toISOString();
    return this.connection().transaction(() => {
      const previous = this.connection().prepare("SELECT * FROM local_daemon_state WHERE singleton = 1").get() as DaemonRow | undefined;
      this.connection().prepare(`
        INSERT INTO local_daemon_state (
          singleton, status, pid, daemon_version, uptime_seconds, active_task_count, last_seen_at, recent_error
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(singleton) DO UPDATE SET status = excluded.status, pid = excluded.pid,
          daemon_version = excluded.daemon_version, uptime_seconds = excluded.uptime_seconds, active_task_count = excluded.active_task_count,
          last_seen_at = excluded.last_seen_at, recent_error = excluded.recent_error
      `).run(input.recentError ? "error" : "online", input.pid, input.daemonVersion, input.uptimeSeconds,
        input.activeTaskCount, at, input.recentError ?? null);
      for (const provider of input.providers) this.upsertProvider(provider, at);
      return {
        refreshRequested: Boolean(previous?.refresh_requested_at
          && previous.refresh_requested_at !== previous.refresh_acknowledged_at),
        restartRequested: Boolean(previous?.restart_requested_at
          && previous.restart_requested_at !== previous.restart_acknowledged_at)
      };
    })();
  }

  acknowledgeRequest(kind: "refresh" | "restart"): void {
    const field = kind === "refresh" ? "refresh_acknowledged_at" : "restart_acknowledged_at";
    const requested = kind === "refresh" ? "refresh_requested_at" : "restart_requested_at";
    this.connection().prepare(`UPDATE local_daemon_state SET ${field} = ${requested} WHERE singleton = 1`).run();
  }

  request(kind: "refresh" | "restart"): LocalDaemonStatus {
    if (kind === "restart" && this.activeClaimCount() > 0) {
      throw new ConflictError("The local daemon cannot restart while a provider task is active.");
    }
    const field = kind === "refresh" ? "refresh_requested_at" : "restart_requested_at";
    const at = this.now().toISOString();
    this.connection().prepare(`
      INSERT INTO local_daemon_state (singleton, status, pid, daemon_version, uptime_seconds, active_task_count, last_seen_at, ${field})
      VALUES (1, 'offline', 1, 'unknown', 0, 0, ?, ?)
      ON CONFLICT(singleton) DO UPDATE SET ${field} = excluded.${field}
    `).run(at, at);
    return this.status();
  }

  status(): LocalDaemonStatus {
    const row = this.connection().prepare("SELECT * FROM local_daemon_state WHERE singleton = 1").get() as DaemonRow | undefined;
    const providers = [this.provider("codex") ?? offlineProvider(this.now())];
    if (!row) return {
      status: "offline", daemonVersion: "unknown", uptimeSeconds: 0, activeTaskCount: 0,
      lastSeenAt: new Date(0).toISOString(), refreshRequested: false, restartRequested: false, providers
    };
    const stale = this.now().getTime() - new Date(row.last_seen_at).getTime() > OFFLINE_AFTER_MS;
    return {
      status: stale ? "offline" : row.status, pid: row.pid, daemonVersion: row.daemon_version,
      uptimeSeconds: row.uptime_seconds, activeTaskCount: Math.max(row.active_task_count, this.activeClaimCount()),
      lastSeenAt: row.last_seen_at, recentError: row.recent_error ?? undefined,
      refreshRequested: Boolean(row.refresh_requested_at && row.refresh_requested_at !== row.refresh_acknowledged_at),
      restartRequested: Boolean(row.restart_requested_at && row.restart_requested_at !== row.restart_acknowledged_at),
      providers: stale ? providers.map((provider) => ({ ...provider, health: "offline" as const, busy: false })) : providers
    };
  }

  provider(provider: RuntimeProvider): LocalProviderStatus | undefined {
    const row = this.connection().prepare("SELECT * FROM local_provider_capabilities WHERE provider = ?").get(provider) as ProviderRow | undefined;
    if (!row) return undefined;
    return localProviderStatusSchema.parse({
      provider: row.provider, cliVersion: row.cli_version ?? undefined, authStatus: row.auth_status,
      health: row.health, healthMessage: row.health_message ?? undefined,
      capabilities: JSON.parse(row.capabilities_json), busy: Boolean(row.busy), updatedAt: row.updated_at
    });
  }

  private assertBindingSupported(input: {
    model: string; reasoningEffort: string;
  }): void {
    const provider = this.provider("codex");
    if (!provider || provider.health !== "ready") throw new ConflictError("Codex is not ready on the local daemon.");
    const model = provider.capabilities.models.find(({ id }) => id === input.model);
    if (!model) throw new ConflictError(`Model ${input.model} is unavailable for Codex.`);
    if (!model.reasoningOptions.includes(input.reasoningEffort)) throw new ConflictError(`Reasoning effort ${input.reasoningEffort} is unavailable for model ${input.model}.`);
  }

  private activeClaimCount(): number {
    const row = this.connection().prepare(`
      SELECT COUNT(*) AS count FROM execution_tasks
      WHERE status = 'running' AND claim_fencing > 0 AND daemon_output_key IS NULL
    `).get() as { count: number };
    return row.count;
  }

  claim(provider: RuntimeProvider): LocalDaemonTaskClaim | undefined {
    const at = this.now();
    return this.connection().transaction(() => {
      const row = this.connection().prepare(`
        SELECT execution_task_id FROM execution_tasks
        WHERE status = 'running' AND provider = ? AND claim_fencing = 0
          AND daemon_output IS NULL AND daemon_error_message IS NULL AND cancel_requested_at IS NULL
        ORDER BY created_at, execution_task_id LIMIT 1
      `).get(provider) as { execution_task_id: string } | undefined;
      if (!row) return undefined;
      const leaseUntil = new Date(at.getTime() + LEASE_DURATION_MS).toISOString();
      const claimed = this.connection().prepare(`
        UPDATE execution_tasks SET claim_fencing = 1, lease_until = ?, updated_at = ?
        WHERE execution_task_id = ? AND status = 'running' AND claim_fencing = 0
      `).run(leaseUntil, at.toISOString(), row.execution_task_id);
      if (claimed.changes !== 1) return undefined;
      const task = this.executions.requireTask(row.execution_task_id);
      return {
        taskId: task.taskId, fencing: 1, leaseUntil, leaseDurationMs: LEASE_DURATION_MS,
        renewAfterMs: RENEW_AFTER_MS, spec: task.spec,
        permissions: { workspaceAccess: task.spec.permissions.workspaceAccess }
      };
    })();
  }

  renew(taskId: string, fencing: number): { accepted: boolean; leaseUntil?: string; cancelRequested: boolean } {
    const at = this.now();
    const row = this.claimedTask(taskId);
    if (!row || row.claim_fencing !== fencing || row.status !== "running") return { accepted: false, cancelRequested: false };
    if (new Date(row.lease_until ?? 0).getTime() < at.getTime()) return { accepted: false, cancelRequested: Boolean(row.cancel_requested_at) };
    const leaseUntil = new Date(at.getTime() + LEASE_DURATION_MS).toISOString();
    this.connection().prepare("UPDATE execution_tasks SET lease_until = ?, updated_at = ? WHERE execution_task_id = ? AND claim_fencing = ?")
      .run(leaseUntil, at.toISOString(), taskId, fencing);
    return { accepted: true, leaseUntil, cancelRequested: Boolean(row.cancel_requested_at) };
  }

  appendEvents(taskId: string, fencing: number, events: LocalDaemonEvent[]): number {
    this.requireActiveClaim(taskId, fencing);
    for (const event of events) this.executions.appendEvent(taskId, { ...event, data: event.data as JsonValue | undefined });
    return events.length;
  }

  complete(taskId: string, fencing: number, providerOutcomeKey: string, rawOutput: string): boolean {
    return this.recordDaemonTerminal(taskId, fencing, providerOutcomeKey, rawOutput, undefined);
  }

  fail(taskId: string, fencing: number, providerOutcomeKey: string, errorMessage: string): boolean {
    return this.recordDaemonTerminal(taskId, fencing, providerOutcomeKey, undefined, errorMessage);
  }

  terminal(taskId: string): { providerOutcomeKey: string; rawOutput?: string; errorMessage?: string } | undefined {
    const row = this.claimedTask(taskId);
    if (!row?.daemon_output_key) return undefined;
    return { providerOutcomeKey: row.daemon_output_key,
      rawOutput: row.daemon_output ?? undefined, errorMessage: row.daemon_error_message ?? undefined };
  }

  leaseExpired(taskId: string): boolean {
    const row = this.claimedTask(taskId);
    return Boolean(row?.claim_fencing && !row.daemon_output_key
      && new Date(row.lease_until ?? 0).getTime() <= this.now().getTime());
  }

  requestCancellation(taskId: string): void {
    const result = this.connection().prepare(`
      UPDATE execution_tasks SET cancel_requested_at = COALESCE(cancel_requested_at, ?), updated_at = ?
      WHERE execution_task_id = ? AND status = 'running'
    `).run(this.now().toISOString(), this.now().toISOString(), taskId);
    if (result.changes !== 1) throw new ConflictError(`Execution task ${taskId} is not running.`);
  }

  appendLogs(lines: string[]): number {
    const at = this.now().toISOString();
    const insert = this.connection().prepare("INSERT INTO local_daemon_logs (level, message, created_at) VALUES (?, ?, ?)");
    this.connection().transaction(() => {
      for (const line of lines) insert.run(levelFor(line), line, at);
      this.connection().prepare(`DELETE FROM local_daemon_logs WHERE id NOT IN (
        SELECT id FROM local_daemon_logs ORDER BY id DESC LIMIT 1000
      )`).run();
    })();
    return lines.length;
  }

  logs(limit: number): LocalDaemonLogEntry[] {
    return (this.connection().prepare(`
      SELECT id, level, message, created_at FROM local_daemon_logs ORDER BY id DESC LIMIT ?
    `).all(limit) as Array<{ id: number; level: LocalDaemonLogEntry["level"]; message: string; created_at: string }>)
      .reverse().map((row) => ({ id: row.id, level: row.level, message: row.message, createdAt: row.created_at }));
  }

  private upsertProvider(provider: LocalProviderStatus, at: string): void {
    const parsed = localProviderStatusSchema.parse(provider);
    this.connection().prepare(`
      INSERT INTO local_provider_capabilities (
        provider, cli_version, auth_status, health, health_message, capabilities_json, busy, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET cli_version = excluded.cli_version,
        auth_status = excluded.auth_status, health = excluded.health, health_message = excluded.health_message,
        capabilities_json = excluded.capabilities_json, busy = excluded.busy, updated_at = excluded.updated_at
    `).run(parsed.provider, parsed.cliVersion ?? null, parsed.authStatus, parsed.health,
      parsed.healthMessage ?? null, canonical(parsed.capabilities), parsed.busy ? 1 : 0, at);
  }

  private recordDaemonTerminal(
    taskId: string, fencing: number, providerOutcomeKey: string, rawOutput?: string, errorMessage?: string
  ): boolean {
    const existing = this.claimedTask(taskId);
    if (!existing) throw new NotFoundError(`Execution task ${taskId} was not found.`);
    if (existing.daemon_output_key) {
      if (existing.daemon_output_key === providerOutcomeKey
        && existing.daemon_output === (rawOutput ?? null)
        && existing.daemon_error_message === (errorMessage ?? null)) return false;
      throw new ConflictError(`Execution task ${taskId} already has a different daemon terminal.`);
    }
    const update = this.connection().prepare(`
      UPDATE execution_tasks SET daemon_output_key = ?, daemon_output = ?, daemon_error_message = ?, updated_at = ?
      WHERE execution_task_id = ? AND status = 'running' AND claim_fencing = ?
        AND daemon_output_key IS NULL AND lease_until > ?
    `).run(providerOutcomeKey, rawOutput ?? null, errorMessage ?? null, this.now().toISOString(),
      taskId, fencing, this.now().toISOString());
    if (update.changes !== 1) throw new ConflictError(`Execution task ${taskId} has a stale or expired claim.`);
    return true;
  }

  private requireActiveClaim(taskId: string, fencing: number): void {
    const row = this.claimedTask(taskId);
    if (!row) throw new NotFoundError(`Execution task ${taskId} was not found.`);
    if (row.status !== "running" || row.claim_fencing !== fencing
      || new Date(row.lease_until ?? 0).getTime() <= this.now().getTime()) {
      throw new ConflictError(`Execution task ${taskId} has a stale or expired claim.`);
    }
  }

  private claimedTask(taskId: string): ClaimedTaskRow | undefined {
    return this.connection().prepare(`
      SELECT status, claim_fencing, lease_until, cancel_requested_at,
        daemon_output_key, daemon_output, daemon_error_message
      FROM execution_tasks WHERE execution_task_id = ?
    `).get(taskId) as ClaimedTaskRow | undefined;
  }
}

interface ActionBindingRow { action_id: string; validation_model: string; validation_reasoning_effort: string;
  work_model: string; work_reasoning_effort: string; updated_at: string }
interface DaemonRow { status: LocalDaemonStatus["status"]; pid: number; daemon_version: string; uptime_seconds: number;
  active_task_count: number; last_seen_at: string; recent_error: string | null; refresh_requested_at: string | null;
  refresh_acknowledged_at: string | null; restart_requested_at: string | null; restart_acknowledged_at: string | null }
interface ProviderRow {
  provider: RuntimeProvider; cli_version: string | null; auth_status: LocalProviderStatus["authStatus"];
  health: LocalProviderStatus["health"]; health_message: string | null; capabilities_json: string;
  busy: 0 | 1; updated_at: string;
}
interface ClaimedTaskRow {
  status: string; claim_fencing: number; lease_until: string | null; cancel_requested_at: string | null;
  daemon_output_key: string | null; daemon_output: string | null; daemon_error_message: string | null;
}

const toActionBinding = (row: ActionBindingRow): ActionExecutionBinding => ({
  version: 3, actionId: row.action_id,
  validation: { model: row.validation_model, reasoningEffort: row.validation_reasoning_effort },
  work: { model: row.work_model, reasoningEffort: row.work_reasoning_effort },
  updatedAt: row.updated_at
});
const canonical = (value: unknown): string => canonicalJson(JSON.parse(JSON.stringify(value)) as JsonValue);
const levelFor = (line: string): LocalDaemonLogEntry["level"] => /\berror\b/i.test(line) ? "error" : /\bwarn/i.test(line) ? "warn" : "info";
const offlineProvider = (now: Date): LocalProviderStatus => ({
  provider: "codex", authStatus: "unknown", health: "offline", busy: false, updatedAt: now.toISOString(),
  capabilities: { models: [], supportsResume: false, supportsStructuredOutput: false,
    policy: { workspaceWrite: false }, refreshedAt: now.toISOString() }
});
