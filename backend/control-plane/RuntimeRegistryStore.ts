import type Database from "better-sqlite3";
import type { z } from "zod";
import type {
  ProjectCheckout,
  RuntimeBackend,
  RuntimeCapabilities,
  RuntimeDevice,
  RuntimeProvider
} from "../../shared/domain/runtime.js";
import type { daemonHeartbeatBodySchema } from "../../shared/api/runtime-schemas.js";
import { parseObject } from "./json.js";
import { ControlPlaneConflictError, ControlPlaneNotFoundError } from "./errors.js";

export type DaemonHeartbeat = z.infer<typeof daemonHeartbeatBodySchema>;

interface DeviceRow {
  device_id: string;
  project_id: string;
  daemon_id: string;
  hostname: string;
  display_name: string;
  platform: "darwin";
  architecture: "arm64" | "x64";
  daemon_version: string;
  uptime_seconds: number;
  status: RuntimeDevice["status"];
  paired_at: string;
  connected_at: string | null;
  last_seen_at: string;
  restart_requested_at: string | null;
  restart_acknowledged_at: string | null;
  recent_error: string | null;
  updated_at: string;
}

interface BackendRow {
  backend_id: string;
  project_id: string;
  device_id: string;
  provider: RuntimeProvider;
  cli_version: string | null;
  executable_path: string | null;
  auth_status: RuntimeBackend["authStatus"];
  health: RuntimeBackend["health"];
  health_message: string | null;
  capabilities_json: string;
  created_at: string;
  updated_at: string;
  assigned_agents: number;
  active_runs: number;
}

export class RuntimeRegistryStore {
  constructor(private readonly connection: () => Database.Database, private readonly now: () => Date) {}

