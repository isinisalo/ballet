import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import { v4 as uuid } from "uuid";
import { DaemonConfigStore, type DaemonConfig } from "../daemon/config/DaemonConfigStore.js";
import { GitWorkspaceManager } from "../daemon/git/GitWorkspaceManager.js";
import { daemonKeychainAccount, MacOsKeychain } from "./Keychain.js";
import { DaemonLaunchdService } from "./DaemonLaunchdService.js";

interface PairingClaim { status: "pending" | "claimed"; deviceId?: string; daemonToken?: string }

export class DaemonCliService {
  constructor(
    private readonly config: DaemonConfigStore,
    private readonly launchd: DaemonLaunchdService,
    private readonly version: string,
    private readonly output: { stdout(message: string): void },
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async run(args: readonly string[]): Promise<void> {
    const [command, ...rest] = args;
    if (command === "setup") { await this.setup(rest); return; }
    if (command === "start") { await this.launchd.start(); this.output.stdout("Ballet daemon started."); return; }
    if (command === "stop") { await this.launchd.stop(); this.output.stdout("Ballet daemon stopped."); return; }
    if (command === "restart") { await this.launchd.stop(); await this.launchd.start(); this.output.stdout("Ballet daemon restarted."); return; }
    if (command === "status") {
      const launchd = await this.launchd.status();
      const runtime = await readFile(this.config.statusPath(), "utf8").then(JSON.parse, () => undefined);
      this.output.stdout(JSON.stringify({ launchd, runtime }, null, 2)); return;
    }
    if (command === "logs") { await this.logs(rest); return; }
    throw new Error("Usage: ballet daemon setup|start|stop|restart|status|logs");
  }

  private async setup(args: readonly string[]): Promise<void> {
    if (process.platform !== "darwin") throw new Error("Ballet daemon currently supports macOS only.");
    const options = parseOptions(args);
    const serverUrl = required(options, "server");
    const deviceCode = required(options, "device-code");
    const repositoryUrl = required(options, "repo");
    const projectId = required(options, "project");
    assertSecureRemoteUrl(serverUrl);
    const daemonId = uuid();
    const displayName = options.get("name") ?? os.hostname();
    const git = new GitWorkspaceManager({ root: this.config.home });
    const checkout = await git.cloneProject(projectId, repositoryUrl);
    const facts = {
      deviceCode, hostname: os.hostname(), displayName, platform: "darwin" as const,
      architecture: process.arch === "arm64" ? "arm64" as const : "x64" as const,
      daemonVersion: this.version, daemonId
    };
    this.output.stdout("Waiting for this computer to be approved in Ballet…");
    const claim = await this.poll(serverUrl, facts);
    if (!claim.deviceId || !claim.daemonToken) throw new Error("Pairing server returned an incomplete claim.");
    const config: DaemonConfig = {
      version: 1, serverUrl, appUrl: serverUrl, deviceId: claim.deviceId, daemonId, displayName,
      daemonVersion: this.version, projectId, repositoryUrl, repositoryPath: checkout.root,
      backends: [
        { id: uuid(), provider: "codex", command: options.get("codex-command") ?? "codex" },
        { id: uuid(), provider: "copilot", command: options.get("copilot-command") ?? "copilot" }
      ]
    };
    const account = daemonKeychainAccount(serverUrl, claim.deviceId);
    const secrets = new MacOsKeychain();
    await secrets.set(account, claim.daemonToken);
    try { await this.config.save(config); }
    catch (error) { await secrets.delete(account); throw error; }
    await this.launchd.start();
    this.output.stdout(`Ballet daemon paired as ${displayName} (${claim.deviceId}).`);
  }

  private async poll(serverUrl: string, facts: Record<string, unknown>): Promise<PairingClaim> {
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      const response = await this.fetchImpl(new URL("/api/daemon/pairing/poll", serverUrl), {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(facts), signal: AbortSignal.timeout(30_000)
      });
      if (response.status === 202) { await delay(2_000); continue; }
      if (!response.ok) throw new Error(`Pairing failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
      return await response.json() as PairingClaim;
    }
    throw new Error("Pairing session expired before approval.");
  }

  private async logs(args: readonly string[]): Promise<void> {
    const follow = args.includes("--follow") || args.includes("-f");
    const linesIndex = Math.max(args.indexOf("--lines"), args.indexOf("-n"));
    const lines = linesIndex >= 0 ? Math.max(1, Math.min(10_000, Number(args[linesIndex + 1]) || 200)) : 200;
    if (!follow) {
      const content = await readFile(this.config.logPath(), "utf8").catch(() => "");
      this.output.stdout(content.split("\n").slice(-lines).join("\n")); return;
    }
    await new Promise<void>((resolve, reject) => {
      const child = spawn("tail", ["-n", String(lines), "-f", this.config.logPath()], { stdio: "inherit" });
      child.on("error", reject); child.on("close", (code, signal) => code === 0 || signal ? resolve() : reject(new Error(`tail exited with ${code}.`)));
    });
  }
}

const parseOptions = (args: readonly string[]): Map<string, string> => {
  const result = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]; const value = args[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) throw new Error(`Invalid daemon setup option ${key ?? "<missing>"}.`);
    result.set(key.slice(2), value);
  }
  return result;
};
const required = (values: Map<string, string>, key: string): string => {
  const value = values.get(key); if (!value) throw new Error(`Daemon setup requires --${key}.`); return value;
};
const assertSecureRemoteUrl = (value: string): void => {
  const url = new URL(value); const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname.toLowerCase());
  if (url.protocol !== "https:" && !loopback) throw new Error("Remote daemon control-plane URLs must use HTTPS.");
};
const delay = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));
