import { execFile } from "node:child_process";
import { chmod, mkdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { LocalSettings, ServiceState } from "./CheckoutState.js";
import { applicationLogPath } from "./CheckoutState.js";
import type { ProjectContext } from "../project/ProjectContext.js";

const execFileAsync = promisify(execFile);

export interface LaunchdStatus {
  loaded: boolean;
  running: boolean;
  pid?: number;
}

export interface LaunchdServiceOptions {
  project: ProjectContext;
  programArguments: readonly string[];
  webDistPath?: string;
  executablePath?: string;
  homeDirectory?: string;
}

export class LaunchdService {
  constructor(private readonly options: LaunchdServiceOptions) {}

  async installAndStart(state: ServiceState, settings: LocalSettings): Promise<void> {
    this.ensureMacOs();
    const plistPath = this.plistPath(state);
    await mkdir(path.dirname(plistPath), { recursive: true });
    await mkdir(path.dirname(applicationLogPath(this.options.project)), { recursive: true, mode: 0o700 });
    await prepareBootstrapLogs(this.options.project);
    await writeFile(plistPath, renderPlist(this.options, state, settings), { mode: 0o600 });
    await execFileAsync("launchctl", ["bootout", this.domain(), plistPath]).catch(() => undefined);
    await execFileAsync("launchctl", ["bootstrap", this.domain(), plistPath]);
    await execFileAsync("launchctl", ["kickstart", "-k", `${this.domain()}/${state.serviceLabel}`]);
  }

  async stop(state: ServiceState): Promise<void> {
    this.ensureMacOs();
    await execFileAsync("launchctl", ["bootout", this.domain(), this.plistPath(state)]).catch(() => undefined);
  }

  async status(state: ServiceState): Promise<LaunchdStatus> {
    this.ensureMacOs();
    try {
      const result = await execFileAsync("launchctl", ["print", `${this.domain()}/${state.serviceLabel}`]);
      const pid = /\bpid\s*=\s*(\d+)/.exec(result.stdout)?.[1];
      const processState = /\bstate\s*=\s*([^\n]+)/.exec(result.stdout)?.[1]?.trim();
      return { loaded: true, running: processState === "running", pid: pid ? Number(pid) : undefined };
    } catch {
      return { loaded: false, running: false };
    }
  }

  plistPath(state: ServiceState): string {
    return path.join(this.options.homeDirectory ?? os.homedir(), "Library", "LaunchAgents", `${state.serviceLabel}.plist`);
  }

  private domain(): string {
    return `gui/${process.getuid?.() ?? os.userInfo().uid}`;
  }

  private ensureMacOs(): void {
    if (process.platform !== "darwin") throw new Error("Ballet background services currently support macOS launchd only.");
  }
}

export const renderPlist = (
  options: LaunchdServiceOptions,
  state: ServiceState,
  settings: LocalSettings = { version: 1 }
): string => {
  if (options.programArguments.length === 0) throw new Error("launchd ProgramArguments cannot be empty.");
  const serverArguments = [
    ...options.programArguments,
    "--root", options.project.root,
    "--port", String(state.port),
    "--state-root", options.project.stateRoot,
    ...(settings.codexCommand ? ["--codex-command", settings.codexCommand] : []),
    ...(settings.copilotCommand ? ["--copilot-command", settings.copilotCommand] : [])
  ];
  const argumentsList = serverArguments
    .map((argument) => `      <string>${escapeXml(argument)}</string>`)
    .join("\n");
  const variables: Record<string, string> = {
    PATH: options.executablePath ?? defaultExecutablePath(),
    ...(options.webDistPath ? { BALLET_WEB_DIST: options.webDistPath } : {})
  };
  const environment = Object.entries(variables)
    .map(([key, value]) => `      <key>${key}</key><string>${escapeXml(value)}</string>`)
    .join("\n");
  const logsDirectory = path.dirname(applicationLogPath(options.project));
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key><string>${escapeXml(state.serviceLabel)}</string>
    <key>ProgramArguments</key>
    <array>
${argumentsList}
    </array>
    <key>WorkingDirectory</key><string>${escapeXml(options.project.root)}</string>
    <key>EnvironmentVariables</key>
    <dict>
${environment}
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key>
    <dict>
      <key>SuccessfulExit</key><false/>
    </dict>
    <key>ProcessType</key><string>Background</string>
    <key>ThrottleInterval</key><integer>10</integer>
    <key>StandardOutPath</key><string>${escapeXml(path.join(logsDirectory, "launchd.out.log"))}</string>
    <key>StandardErrorPath</key><string>${escapeXml(path.join(logsDirectory, "launchd.err.log"))}</string>
  </dict>
</plist>
`;
};

const escapeXml = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const defaultExecutablePath = (): string =>
  process.env.PATH ?? "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";

const prepareBootstrapLogs = async (project: ProjectContext): Promise<void> => {
  const directory = path.dirname(applicationLogPath(project));
  for (const name of ["launchd.out.log", "launchd.err.log"]) {
    const target = path.join(directory, name);
    const previous = `${target}.previous`;
    await rm(previous, { force: true });
    await rename(target, previous).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    await writeFile(target, "", { mode: 0o600 });
    await chmod(target, 0o600);
  }
};
