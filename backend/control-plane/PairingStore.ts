import type Database from "better-sqlite3";
import { v4 as uuid } from "uuid";
import type { PairingSession } from "../../shared/domain/runtime.js";
import { opaqueToken, pairingCode, tokenHash } from "./crypto.js";
import { ControlPlaneConflictError, ControlPlaneGoneError, ControlPlaneNotFoundError, ControlPlaneUnauthorizedError } from "./errors.js";

export interface DaemonIdentity {
  deviceId: string;
  tokenId: string;
}

export interface PairingView extends PairingSession {
  deviceId?: string;
}

export interface DaemonPairingPoll {
  deviceCode: string;
  hostname: string;
  displayName?: string;
  platform: "darwin";
  architecture: "arm64" | "x64";
  daemonVersion: string;
  daemonId: string;
}

interface PairingRow {
  pairing_id: string;
  project_id: string;
  device_code: string;
  user_code: string;
  display_name: string | null;
  status: PairingSession["status"];
  expires_at: string;
  approved_at: string | null;
  claimed_at: string | null;
  device_id: string | null;
}

export class PairingStore {
  constructor(private readonly connection: () => Database.Database, private readonly now: () => Date) {}

  create(projectId: string, displayName?: string, ttlSeconds = 10 * 60): PairingView {
    const id = uuid();
    const deviceCode = opaqueToken();
    const userCode = pairingCode();
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000).toISOString();
    this.connection().prepare(`
      INSERT INTO pairing_sessions (
        pairing_id, project_id, device_code, user_code, display_name, status, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, projectId, deviceCode, userCode, displayName ?? null, expiresAt, createdAt.toISOString());
    return { id, deviceCode, userCode, status: "pending", expiresAt };
  }

  get(pairingId: string): PairingView {
    return toPairing(this.requireRow(pairingId), this.now().toISOString());
  }

  approve(pairingId: string): PairingView {
    const row = this.requireUsable(pairingId);
    if (row.status !== "pending") throw new ControlPlaneConflictError(`Pairing session is already ${row.status}.`);
    const timestamp = this.now().toISOString();
    this.connection().prepare("UPDATE pairing_sessions SET status = 'approved', approved_at = ? WHERE pairing_id = ? AND status = 'pending'")
      .run(timestamp, pairingId);
    return this.get(pairingId);
  }

  poll(input: DaemonPairingPoll): { status: "pending" | "claimed"; deviceId?: string; daemonToken?: string } {
    const transaction = this.connection().transaction(() => {
      const row = this.connection().prepare("SELECT * FROM pairing_sessions WHERE device_code = ?")
        .get(input.deviceCode) as PairingRow | undefined;
      if (!row) throw new ControlPlaneUnauthorizedError("Invalid device pairing code.");
      const usable = this.requireUsable(row.pairing_id);
      if (usable.status === "pending") return { status: "pending" as const };
      if (usable.status !== "approved") throw new ControlPlaneGoneError("Pairing code has already been claimed.");

      const duplicate = this.connection().prepare("SELECT device_id FROM runtime_devices WHERE daemon_id = ? AND revoked_at IS NULL")
        .get(input.daemonId) as { device_id: string } | undefined;
      if (duplicate) throw new ControlPlaneConflictError("Daemon is already paired.");
      const deviceId = uuid();
      const daemonToken = opaqueToken();
      const timestamp = this.now().toISOString();
      this.connection().prepare(`
        INSERT INTO runtime_devices (
          device_id, project_id, daemon_id, hostname, display_name, platform, architecture,
          daemon_version, status, paired_at, last_seen_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'offline', ?, ?, ?)
      `).run(deviceId, usable.project_id, input.daemonId, input.hostname,
        input.displayName ?? usable.display_name ?? input.hostname, input.platform, input.architecture,
        input.daemonVersion, timestamp, timestamp, timestamp);
      this.connection().prepare("INSERT INTO daemon_tokens (token_id, device_id, token_hash, created_at) VALUES (?, ?, ?, ?)")
        .run(uuid(), deviceId, tokenHash(daemonToken), timestamp);
      this.connection().prepare(`
        UPDATE pairing_sessions SET status = 'claimed', claimed_at = ?, device_id = ? WHERE pairing_id = ?
      `).run(timestamp, deviceId, usable.pairing_id);
      return { status: "claimed" as const, deviceId, daemonToken };
    });
    return transaction() as { status: "pending" | "claimed"; deviceId?: string; daemonToken?: string };
  }

  authenticateDaemon(rawToken: string): DaemonIdentity {
    const row = this.connection().prepare(`
      SELECT t.token_id, t.device_id FROM daemon_tokens t JOIN runtime_devices d ON d.device_id = t.device_id
      WHERE t.token_hash = ? AND t.revoked_at IS NULL AND d.revoked_at IS NULL
    `).get(tokenHash(rawToken)) as { token_id: string; device_id: string } | undefined;
    if (!row) throw new ControlPlaneUnauthorizedError("Invalid daemon token.");
    this.connection().prepare("UPDATE daemon_tokens SET last_used_at = ? WHERE token_id = ?")
      .run(this.now().toISOString(), row.token_id);
    return { deviceId: row.device_id, tokenId: row.token_id };
  }

  restoreLocalDevice(input: Omit<DaemonPairingPoll, "deviceCode"> & { projectId: string; deviceId: string; daemonToken: string }): void {
    const transaction = this.connection().transaction(() => {
      const existing = this.connection().prepare(`
        SELECT device_id, project_id, daemon_id, revoked_at FROM runtime_devices
        WHERE device_id = ? OR daemon_id = ? LIMIT 1
      `).get(input.deviceId, input.daemonId) as {
        device_id: string; project_id: string; daemon_id: string; revoked_at: string | null;
      } | undefined;
      if (existing?.revoked_at) throw new ControlPlaneConflictError("A revoked runtime device cannot be recovered automatically.");
      if (existing && (existing.device_id !== input.deviceId || existing.daemon_id !== input.daemonId || existing.project_id !== input.projectId)) {
        throw new ControlPlaneConflictError("Stored runtime identity conflicts with the active project.");
      }
      const timestamp = this.now().toISOString();
      if (!existing) {
        this.connection().prepare(`
          INSERT INTO runtime_devices (
            device_id, project_id, daemon_id, hostname, display_name, platform, architecture,
            daemon_version, status, paired_at, last_seen_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'offline', ?, ?, ?)
        `).run(input.deviceId, input.projectId, input.daemonId, input.hostname, input.displayName,
          input.platform, input.architecture, input.daemonVersion, timestamp, timestamp, timestamp);
      }
      const activeToken = this.connection().prepare("SELECT token_id FROM daemon_tokens WHERE device_id = ? AND revoked_at IS NULL")
        .get(input.deviceId) as { token_id: string } | undefined;
      if (!activeToken) {
        this.connection().prepare("INSERT INTO daemon_tokens (token_id, device_id, token_hash, created_at) VALUES (?, ?, ?, ?)")
          .run(uuid(), input.deviceId, tokenHash(input.daemonToken), timestamp);
      }
    });
    transaction();
  }

  revokeDevice(deviceId: string): void {
    const timestamp = this.now().toISOString();
    const result = this.connection().prepare(`
      UPDATE runtime_devices SET status = 'offline', revoked_at = ?, offline_at = COALESCE(offline_at, ?), updated_at = ?
      WHERE device_id = ? AND revoked_at IS NULL
    `).run(timestamp, timestamp, timestamp, deviceId);
    if (result.changes === 0) throw new ControlPlaneNotFoundError(`Runtime device ${deviceId} was not found.`);
    this.connection().prepare("UPDATE daemon_tokens SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL")
      .run(timestamp, deviceId);
    this.connection().prepare("UPDATE runtime_backends SET health = 'offline', updated_at = ? WHERE device_id = ?")
      .run(timestamp, deviceId);
  }

  private requireRow(pairingId: string): PairingRow {
    const row = this.connection().prepare("SELECT * FROM pairing_sessions WHERE pairing_id = ?").get(pairingId) as PairingRow | undefined;
    if (!row) throw new ControlPlaneNotFoundError(`Pairing session ${pairingId} was not found.`);
    return row;
  }

  private requireUsable(pairingId: string): PairingRow {
    const row = this.requireRow(pairingId);
    if (["pending", "approved"].includes(row.status) && row.expires_at <= this.now().toISOString()) {
      this.connection().prepare("UPDATE pairing_sessions SET status = 'expired' WHERE pairing_id = ?").run(pairingId);
      throw new ControlPlaneGoneError("Pairing session has expired.");
    }
    return row;
  }
}

const toPairing = (row: PairingRow, now: string): PairingView => ({
  id: row.pairing_id,
  deviceCode: row.device_code,
  userCode: row.user_code,
  status: ["pending", "approved"].includes(row.status) && row.expires_at <= now ? "expired" : row.status,
  expiresAt: row.expires_at,
  approvedAt: row.approved_at ?? undefined,
  claimedAt: row.claimed_at ?? undefined,
  deviceId: row.device_id ?? undefined
});
