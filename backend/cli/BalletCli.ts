import { execFile, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import { v4 as uuid } from "uuid";
import type { DaemonConfigStore, DaemonConfig } from "../daemon/config/DaemonConfigStore.js";
import { parseCliOptions, resolveSetupPlan } from "./CliOptions.js";
import { daemonKeychainAccount, type SecretStore } from "./Keychain.js";
import { restartConfiguredLocalServer } from "./ConfiguredLocalServer.js";
import type { LaunchdService, LaunchdStatus } from "./LaunchdService.js";
import type { LocalLifecycleStatus, LocalServerService } from "./LocalServerService.js";
import { canonicalGitHubRepository, resolveLocalGitProject } from "./ProjectIdentity.js";
import { type PairingClient, type PairingDeviceFacts } from "./PairingClient.js";
import type { VerifiedReleaseUpdater } from "./VerifiedReleaseUpdater.js";

const execFileAsync = promisify(execFile);

export interface CliOutput {
  stdout(message: string): void;
  stderr(message: string): void;
}

export interface BalletCliServices {
  config: DaemonConfigStore;
  secrets: SecretStore;
  pairing(serverUrl: string): PairingClient;
  launchd(): LaunchdService;
  localServer: LocalServerService;
  updater: VerifiedReleaseUpdater;
  output: CliOutput;
  openUrl(url: string): Promise<void>;
  version: string;
  cwd?: () => string;
  localControlToken: string;
  stopTimeoutMs?: number;
  wait?: (milliseconds: number) => Promise<void>;
}

export const runBalletCli = async (argv: readonly string[], services: BalletCliServices): Promise<number> => {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case "setup":
        await setup(rest, services);
        return 0;
      case "stop":
        await stopApp(services);
        return 0;
      case "update":
        services.output.stdout(await services.updater.update());
        await restartConfiguredLocalServer(services.config, services.localServer);
        await services.launchd().restart();
        services.output.stdout("Ballet daemon restarted on the updated executable.");
        return 0;
      case "daemon":
        await daemon(rest, services);
        return 0;
      case "version":
      case "--version":
      case "-v":
        services.output.stdout(services.version);
        return 0;
      case "help":
      case "--help":
      case "-h":
        services.output.stdout(helpText);
        return 0;
      case undefined:
        await startApp(services);
        return 0;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    services.output.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
};

const setup = async (args: readonly string[], services: BalletCliServices): Promise<void> => {
  if (process.platform !== "darwin") throw new Error("Ballet local runtime currently supports macOS only.");
  const plan = resolveSetupPlan(args);
  const project = await resolveLocalGitProject(services.cwd?.() ?? process.cwd());
  if (plan.repositoryUrl && canonicalGitHubRepository(plan.repositoryUrl) !== project.canonicalRepository) {
    throw new Error(`The current checkout origin does not match --repo ${plan.repositoryUrl}.`);
  }
  if (plan.projectId && plan.projectId !== project.id) {
    throw new Error(`The current checkout resolves to project ${project.id}, not ${plan.projectId}.`);
  }
  const { serverUrl, appUrl, displayName, deviceCode } = plan;
  if (plan.managedLocalServer) {
    await services.localServer.ensureStarted({
      serverUrl,
      projectId: project.id,
      repositoryUrl: project.repositoryUrl,
      repositoryPath: project.root,
      localControlToken: services.localControlToken
    });
  }
  const daemonId = uuid();
  const facts: PairingDeviceFacts = {
    hostname: os.hostname(),
    displayName,
    platform: "darwin",
    architecture: process.arch === "arm64" ? "arm64" : "x64",
    daemonVersion: services.version,
    daemonId
  };
  const pairing = services.pairing(serverUrl);
  let claim;
  if (deviceCode) {
    services.output.stdout("Waiting for the existing pairing session to be approved...");
    claim = await pairing.pollDeviceCode(deviceCode, facts, { onPending: () => services.output.stdout("Waiting for approval...") });
  } else {
    const session = await pairing.create(facts);
    services.output.stdout(`Pairing code: ${session.userCode}`);
    services.output.stdout(`Approve this computer at ${session.verificationUri}`);
    await services.openUrl(session.verificationUri).catch(() => {
      services.output.stdout("The browser could not be opened automatically; open the verification URL above.");
    });
    claim = await pairing.pollUntilApproved(session, facts, () => services.output.stdout("Waiting for approval..."));
  }
  const config: DaemonConfig = {
    version: 1,
    serverUrl,
    appUrl,
    deviceId: claim.deviceId,
    daemonId,
    displayName,
    daemonVersion: services.version,
    backends: [
      { id: uuid(), provider: "codex", command: plan.codexCommand },
      { id: uuid(), provider: "copilot", command: plan.copilotCommand }
    ],
    projectId: project.id,
    repositoryUrl: project.repositoryUrl,
    repositoryPath: project.root
  };
  const account = daemonKeychainAccount(serverUrl, claim.deviceId);
  await services.secrets.set(account, claim.daemonToken);
  try {
    await services.config.save(config);
  } catch (error) {
    await services.secrets.delete(account);
    throw error;
  }
  if (plan.startDaemon) await services.launchd().installAndStart();
  services.output.stdout(`Ballet daemon paired as ${displayName} (${claim.deviceId}).`);
};

const startApp = async (services: BalletCliServices): Promise<void> => {
  const project = await resolveLocalGitProject(services.cwd?.() ?? process.cwd());
  const serverUrl = "http://127.0.0.1:4317";
  const active = await services.localServer.activeProject(serverUrl);
  if (active?.projectId && active.projectId !== project.id) {
    throw new Error(`Ballet is already running for project ${active.projectId}. Run \`ballet stop\` before switching projects.`);
  }
  if (active?.projectId === project.id) {
    await services.openUrl(serverUrl);
    return;
  }
  const projectConfig = await services.config.activateProject(project.id, {
    repositoryUrl: project.repositoryUrl,
    repositoryPath: project.root
  });
  await services.localServer.ensureStarted({
    serverUrl,
    projectId: project.id,
    repositoryUrl: project.repositoryUrl,
    repositoryPath: project.root,
    localControlToken: services.localControlToken
  });
  if (projectConfig) await services.launchd().installAndStart();
  await services.openUrl(projectConfig?.appUrl ?? new URL("/runtimes?connect=1", serverUrl).toString());
};

const stopApp = async (services: BalletCliServices): Promise<void> => {
  const serverUrl = "http://127.0.0.1:4317";
  const timeoutMs = services.stopTimeoutMs ?? 90_000;
  const deadline = Date.now() + timeoutMs;
  const remaining = () => Math.max(1, deadline - Date.now());
  let active: { projectId?: string } | undefined;
  try {
    active = await services.localServer.activeProject(serverUrl, Math.min(2_000, remaining()), true);
  } catch (error) {
    if (Date.now() >= deadline || isTimeoutError(error)) throw shutdownTimeout();
    throw error;
  }
  if (Date.now() >= deadline) throw shutdownTimeout();
  if (active) {
    let status: LocalLifecycleStatus;
    try {
      status = await services.localServer.cancelAllRuns(serverUrl, services.localControlToken, remaining());
    } catch (error) {
      if (Date.now() >= deadline || isTimeoutError(error)) throw shutdownTimeout();
      throw error;
    }
    if (Date.now() >= deadline && !status.idle) throw shutdownTimeout(status);
    while (!status.idle && Date.now() < deadline) {
      await (services.wait ?? delay)(500);
      try {
        status = await services.localServer.lifecycleStatus(serverUrl, services.localControlToken, Math.min(5_000, remaining()));
      } catch (error) {
        if (Date.now() >= deadline || isTimeoutError(error)) throw shutdownTimeout(status);
        throw error;
      }
    }
    if (!status.idle || Date.now() >= deadline) throw shutdownTimeout(status);
  }
  if (Date.now() >= deadline) throw shutdownTimeout();
  await services.launchd().stop();
  await services.localServer.stop();
  services.output.stdout("Ballet stopped.");
};

const daemon = async (args: readonly string[], services: BalletCliServices): Promise<void> => {
  const [subcommand, ...rest] = args;
  const service = services.launchd();
  switch (subcommand) {
    case "start":
      await service.installAndStart();
      services.output.stdout("Ballet daemon started.");
      return;
    case "stop":
      await service.stop();
      services.output.stdout("Ballet daemon stopped.");
      return;
    case "restart":
      await service.restart();
      services.output.stdout("Ballet daemon restarted.");
      return;
    case "status":
      await printDaemonStatus(service, services);
      return;
    case "logs":
      await printLogs(rest, services);
      return;
    default:
      throw new Error("Usage: ballet daemon start|stop|restart|status|logs");
  }
};

const printDaemonStatus = async (service: LaunchdService, services: BalletCliServices): Promise<void> => {
  const launchd = await service.status();
  let runtime: unknown;
  try {
    runtime = JSON.parse(await readFile(services.config.statusPath(), "utf8")) as unknown;
  } catch {
    runtime = undefined;
  }
  services.output.stdout(JSON.stringify({ launchd: publicLaunchdStatus(launchd), runtime }, null, 2));
};

const printLogs = async (args: readonly string[], services: BalletCliServices): Promise<void> => {
  const options = parseCliOptions(args.flatMap((value) => value === "-f" ? ["--follow"] : value === "-n" ? ["--lines"] : [value]));
  const count = Math.max(1, Math.min(10_000, Number(options.get("lines") ?? "200") || 200));
  const logPath = services.config.logPath();
  if (options.has("follow")) {
    await tailFile(logPath, count);
    return;
  }
  const printTail = async () => {
    const content = await readFile(logPath, "utf8").catch(() => "");
    services.output.stdout(content.split("\n").slice(-count).join("\n"));
  };
  await printTail();
};

const tailFile = (target: string, lines: number): Promise<void> => new Promise((resolve, reject) => {
  const child = spawn("tail", ["-n", String(lines), "-f", target], { stdio: "inherit" });
  child.on("error", reject);
  child.on("close", (code, signal) => {
    if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") resolve();
    else reject(new Error(`tail exited with code ${code ?? "unknown"}.`));
  });
});

const publicLaunchdStatus = (status: LaunchdStatus) => ({ loaded: status.loaded, running: status.running, pid: status.pid });

export { deriveProjectId } from "./ProjectIdentity.js";

export const defaultOpenUrl = async (url: string): Promise<void> => {
  if (process.platform !== "darwin") throw new Error(`Open this URL in a browser: ${url}`);
  await execFileAsync("open", [url]);
};

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const shutdownTimeout = (status?: { activeRuns: number; pendingFinalizations: number }) => new Error(status
  ? `Ballet still has ${status.activeRuns} active runs and ${status.pendingFinalizations} pending finalizations; services were left running.`
  : "Ballet shutdown timed out; services were left running.");

const isTimeoutError = (error: unknown): boolean => error instanceof Error
  && (error.name === "TimeoutError" || error.name === "AbortError");

const helpText = `Ballet local runtime

Usage:
  ballet
  ballet stop
  ballet setup [--server <url>] [--app <url>] [--name <device-name>]
  ballet setup --server <url> --device-code <code>
  ballet update
  ballet daemon start|stop|restart|status|logs [--lines N]
  ballet version`;
