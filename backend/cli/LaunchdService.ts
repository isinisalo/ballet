import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { supervisedProgramArguments } from "./LaunchdLogSupervisor.js";

const execFileAsync = promisify(execFile);
const LABEL = "ai.ballet.daemon";

export interface LaunchdStatus {
  loaded: boolean;
  running: boolean;
  pid?: number;
  raw?: string;
}

export interface LaunchdServiceOptions {
  balletHome: string;
  logDirectory: string;
  programArguments: string[];
  executablePath?: string;
}

export class LaunchdService {
  private readonly plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);

  constructor(private readonly options: LaunchdServiceOptions) {}

  async installAndStart(): Promise<void> {
    this.ensureMacOs();
    await mkdir(path.dirname(this.plistPath), { recursive: true });
    await mkdir(path.join(this.options.balletHome, "daemon"), { recursive: true });
    await mkdir(this.options.logDirectory, { recursive: true });
    await writeFile(this.plistPath, renderPlist(this.options), { mode: 0o600 });
    const domain = `gui/${process.getuid?.() ?? os.userInfo().uid}`;
    await execFileAsync("launchctl", ["bootout", domain, this.plistPath]).catch(() => undefined);
    await execFileAsync("launchctl", ["bootstrap", domain, this.plistPath]);
    await execFileAsync("launchctl", ["kickstart", "-k", `${domain}/${LABEL}`]);
  }

  async stop(): Promise<void> {
    this.ensureMacOs();
    await execFileAsync("launchctl", ["bootout", this.domain(), this.plistPath]).catch(() => undefined);
  }

  async restart(): Promise<void> {
    await this.installAndStart();
  }

  async status(): Promise<LaunchdStatus> {
    this.ensureMacOs();
    try {
      const result = await execFileAsync("launchctl", ["print", `${this.domain()}/${LABEL}`]);
      const pid = /\bpid\s*=\s*(\d+)/.exec(result.stdout)?.[1];
      const state = /\bstate\s*=\s*([^\n]+)/.exec(result.stdout)?.[1]?.trim();
      return { loaded: true, running: state === "running", pid: pid ? Number(pid) : undefined, raw: result.stdout };
    } catch {
      return { loaded: false, running: false };
    }
  }

  private domain(): string {
    return `gui/${process.getuid?.() ?? os.userInfo().uid}`;
  }

  private ensureMacOs(): void {
    if (process.platform !== "darwin") throw new Error("Ballet daemon service installation currently supports macOS launchd only.");
  }
}

export const renderPlist = (options: LaunchdServiceOptions): string => {
  if (options.programArguments.length === 0) throw new Error("launchd ProgramArguments cannot be empty.");
  const argumentsList = supervisedProgramArguments(options.programArguments, "daemon")
    .map((argument) => `      <string>${escapeXml(argument)}</string>`)
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
    <key>EnvironmentVariables</key>
    <dict>
      <key>BALLET_HOME</key><string>${escapeXml(options.balletHome)}</string>
      <key>BALLET_LOG_DIR</key><string>${escapeXml(options.logDirectory)}</string>
      <key>PATH</key><string>${escapeXml(options.executablePath ?? defaultExecutablePath())}</string>
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

const escapeXml = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const defaultExecutablePath = (): string =>
  process.env.PATH ?? "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
