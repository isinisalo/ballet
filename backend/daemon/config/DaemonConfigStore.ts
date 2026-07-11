import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { RuntimeProvider } from "../../../shared/domain/runtime.js";

export interface ConfiguredRuntimeBackend {
  id: string;
  provider: RuntimeProvider;
  command: string;
}

export interface DaemonConfig {
  version: 1;
  serverUrl: string;
  appUrl: string;
  deviceId: string;
  daemonId: string;
  displayName: string;
  daemonVersion: string;
  backends: ConfiguredRuntimeBackend[];
  projectId?: string;
  repositoryUrl?: string;
  repositoryPath?: string;
}

export const defaultBalletHome = (): string =>
  path.resolve(process.env.BALLET_HOME ?? path.join(os.homedir(), ".ballet"));

export class DaemonConfigStore {
  readonly home: string;
  readonly path: string;

  constructor(home = defaultBalletHome()) {
    this.home = path.resolve(home);
    this.path = path.join(this.home, "daemon", "config.json");
  }

  async load(): Promise<DaemonConfig> {
    const parsed = JSON.parse(await readFile(this.path, "utf8")) as unknown;
    return validateDaemonConfig(parsed);
  }

  async save(config: DaemonConfig): Promise<void> {
    validateDaemonConfig(config);
    await mkdir(path.dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.path);
  }

  statusPath(): string {
    return path.join(this.home, "daemon", "status.json");
  }

  logDirectory(): string {
    return path.resolve(process.env.BALLET_LOG_DIR ?? path.join(os.homedir(), "Library", "Logs", "Ballet"));
  }

  logPath(): string {
    return path.join(this.logDirectory(), "daemon.log");
  }
}

const validateDaemonConfig = (value: unknown): DaemonConfig => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Daemon config must be an object.");
  const config = value as Record<string, unknown>;
  if (config.version !== 1) throw new Error("Unsupported daemon config version.");
  for (const field of ["serverUrl", "appUrl", "deviceId", "daemonId", "displayName", "daemonVersion"] as const) {
    if (typeof config[field] !== "string" || !config[field].trim()) throw new Error(`Daemon config ${field} is required.`);
  }
  if (!isUuid(String(config.deviceId)) || !isUuid(String(config.daemonId))) throw new Error("Daemon config deviceId and daemonId must be UUIDs.");
  for (const field of ["serverUrl", "appUrl"] as const) {
    const url = new URL(config[field] as string);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Daemon config ${field} must use HTTP or HTTPS.`);
    if (field === "serverUrl" && url.protocol !== "https:" && !isLoopback(url.hostname)) {
      throw new Error("Remote daemon control-plane URLs must use HTTPS.");
    }
  }
  if (!Array.isArray(config.backends) || config.backends.length !== 2) throw new Error("Daemon config must contain Codex and Copilot backends.");
  const backends = config.backends.map((entry) => validateBackend(entry));
  if (new Set(backends.map((entry) => entry.provider)).size !== 2) throw new Error("Daemon config backends must have unique providers.");
  const projectFields = [config.projectId, config.repositoryUrl, config.repositoryPath];
  if (projectFields.some((field) => field !== undefined) && !projectFields.every((field) => typeof field === "string" && field.trim())) {
    throw new Error("Daemon projectId, repositoryUrl, and repositoryPath must be configured together.");
  }
  return { ...config, backends } as DaemonConfig;
};

const isLoopback = (hostname: string): boolean => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname.toLowerCase());

const validateBackend = (value: unknown): ConfiguredRuntimeBackend => {
  if (!value || typeof value !== "object") throw new Error("Invalid daemon backend config.");
  const backend = value as Record<string, unknown>;
  if (typeof backend.id !== "string" || !backend.id) throw new Error("Daemon backend id is required.");
  if (!isUuid(backend.id)) throw new Error("Daemon backend id must be a UUID.");
  if (backend.provider !== "codex" && backend.provider !== "copilot") throw new Error("Daemon backend provider is invalid.");
  if (typeof backend.command !== "string" || !backend.command) throw new Error("Daemon backend command is required.");
  return backend as unknown as ConfiguredRuntimeBackend;
};

const isUuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
