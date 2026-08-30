#!/usr/bin/env node
import { BalletDaemon } from "./BalletDaemon.js";
import { writeDaemonStatus } from "./DaemonStatusFile.js";
import { DaemonConfigStore } from "./config/DaemonConfigStore.js";
import { LeaseAwareJobRunner } from "./jobs/LeaseAwareJobRunner.js";
import { CodexAppServerAdapter } from "./providers/codex/CodexAppServerAdapter.js";
import { LocalDaemonTransport } from "./transport/LocalDaemonTransport.js";
import { RotatingDaemonLogger } from "./RotatingDaemonLogger.js";

if (process.platform !== "darwin") throw new Error("Ballet local daemon currently supports macOS only.");
const stateRoot = process.env.BALLET_STATE_ROOT;
if (!stateRoot) throw new Error("BALLET_STATE_ROOT is required for the checkout-local daemon.");
process.title = "ballet-local-daemon";
const configStore = new DaemonConfigStore(stateRoot);
const config = await configStore.load();
const codex = config.providers.find(({ provider }) => provider === "codex")!;
const adapters = [new CodexAppServerAdapter({ command: codex.command })];
const transport = new LocalDaemonTransport(config.serverUrl, config.token);
const runner = new LeaseAwareJobRunner({ adapters, transport });
const logger = new RotatingDaemonLogger({ path: configStore.logPath() });
let statusWrite = Promise.resolve();
const daemon = new BalletDaemon({
  config, adapters, transport, runner,
  onStatus: (status) => {
    statusWrite = statusWrite.then(() => writeDaemonStatus(configStore.statusPath(), {
      ...status, pid: process.pid, instanceId: config.instanceId, updatedAt: new Date().toISOString()
    }));
    return statusWrite;
  },
  onLog: (level, message, data) => {
    void logger.log(level, message, data).catch((error) => process.stderr.write(`daemon log failure: ${String(error)}\n`));
  }
});
const shutdown = () => { void daemon.stop(); };
process.once("SIGTERM", shutdown); process.once("SIGINT", shutdown);
try { await daemon.run(); }
catch (error) {
  const at = new Date().toISOString();
  await writeDaemonStatus(configStore.statusPath(), {
    state: "error", pid: process.pid, instanceId: config.instanceId,
    startedAt: at, updatedAt: at, activeTasks: 0,
    recentError: error instanceof Error ? error.message : String(error)
  });
  throw error;
}
