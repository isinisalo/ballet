import type Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { v4 as uuid } from "uuid";
import { opaqueToken, passwordDigest, secureEqual, tokenHash } from "./crypto.js";
import { ControlPlaneConflictError, ControlPlaneUnauthorizedError } from "./errors.js";

export interface AdminSessionResult {
  sessionToken: string;
  csrfToken: string;
  expiresAt: string;
}

export interface AdminIdentity {
  adminId: string;
  sessionId: string;
}

interface SessionRow {
  session_id: string;
  admin_id: string;
  csrf_hash: string;
  expires_at: string;
}

export class AdminAuthStore {
  constructor(
    private readonly connection: () => Database.Database,
    private readonly now: () => Date
  ) {}

  hasAdmin(): boolean {
    const row = this.connection().prepare("SELECT COUNT(*) AS count FROM admins").get() as { count: number };
    return row.count > 0;
  }

  bootstrap(password: string): { adminId: string } {
    const transaction = this.connection().transaction(() => {
      if (this.hasAdmin()) throw new ControlPlaneConflictError("Admin bootstrap has already been completed.");
      const adminId = uuid();
      const salt = randomBytes(16).toString("hex");
      this.connection().prepare(`
        INSERT INTO admins (admin_id, password_salt, password_hash, created_at)
        VALUES (?, ?, ?, ?)
      `).run(adminId, salt, passwordDigest(password, salt), this.now().toISOString());
      return { adminId };
    });
    return transaction() as { adminId: string };
  }

  createSession(password: string, ttlSeconds = 12 * 60 * 60): AdminSessionResult {
    const admin = this.connection().prepare(`
      SELECT admin_id, password_salt, password_hash FROM admins LIMIT 1
    `).get() as { admin_id: string; password_salt: string; password_hash: string } | undefined;
    if (!admin || !secureEqual(passwordDigest(password, admin.password_salt), admin.password_hash)) {
      throw new ControlPlaneUnauthorizedError("Invalid username or password.");
    }
    const sessionToken = opaqueToken();
    const csrfToken = opaqueToken();
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000).toISOString();
    this.connection().prepare(`
      INSERT INTO admin_sessions (
        session_id, admin_id, token_hash, csrf_hash, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid(), admin.admin_id, tokenHash(sessionToken), tokenHash(csrfToken), expiresAt, createdAt.toISOString());
    return { sessionToken, csrfToken, expiresAt };
  }

  authenticate(sessionToken: string, csrfToken?: string): AdminIdentity {
    const row = this.connection().prepare(`
      SELECT s.session_id, s.admin_id, s.csrf_hash, s.expires_at
      FROM admin_sessions s
      WHERE s.token_hash = ? AND s.revoked_at IS NULL
    `).get(tokenHash(sessionToken)) as SessionRow | undefined;
    if (!row || row.expires_at <= this.now().toISOString()) {
      throw new ControlPlaneUnauthorizedError("The admin session is missing or expired.");
    }
    if (csrfToken !== undefined && !secureEqual(tokenHash(csrfToken), row.csrf_hash)) {
      throw new ControlPlaneUnauthorizedError("Invalid CSRF token.");
    }
    return { adminId: row.admin_id, sessionId: row.session_id };
  }

  revoke(sessionToken: string): void {
    this.connection().prepare(`
      UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL
    `).run(this.now().toISOString(), tokenHash(sessionToken));
  }
}
