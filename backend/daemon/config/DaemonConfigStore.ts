import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RuntimeProvider } from "../../../shared/domain/runtime.js";

export interface ConfiguredRuntimeProvider { provider: RuntimeProvider; command: string }
export interface DaemonConfig {
  version: 2;
  instanceId: string;
  checkoutRoot: string;
  serverUrl: string;
  token: string;
  daemonVersion: string;
  providers: ConfiguredRuntimeProvider[];
}

export class DaemonConfigStore {
  readonly home: string;
  readonly path: string;

  constructor(stateRoot: string) {
    this.home = path.resolve(stateRoot, "daemon");
    this.path = path.join(this.home, "config.json");
  }

  async load(): Promise<DaemonConfig> {
    return validateDaemonConfig(JSON.parse(await readFile(this.path, "utf8")) as unknown);
  }

  async ensure(input: Omit<DaemonConfig, "version" | "token" | "providers"> & {
    codexCommand?: string; copilotCommand?: string;
  }): Promise<DaemonConfig> {
    const existing = await this.load().catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    const config: DaemonConfig = {
      version: 2, instanceId: input.instanceId, checkoutRoot: input.checkoutRoot,
      serverUrl: input.serverUrl, daemonVersion: input.daemonVersion,
      token: existing?.token ?? randomBytes(32).toString("hex"),
      providers: [
        { provider: "codex", command: input.codexCommand ?? existing?.providers.find(({ provider }) => provider === "codex")?.command ?? "codex" },
        { provider: "copilot", command: input.copilotCommand ?? existing?.providers.find(({ provider }) => provider === "copilot")?.command ?? "copilot" }
      ]
    };
    await this.save(config); return config;
  }

  async save(config: DaemonConfig): Promise<void> {
    validateDaemonConfig(config);
    await mkdir(this.home, { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${process.pid}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600, flag: "wx" });
      await rename(temporary, this.path); await chmod(this.path, 0o600);
    } finally { await rm(temporary, { force: true }); }
  }

  statusPath(): string { return path.join(this.home, "status.json"); }
  logDirectory(): string { return path.join(path.dirname(this.home), "logs"); }
  logPath(): string { return path.join(this.logDirectory(), "daemon.log"); }
}

const validateDaemonConfig = (value: unknown): DaemonConfig => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Daemon config must be an object.");
  const config = value as Record<string, unknown>;
  const allowed = new Set(["version", "instanceId", "checkoutRoot", "serverUrl", "token", "daemonVersion", "providers"]);
  const unknown = Object.keys(config).filter((field) => !allowed.has(field));
  if (unknown.length > 0) throw new Error(`Unknown daemon config fields: ${unknown.join(", ")}.`);
  if (config.version !== 2) throw new Error("Unsupported daemon config version. Expected 2.");
  for (const field of ["instanceId", "checkoutRoot", "serverUrl", "token", "daemonVersion"] as const) {
    if (typeof config[field] !== "string" || !config[field].trim()) throw new Error(`Daemon config ${field} is required.`);
  }
  const url = new URL(String(config.serverUrl));
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname.toLowerCase())) {
    throw new Error("Local daemon serverUrl must use loopback HTTP.");
  }
  if (!path.isAbsolute(String(config.checkoutRoot))) throw new Error("Daemon checkoutRoot must be absolute.");
  if (!/^[0-9a-f]{64}$/i.test(String(config.token))) throw new Error("Daemon token must contain 32 random bytes.");
  if (!Array.isArray(config.providers) || config.providers.length !== 2) throw new Error("Daemon config must contain Codex and Copilot providers.");
  const providers = config.providers.map((candidate) => validateProvider(candidate));
  if (new Set(providers.map(({ provider }) => provider)).size !== 2) throw new Error("Daemon providers must be unique.");
  return { ...config, providers } as DaemonConfig;
};
const validateProvider = (value: unknown): ConfiguredRuntimeProvider => {
  if (!value || typeof value !== "object") throw new Error("Invalid daemon provider config.");
  const provider = value as Record<string, unknown>;
  const unknown = Object.keys(provider).filter((field) => field !== "provider" && field !== "command");
  if (unknown.length > 0) throw new Error(`Unknown daemon provider fields: ${unknown.join(", ")}.`);
  if (provider.provider !== "codex" && provider.provider !== "copilot") throw new Error("Daemon provider is invalid.");
  if (typeof provider.command !== "string" || !provider.command.trim()) throw new Error("Daemon provider command is required.");
  return provider as unknown as ConfiguredRuntimeProvider;
};
