import type Database from "better-sqlite3";
import { v4 as uuid } from "uuid";
import type { ProjectCheckout } from "../../shared/domain/runtime.js";
import { ControlPlaneConflictError, ControlPlaneNotFoundError } from "./errors.js";

export interface RegisteredProject {
  id: string;
  repositoryUrl: string;
  checkoutPath: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProjectRow {
  project_id: string;
  repository_url: string;
  default_checkout_path: string;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
}

interface CheckoutRow {
  checkout_id: string;
  project_id: string;
  device_id: string;
  repository_url: string;
  checkout_path: string;
  head_sha: string | null;
  config_hash: string | null;
  dirty: 0 | 1;
  last_inspected_at: string | null;
  created_at: string;
  updated_at: string;
}

export class ProjectStore {
  constructor(private readonly connection: () => Database.Database, private readonly now: () => Date) {}

  register(input: { id: string; repositoryUrl: string; checkoutPath: string }): RegisteredProject {
    const timestamp = this.now().toISOString();
    const transaction = this.connection().transaction(() => {
      const active = this.active();
      if (active && active.id !== input.id && this.hasActiveRuns(active.id)) {
        throw new ControlPlaneConflictError(`Project ${active.id} cannot be deactivated while it has an active Run.`);
      }
      this.connection().prepare("UPDATE projects SET is_active = 0 WHERE is_active = 1").run();
      this.connection().prepare(`
        INSERT INTO projects (
          project_id, repository_url, default_checkout_path, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET repository_url = excluded.repository_url,
          default_checkout_path = excluded.default_checkout_path, is_active = 1, updated_at = excluded.updated_at
      `).run(input.id, input.repositoryUrl, input.checkoutPath, timestamp, timestamp);
      return this.require(input.id);
    });
    return transaction() as RegisteredProject;
  }

  private hasActiveRuns(projectId: string): boolean {
    const task = this.connection().prepare(`
      SELECT 1 FROM execution_tasks WHERE project_id = ? AND status IN ('queued','claimed','preparing','running') LIMIT 1
    `).get(projectId);
    const hasLoopTable = Boolean(this.connection().prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'loop_runs'").get());
    const loop = hasLoopTable ? this.connection().prepare(`
      SELECT 1 FROM loop_runs WHERE project_id = ? AND status IN ('running','waiting_for_human') LIMIT 1
    `).get(projectId) : undefined;
    const finalization = this.connection().prepare(`
      SELECT 1 FROM root_run_finalizations WHERE project_id = ? AND status = 'pending' LIMIT 1
    `).get(projectId);
    return Boolean(task || loop || finalization);
  }

  active(): RegisteredProject | undefined {
    const row = this.connection().prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get() as ProjectRow | undefined;
    return row ? toProject(row) : undefined;
  }

  require(projectId: string): RegisteredProject {
    const row = this.connection().prepare("SELECT * FROM projects WHERE project_id = ?").get(projectId) as ProjectRow | undefined;
    if (!row) throw new ControlPlaneNotFoundError(`Project ${projectId} was not found.`);
    return toProject(row);
  }

  updateCheckout(deviceId: string, input: {
    repositoryUrl: string;
    path: string;
    headSha?: string;
    configHash?: string;
    dirty: boolean;
    lastInspectedAt?: string;
  }): void {
    const device = this.connection().prepare("SELECT project_id FROM runtime_devices WHERE device_id = ? AND revoked_at IS NULL")
      .get(deviceId) as { project_id: string } | undefined;
    if (!device) return;
    const timestamp = this.now().toISOString();
    const existing = this.connection().prepare("SELECT checkout_id, repository_url, checkout_path, created_at FROM project_checkouts WHERE project_id = ? AND device_id = ?")
      .get(device.project_id, deviceId) as { checkout_id: string; repository_url: string; checkout_path: string; created_at: string } | undefined;
    const identityChanged = Boolean(existing && (existing.repository_url !== input.repositoryUrl || existing.checkout_path !== input.path));
    this.connection().prepare(`
      INSERT INTO project_checkouts (
        checkout_id, project_id, device_id, repository_url, checkout_path, head_sha, config_hash,
        dirty, last_inspected_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, device_id) DO UPDATE SET checkout_id = excluded.checkout_id,
        repository_url = excluded.repository_url, checkout_path = excluded.checkout_path,
        head_sha = excluded.head_sha, config_hash = excluded.config_hash, dirty = excluded.dirty,
        last_inspected_at = excluded.last_inspected_at, updated_at = excluded.updated_at
    `).run(identityChanged || !existing ? uuid() : existing.checkout_id, device.project_id, deviceId,
      input.repositoryUrl, input.path, input.headSha ?? null, input.configHash ?? null, input.dirty ? 1 : 0,
      input.lastInspectedAt ?? timestamp, identityChanged || !existing ? timestamp : existing.created_at, timestamp);
  }

  checkout(projectId: string, deviceId: string): ProjectCheckout | undefined {
    const row = this.connection().prepare("SELECT * FROM project_checkouts WHERE project_id = ? AND device_id = ?")
      .get(projectId, deviceId) as CheckoutRow | undefined;
    return row ? {
      id: row.checkout_id,
      projectId: row.project_id,
      deviceId: row.device_id,
      repositoryUrl: row.repository_url,
      path: row.checkout_path,
      headSha: row.head_sha ?? undefined,
      configHash: row.config_hash ?? undefined,
      dirty: Boolean(row.dirty),
      lastInspectedAt: row.last_inspected_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } : undefined;
  }
}

const toProject = (row: ProjectRow): RegisteredProject => ({
  id: row.project_id,
  repositoryUrl: row.repository_url,
  checkoutPath: row.default_checkout_path,
  active: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
