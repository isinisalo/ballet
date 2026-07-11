import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { supervisedProgramArguments } from "./LaunchdLogSupervisor.js";

const execFileAsync = promisify(execFile);
const LABEL = "ai.ballet.server";

export interface LocalServerConfiguration {
  serverUrl: string;
  projectId: string;
  repositoryUrl: string;
  repositoryPath: string;
  localControlToken?: string;
}

export interface LocalLifecycleStatus {
  activeRuns: number;
  pendingFinalizations: number;
  idle: boolean;
}

export interface LocalServerServiceOptions {
  balletHome: string;
  logDirectory: string;
  programArguments: string[];
  webDistPath?: string;
  executablePath?: string;
  fetch?: typeof fetch;
  startupTimeoutMs?: number;
}

export class LocalServerService {
  private readonly plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: LocalServerServiceOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async ensureStarted(config: LocalServerConfiguration): Promise<void> {
    this.ensureMacOs();
    const server = localServerUrl(config.serverUrl);
    const health = await this.probe(server);
    if (health?.projectId === config.projectId) return;
    if (health) {
      throw new Error(`Port ${server.port} is already serving Ballet project ${health.projectId ?? "unknown"}, not ${config.projectId}.`);
    }
    await this.installAndStart(config, server);
  }

  async restart(config: LocalServerConfiguration): Promise<void> {
    this.ensureMacOs();
    await this.installAndStart(config, localServerUrl(config.serverUrl));
  }

  async stop(): Promise<void> {
    this.ensureMacOs();
    await execFileAsync("launchctl", ["bootout", this.domain(), this.plistPath]).catch(() => undefined);
  }

  async activeProject(serverUrl: string, timeoutMs = 2_000, failClosed = false): Promise<{ projectId?: string } | undefined> {
    return this.probe(localServerUrl(serverUrl), timeoutMs, failClosed);
  }

  async cancelAllRuns(serverUrl: string, controlToken: string, timeoutMs = 5_000): Promise<LocalLifecycleStatus> {
    return this.lifecycleRequest(serverUrl, controlToken, "POST", timeoutMs);
  }

  async lifecycleStatus(serverUrl: string, controlToken: string, timeoutMs = 5_000): Promise<LocalLifecycleStatus> {
    return this.lifecycleRequest(serverUrl, controlToken, "GET", timeoutMs);
  }

  private async installAndStart(config: LocalServerConfiguration, server: URL): Promise<void> {
    await mkdir(path.dirname(this.plistPath), { recursive: true });
    await mkdir(this.options.logDirectory, { recursive: true });
    await writeFile(this.plistPath, renderServerPlist(this.options, config, server), { mode: 0o600 });
    const domain = this.domain();
    await execFileAsync("launchctl", ["bootout", domain, this.plistPath]).catch(() => undefined);
    await execFileAsync("launchctl", ["bootstrap", domain, this.plistPath]);
    await execFileAsync("launchctl", ["kickstart", "-k", `${domain}/${LABEL}`]);
    await this.waitUntilReady(server, config.projectId);
  }