  list(projectId: string, search?: string, status: "all" | "online" | "issues" = "all"): RuntimeDevice[] {
    const clauses = ["d.revoked_at IS NULL", "d.project_id = ?"];
    const params: unknown[] = [projectId];
    if (search) {
      clauses.push("(d.display_name LIKE ? OR d.hostname LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status === "online") clauses.push("d.status = 'online'");
    if (status === "issues") clauses.push("(d.status = 'offline' OR EXISTS (SELECT 1 FROM runtime_backends b WHERE b.device_id = d.device_id AND b.health != 'ready'))");
    const rows = this.connection().prepare(`
      SELECT d.* FROM runtime_devices d WHERE ${clauses.join(" AND ")} ORDER BY d.display_name, d.device_id
    `).all(...params) as DeviceRow[];
    return rows.map((row) => this.toDevice(row));
  }

  get(deviceId: string): RuntimeDevice | undefined {
    const row = this.connection().prepare("SELECT * FROM runtime_devices WHERE device_id = ? AND revoked_at IS NULL")
      .get(deviceId) as DeviceRow | undefined;
    return row ? this.toDevice(row) : undefined;
  }

  require(deviceId: string): RuntimeDevice {
    const device = this.get(deviceId);
    if (!device) throw new ControlPlaneNotFoundError(`Runtime device ${deviceId} was not found.`);
    return device;
  }

  getBackend(backendId: string): RuntimeBackend | undefined {
    const row = this.backendStatement("WHERE b.backend_id = ?").get(backendId) as BackendRow | undefined;
    return row ? toBackend(row) : undefined;
  }

  restoreLocalBackends(projectId: string, deviceId: string, backends: Array<{ id: string; provider: RuntimeProvider }>): void {
    const timestamp = this.now().toISOString();
    const capabilities: RuntimeCapabilities = {
      models: [], supportsResume: false, supportsStructuredOutput: false,
      policy: { workspaceWrite: false, networkControl: false, readOnlyRoots: false },
      refreshedAt: timestamp
    };
    const transaction = this.connection().transaction(() => {
      for (const backend of backends) {
        const existing = this.connection().prepare("SELECT project_id, device_id, provider FROM runtime_backends WHERE backend_id = ?")
          .get(backend.id) as { project_id: string; device_id: string; provider: RuntimeProvider } | undefined;
        if (existing && (existing.project_id !== projectId || existing.device_id !== deviceId || existing.provider !== backend.provider)) {
          throw new ControlPlaneConflictError(`Runtime backend ${backend.id} conflicts with persisted state.`);
        }
        if (!existing) {
          this.connection().prepare(`
            INSERT INTO runtime_backends (
              backend_id, project_id, device_id, provider, auth_status, health,
              capabilities_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'unknown', 'offline', ?, ?, ?)
          `).run(backend.id, projectId, deviceId, backend.provider, JSON.stringify(capabilities), timestamp, timestamp);
        }
      }
    });
    transaction();
  }

  heartbeat(deviceId: string, input: DaemonHeartbeat): { device: RuntimeDevice; refreshRequested: boolean; restartRequested: boolean } {
    const transaction = this.connection().transaction(() => {
      const current = this.require(deviceId);
      const timestamp = this.now().toISOString();
      this.connection().prepare(`
        UPDATE runtime_devices SET daemon_version = ?, uptime_seconds = ?, status = 'online',
          connected_at = COALESCE(connected_at, ?), last_seen_at = ?, offline_at = NULL,
          recent_error = ?, updated_at = ? WHERE device_id = ? AND revoked_at IS NULL
      `).run(input.daemonVersion, input.uptimeSeconds, timestamp, timestamp, input.recentError ?? null, timestamp, deviceId);
      const backendIds = new Set(input.backends.map((backend) => backend.id));
      for (const backend of input.backends) this.upsertBackend(current.projectId, deviceId, backend, timestamp);
      const existing = this.connection().prepare("SELECT backend_id FROM runtime_backends WHERE device_id = ?").all(deviceId) as Array<{ backend_id: string }>;
      for (const backend of existing) {
        if (!backendIds.has(backend.backend_id)) {
          this.connection().prepare("UPDATE runtime_backends SET health = 'offline', updated_at = ? WHERE backend_id = ?")
            .run(timestamp, backend.backend_id);
        }
      }
      return {
        device: this.require(deviceId),
        refreshRequested: this.hasUnacknowledgedRequest(deviceId, "refresh"),
        restartRequested: this.hasUnacknowledgedRequest(deviceId, "restart")
      };
    });
    return transaction() as { device: RuntimeDevice; refreshRequested: boolean; restartRequested: boolean };
  }

  acknowledgeRequests(deviceId: string, input: { refresh?: boolean; restart?: boolean }): void {
    const timestamp = this.now().toISOString();
    if (input.refresh) this.connection().prepare("UPDATE runtime_devices SET refresh_acknowledged_at = refresh_requested_at, updated_at = ? WHERE device_id = ?").run(timestamp, deviceId);
    if (input.restart) this.connection().prepare("UPDATE runtime_devices SET restart_acknowledged_at = restart_requested_at, updated_at = ? WHERE device_id = ?").run(timestamp, deviceId);
  }

  requestRefresh(deviceId: string, requestId: string): RuntimeDevice {
    this.require(deviceId);
    this.connection().prepare("UPDATE runtime_devices SET refresh_requested_at = ?, refresh_acknowledged_at = NULL, updated_at = ? WHERE device_id = ?")
      .run(requestId, this.now().toISOString(), deviceId);
    return this.require(deviceId);
  }

  pendingRefreshRequestId(deviceId: string): string | undefined {
    const row = this.connection().prepare(`
      SELECT refresh_requested_at AS requested, refresh_acknowledged_at AS acknowledged
      FROM runtime_devices WHERE device_id = ? AND revoked_at IS NULL
    `).get(deviceId) as { requested: string | null; acknowledged: string | null } | undefined;
    return row?.requested && row.requested !== row.acknowledged ? row.requested : undefined;
  }

  requestRestart(deviceId: string): RuntimeDevice {
    this.require(deviceId);
    this.connection().prepare("UPDATE runtime_devices SET restart_requested_at = ?, restart_acknowledged_at = NULL, updated_at = ? WHERE device_id = ?")
      .run(this.now().toISOString(), this.now().toISOString(), deviceId);
    return this.require(deviceId);
  }

  markOffline(offlineBefore: string): string[] {
    const rows = this.connection().prepare(`
      SELECT device_id FROM runtime_devices WHERE status = 'online' AND last_seen_at < ? AND revoked_at IS NULL
    `).all(offlineBefore) as Array<{ device_id: string }>;
    if (rows.length === 0) return [];
    const timestamp = this.now().toISOString();
    const transaction = this.connection().transaction(() => {
      for (const row of rows) {
        this.connection().prepare("UPDATE runtime_devices SET status = 'offline', offline_at = ?, updated_at = ? WHERE device_id = ?")
          .run(timestamp, timestamp, row.device_id);
        this.connection().prepare("UPDATE runtime_backends SET health = 'offline', updated_at = ? WHERE device_id = ?")
          .run(timestamp, row.device_id);
      }
    });
    transaction();
    return rows.map((row) => row.device_id);
  }

  appendLog(deviceId: string, level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>): void {
    const device = this.require(deviceId);
    this.connection().prepare("INSERT INTO device_logs (project_id, device_id, level, message, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(device.projectId, deviceId, level, message, data ? JSON.stringify(data) : null, this.now().toISOString());
  }

  logs(deviceId: string, limit = 200) {
    this.require(deviceId);
    const rows = this.connection().prepare(`
      SELECT id, level, message, data_json, created_at FROM device_logs WHERE device_id = ? ORDER BY id DESC LIMIT ?
    `).all(deviceId, Math.min(Math.max(limit, 1), 1000)) as Array<{ id: number; level: string; message: string; data_json: string | null; created_at: string }>;
    return rows.map((row) => ({ id: row.id, level: row.level, message: row.message, data: parseObject(row.data_json), createdAt: row.created_at }));
  }

  private upsertBackend(projectId: string, deviceId: string, backend: DaemonHeartbeat["backends"][number], timestamp: string): void {
    const owner = this.connection().prepare("SELECT device_id FROM runtime_backends WHERE backend_id = ?").get(backend.id) as { device_id: string } | undefined;
    if (owner && owner.device_id !== deviceId) throw new ControlPlaneConflictError(`Runtime backend ${backend.id} belongs to another device.`);
    this.connection().prepare(`
      INSERT INTO runtime_backends (
        backend_id, project_id, device_id, provider, cli_version, executable_path, auth_status,
        health, health_message, capabilities_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(backend_id) DO UPDATE SET cli_version = excluded.cli_version,
        executable_path = excluded.executable_path, auth_status = excluded.auth_status,
        health = excluded.health, health_message = excluded.health_message,
        capabilities_json = excluded.capabilities_json, updated_at = excluded.updated_at
    `).run(backend.id, projectId, deviceId, backend.provider, backend.cliVersion ?? null,
      backend.executablePath ?? null, backend.authStatus, backend.health, backend.healthMessage ?? null,
      JSON.stringify(backend.capabilities), timestamp, timestamp);
  }

  private backendStatement(where: string): Database.Statement {
    return this.connection().prepare(`
      SELECT b.*,
        (SELECT COUNT(*) FROM agent_runtime_attachments x WHERE x.runtime_backend_id = b.backend_id) AS assigned_agents,
        (SELECT COUNT(*) FROM execution_tasks t WHERE t.runtime_backend_id = b.backend_id
          AND t.status IN ('claimed','preparing','running')) AS active_runs
      FROM runtime_backends b JOIN runtime_devices d ON d.device_id = b.device_id
      ${where} AND d.revoked_at IS NULL
    `);
  }

  private hasUnacknowledgedRequest(deviceId: string, kind: "refresh" | "restart"): boolean {
    const row = this.connection().prepare(`
      SELECT ${kind}_requested_at AS requested, ${kind}_acknowledged_at AS acknowledged
      FROM runtime_devices WHERE device_id = ?
    `).get(deviceId) as { requested: string | null; acknowledged: string | null };
    return Boolean(row.requested && row.requested !== row.acknowledged);
  }

  private toDevice(row: DeviceRow): RuntimeDevice {
    const backendRows = this.backendStatement("WHERE b.device_id = ?").all(row.device_id) as BackendRow[];
    const checkoutRow = this.connection().prepare(`
      SELECT * FROM project_checkouts WHERE project_id = ? AND device_id = ? LIMIT 1
    `).get(row.project_id, row.device_id) as {
      checkout_id: string; project_id: string; repository_url: string; checkout_path: string;
      head_sha: string | null; config_hash: string | null; dirty: 0 | 1;
      last_inspected_at: string | null; created_at: string; updated_at: string;
    } | undefined;
    const checkout: ProjectCheckout | undefined = checkoutRow ? {
      id: checkoutRow.checkout_id, projectId: checkoutRow.project_id, deviceId: row.device_id,
      repositoryUrl: checkoutRow.repository_url, path: checkoutRow.checkout_path,
      headSha: checkoutRow.head_sha ?? undefined, configHash: checkoutRow.config_hash ?? undefined,
      dirty: Boolean(checkoutRow.dirty), lastInspectedAt: checkoutRow.last_inspected_at ?? undefined,
      createdAt: checkoutRow.created_at, updatedAt: checkoutRow.updated_at
    } : undefined;
    const backends = backendRows.map(toBackend);
    return {
      id: row.device_id,
      projectId: row.project_id,
      hostname: row.hostname,
      displayName: row.display_name,
      platform: row.platform,
      architecture: row.architecture,
      status: row.status,
      diagnostics: {
        daemonId: row.daemon_id,
        daemonVersion: row.daemon_version,
        uptimeSeconds: row.uptime_seconds,
        lastSeenAt: row.last_seen_at,
        connectedAt: row.connected_at ?? undefined,
        restartRequestedAt: row.restart_requested_at && row.restart_requested_at !== row.restart_acknowledged_at
          ? row.restart_requested_at
          : undefined,
        recentError: row.recent_error ?? undefined
      },
      backends,
      checkout,
      activeRunCount: backends.reduce((sum, backend) => sum + backend.activeRunCount, 0),
      busyBackendCount: backends.filter((backend) => backend.busy).length,
      createdAt: row.paired_at,
      updatedAt: row.updated_at
    };
  }
}

const toBackend = (row: BackendRow): RuntimeBackend => ({
  id: row.backend_id,
  projectId: row.project_id,
  deviceId: row.device_id,
  provider: row.provider,
  cliVersion: row.cli_version ?? undefined,
  executablePath: row.executable_path ?? undefined,
  authStatus: row.auth_status,
  health: row.health,
  healthMessage: row.health_message ?? undefined,
  capabilities: (parseObject(row.capabilities_json) ?? {}) as unknown as RuntimeCapabilities,
  assignedAgentCount: row.assigned_agents,
  activeRunCount: row.active_runs,
  busy: row.active_runs > 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
