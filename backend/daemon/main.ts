#!/usr/bin/env node
import { BalletDaemon } from "./BalletDaemon.js";
import { writeDaemonStatus } from "./DaemonStatusFile.js";
import { DaemonConfigStore } from "./config/DaemonConfigStore.js";
import { GitWorkspaceManager } from "./git/GitWorkspaceManager.js";
import { LeaseAwareJobRunner } from "./jobs/LeaseAwareJobRunner.js";
import { CodexAppServerAdapter } from "./providers/codex/CodexAppServerAdapter.js";
import { CopilotSdkAdapter } from "./providers/copilot/CopilotSdkAdapter.js";
import { HttpWsDaemonTransport } from "./transport/HttpWsDaemonTransport.js";
import { RotatingDaemonLogger } from "./RotatingDaemonLogger.js";
import { MacOsKeychain, daemonKeychainAccount } from "../cli/Keychain.js";

if (process.platform !== "darwin") throw new Error("Ballet local runtime currently supports macOS only.");

process.title = "ballet-daemon";
const configStore = new DaemonConfigStore();
const config = await configStore.load();
const token = await new MacOsKeychain().get(daemonKeychainAccount(config.serverUrl, config.deviceId));
const codex = config.backends.find((backend) => backend.provider === "codex");
const copilot = config.backends.find((backend) => backend.provider === "copilot");
if (!codex || !copilot) throw new Error("Daemon config is missing Codex or Copilot backend configuration.");

const adapters = [
  new CodexAppServerAdapter({ command: codex.command }),
  new CopilotSdkAdapter({ command: copilot.command })
];
const transport = new HttpWsDaemonTransport({ baseUrl: config.serverUrl, daemonToken: token });
const git = new GitWorkspaceManager({ root: configStore.home });
const runner = new LeaseAwareJobRunner({ deviceId: config.deviceId, adapters, runtimeBackends: config.backends, transport, git });
const logger = new RotatingDaemonLogger({ path: configStore.logPath() });
const daemon = new BalletDaemon({
  config,
  adapters,
  transport,
  runner,
  git,
  onStatus: (status) => writeDaemonStatus(configStore.statusPath(), {
    ...status,
    pid: process.pid,
    daemonId: config.daemonId,
    deviceId: config.deviceId,
    updatedAt: new Date().toISOString()
  }),
  onLog: (level, message, data) => {
    void logger.log(level, message, data).catch((error) => process.stderr.write(`daemon log failure: ${String(error)}\n`));
  }
});

const shutdown = () => { void daemon.stop(); };
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

try {
  await daemon.run();
} catch (error) {
  await writeDaemonStatus(configStore.statusPath(), {
    state: "error",
    pid: process.pid,
    daemonId: config.daemonId,
    deviceId: config.deviceId,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activeTasks: 0,
    websocketConnected: false,
    recentError: error instanceof Error ? error.message : String(error)
  });
  throw error;
}
