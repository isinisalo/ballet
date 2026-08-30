import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { LocalDaemonStatus } from "../../shared/domain/runtime.js";
import { DaemonConfigStore } from "../daemon/config/DaemonConfigStore.js";
import type { DaemonLaunchdService } from "./DaemonLaunchdService.js";

export class DaemonCliService {
  constructor(
    private readonly config: DaemonConfigStore,
    private readonly launchd: DaemonLaunchdService,
    private readonly output: { stdout(message: string): void },
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async ensureStarted(timeoutMs = 60_000): Promise<LocalDaemonStatus> {
    const deadline = Date.now() + timeoutMs;
    await this.launchd.start();
    let launchd = await this.launchd.status();
    while ((!launchd.running || !launchd.pid) && Date.now() < deadline) {
      await delay(250); launchd = await this.launchd.status();
    }
    if (!launchd.running || !launchd.pid) throw new Error("Ballet local daemon launchd service did not start.");
    return this.waitUntilReady(Math.max(1, deadline - Date.now()), launchd.pid);
  }

  async run(args: readonly string[]): Promise<void> {
    const [command, ...rest] = args;
    if (command === "start") { await this.ensureStarted(); this.output.stdout("Ballet local daemon started."); return; }
    if (command === "stop") { await this.assertIdle(); await this.launchd.stop(); this.output.stdout("Ballet local daemon stopped."); return; }
    if (command === "restart") {
      await this.assertIdle(); await this.launchd.stop(); await this.ensureStarted();
      this.output.stdout("Ballet local daemon restarted."); return;
    }
    if (command === "status") {
      const config = await this.config.load(); const launchd = await this.launchd.status();
      const runtime = await this.runtime(config.serverUrl).catch(() => undefined);
      this.output.stdout(JSON.stringify({ launchd, runtime }, null, 2)); return;
    }
    if (command === "logs") { await this.logs(rest); return; }
    throw new Error("Usage: ballet daemon start|stop|restart|status|logs");
  }

  async stopIfIdle(): Promise<void> {
    try { await this.assertIdle(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await this.launchd.stop();
  }
  async status(): Promise<{ launchd: Awaited<ReturnType<DaemonLaunchdService["status"]>>; runtime?: LocalDaemonStatus }> {
    const config = await this.config.load();
    return { launchd: await this.launchd.status(), runtime: await this.runtime(config.serverUrl).catch(() => undefined) };
  }

  private async waitUntilReady(timeoutMs: number, expectedPid: number): Promise<LocalDaemonStatus> {
    const config = await this.config.load(); const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = await this.runtime(config.serverUrl).catch(() => undefined);
      if (status?.status === "online" && status.pid === expectedPid) return status;
      await delay(250);
    }
    throw new Error(`Ballet local daemon did not become ready within ${timeoutMs} ms.`);
  }
  private async assertIdle(): Promise<void> {
    const config = await this.config.load(); const status = await this.runtime(config.serverUrl).catch(() => undefined);
    if (status && status.activeTaskCount > 0) throw new Error("Ballet local daemon has an active provider task.");
  }
  private async runtime(serverUrl: string): Promise<LocalDaemonStatus> {
    const response = await this.fetchImpl(new URL("/api/runtimes/local", serverUrl), {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(2_000)
    });
    if (!response.ok) throw new Error(`Local daemon status returned HTTP ${response.status}.`);
    return await response.json() as LocalDaemonStatus;
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
const delay = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));