  private async waitUntilReady(server: URL, projectId: string): Promise<void> {
    const deadline = Date.now() + (this.options.startupTimeoutMs ?? 20_000);
    while (Date.now() < deadline) {
      const health = await this.probe(server);
      if (health?.projectId === projectId) return;
      if (health) throw new Error(`Ballet server started with unexpected project ${health.projectId ?? "unknown"}.`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Ballet server did not become ready at ${server.origin}. Check ${this.options.logDirectory}/server.err.log.`);
  }

  private async probe(server: URL, timeoutMs = 2_000, failClosed = false): Promise<{ projectId?: string } | undefined> {
    try {
      const response = await this.fetchImpl(new URL("/api/health", server), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(Math.max(1, timeoutMs))
      });
      if (!response.ok) {
        if (failClosed) throw new Error(`Ballet health check failed with HTTP ${response.status}.`);
        return undefined;
      }
      const body = await response.json() as { ok?: unknown; projectId?: unknown };
      if (body.ok === true) return { projectId: typeof body.projectId === "string" ? body.projectId : undefined };
      if (failClosed) throw new Error("Ballet health check returned an invalid response.");
      return undefined;
    } catch (error) {
      if (failClosed && !isConnectionRefused(error)) throw error;
      return undefined;
    }
  }

  private async lifecycleRequest(serverUrl: string, controlToken: string, method: "GET" | "POST", timeoutMs: number): Promise<LocalLifecycleStatus> {
    const server = localServerUrl(serverUrl);
    const response = await this.fetchImpl(new URL("/api/local/lifecycle", server), {
      method,
      headers: { Accept: "application/json", Authorization: `Bearer ${controlToken}` },
      ...(method === "POST" ? { body: "{}", headers: { Accept: "application/json", Authorization: `Bearer ${controlToken}`, "Content-Type": "application/json" } } : {}),
      signal: AbortSignal.timeout(Math.max(1, timeoutMs))
    });
    if (!response.ok) throw new Error(`Ballet lifecycle request failed with HTTP ${response.status}.`);
    return response.json() as Promise<LocalLifecycleStatus>;
  }

  private domain(): string {
    return `gui/${process.getuid?.() ?? os.userInfo().uid}`;
  }

  private ensureMacOs(): void {
    if (process.platform !== "darwin") throw new Error("Ballet local server installation currently supports macOS launchd only.");
  }
}

export const isLocalServerUrl = (value: string): boolean => {
  const url = new URL(value);
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname.toLowerCase());
};

export const renderServerPlist = (
  options: Pick<LocalServerServiceOptions, "balletHome" | "logDirectory" | "programArguments" | "webDistPath" | "executablePath">,
  config: LocalServerConfiguration,
  server = localServerUrl(config.serverUrl)
): string => {
  if (options.programArguments.length === 0) throw new Error("Server launchd ProgramArguments cannot be empty.");
  const argumentsList = supervisedProgramArguments(options.programArguments, "server")
    .map((argument) => `      <string>${escapeXml(argument)}</string>`)
    .join("\n");
  const environment = {
    BALLET_HOME: options.balletHome,
    BALLET_LOG_DIR: options.logDirectory,
    BALLET_PROJECT_ROOT: config.repositoryPath,
    BALLET_PROJECT_ID: config.projectId,
    BALLET_REPOSITORY_URL: config.repositoryUrl,
    ...(config.localControlToken ? { BALLET_LOCAL_CONTROL_TOKEN: config.localControlToken } : {}),
    ...(options.webDistPath ? { BALLET_WEB_DIST: options.webDistPath } : {}),
    PATH: options.executablePath ?? defaultExecutablePath(),
    PORT: server.port || "80"
  };
  const variables = Object.entries(environment)
    .map(([key, value]) => `      <key>${key}</key><string>${escapeXml(value)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key><string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
${argumentsList}
    </array>
    <key>WorkingDirectory</key><string>${escapeXml(config.repositoryPath)}</string>
    <key>EnvironmentVariables</key>
    <dict>
${variables}
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>ProcessType</key><string>Background</string>
    <key>ThrottleInterval</key><integer>10</integer>
    <key>StandardOutPath</key><string>/dev/null</string>
    <key>StandardErrorPath</key><string>/dev/null</string>
  </dict>
</plist>
`;
};

const localServerUrl = (value: string): URL => {
  const url = new URL(value);
  if (!isLocalServerUrl(value) || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("The managed local Ballet server URL must be an HTTP loopback origin.");
  }
  if (!url.port) url.port = "80";
  return url;
};

const escapeXml = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const defaultExecutablePath = (): string =>
  process.env.PATH ?? "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";

const isConnectionRefused = (error: unknown): boolean => {
  const cause = error && typeof error === "object" && "cause" in error
    ? (error as { cause?: unknown }).cause
    : undefined;
  return Boolean(cause && typeof cause === "object" && "code" in cause
    && (cause as { code?: unknown }).code === "ECONNREFUSED");
};
