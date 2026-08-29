import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const LABEL = "ai.ballet.daemon";

export class DaemonLaunchdService {
  private readonly plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);

  constructor(private readonly options: { balletHome: string; logDirectory: string; programArguments: string[] }) {}

  async start(): Promise<void> {
    if (process.platform !== "darwin") throw new Error("Ballet daemon currently supports macOS launchd only.");
    await mkdir(path.dirname(this.plistPath), { recursive: true });
    await mkdir(path.join(this.options.balletHome, "daemon"), { recursive: true });
    await mkdir(this.options.logDirectory, { recursive: true });
    await writeFile(this.plistPath, renderDaemonPlist(this.options), { mode: 0o600 });
    await execFileAsync("launchctl", ["bootout", this.domain(), this.plistPath]).catch(() => undefined);
    await execFileAsync("launchctl", ["bootstrap", this.domain(), this.plistPath]);
    await execFileAsync("launchctl", ["kickstart", "-k", `${this.domain()}/${LABEL}`]);
  }

  async stop(): Promise<void> {
    await execFileAsync("launchctl", ["bootout", this.domain(), this.plistPath]).catch(() => undefined);
  }

  async status(): Promise<{ loaded: boolean; running: boolean; pid?: number }> {
    try {
      const result = await execFileAsync("launchctl", ["print", `${this.domain()}/${LABEL}`]);
      const pid = /\bpid\s*=\s*(\d+)/.exec(result.stdout)?.[1];
      const state = /\bstate\s*=\s*([^\n]+)/.exec(result.stdout)?.[1]?.trim();
      return { loaded: true, running: state === "running", ...(pid ? { pid: Number(pid) } : {}) };
    } catch { return { loaded: false, running: false }; }
  }

  private domain(): string { return `gui/${process.getuid?.() ?? os.userInfo().uid}`; }
}

const renderDaemonPlist = (options: { balletHome: string; logDirectory: string; programArguments: string[] }): string => {
  const args = options.programArguments.map((argument) => `      <string>${xml(argument)}</string>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array>
${args}
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>BALLET_HOME</key><string>${xml(options.balletHome)}</string>
    <key>BALLET_LOG_DIR</key><string>${xml(options.logDirectory)}</string>
    <key>PATH</key><string>${xml(process.env.PATH ?? "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin")}</string>
  </dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string><key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${xml(path.join(options.logDirectory, "daemon.bootstrap.log"))}</string>
  <key>StandardErrorPath</key><string>${xml(path.join(options.logDirectory, "daemon.err.log"))}</string>
</dict></plist>
`;
};

const xml = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
