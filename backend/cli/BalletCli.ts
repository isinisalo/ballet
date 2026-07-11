import { execFile, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { v4 as uuid } from "uuid";
import type { DaemonConfigStore, DaemonConfig } from "../daemon/config/DaemonConfigStore.js";
import type { GitWorkspaceManager } from "../daemon/git/GitWorkspaceManager.js";
import { parseCliOptions, resolveSetupPlan } from "./CliOptions.js";
import { daemonKeychainAccount, type SecretStore } from "./Keychain.js";
import { ensureConfiguredLocalServer, restartConfiguredLocalServer } from "./ConfiguredLocalServer.js";
import type { LaunchdService, LaunchdStatus } from "./LaunchdService.js";
import type { LocalServerService } from "./LocalServerService.js";
import { safeProjectName } from "./ProjectIdentity.js";
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
  git: GitWorkspaceManager;
  updater: VerifiedReleaseUpdater;
  output: CliOutput;
  openUrl(url: string): Promise<void>;
  version: string;
  now?: () => Date;
}

export const runBalletCli = async (argv: readonly string[], services: BalletCliServices): Promise<number> => {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case "setup":
        await setup(rest, services);
        return 0;
      case "open":
        await openApp(services);
        return 0;
      case "update":
        services.output.stdout(await services.updater.update());
        await restartConfiguredLocalServer(services.config, services.localServer);
        await services.launchd().restart();
        services.output.stdout("Ballet daemon restarted on the updated executable.");
        return 0;
      case "project":
        await project(rest, services);
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
      case undefined:
        services.output.stdout(helpText);
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
  const { serverUrl, appUrl, displayName, repositoryUrl, projectId, deviceCode } = plan;
  let checkout: Awaited<ReturnType<GitWorkspaceManager["cloneProject"]>> | undefined;
  if (projectId && repositoryUrl) checkout = await services.git.cloneProject(projectId, repositoryUrl);
  if (plan.managedLocalServer && projectId && repositoryUrl && checkout) {
    await services.localServer.ensureStarted({
      serverUrl,
      projectId,
      repositoryUrl,
      repositoryPath: checkout.root
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
    projectId,
    repositoryUrl,
    repositoryPath: checkout?.root
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

const openApp = async (services: BalletCliServices): Promise<void> => {
  const config = await services.config.load();
  await ensureConfiguredLocalServer(config, services.localServer);
  await services.openUrl(config.appUrl);
};

const project = async (args: readonly string[], services: BalletCliServices): Promise<void> => {
  const [subcommand, projectId, repositoryUrl] = args;
  if (!projectId) throw new Error("Project id is required.");
  if (subcommand === "clone") {
    if (!repositoryUrl) throw new Error("Repository URL is required.");
    const status = await services.git.cloneProject(projectId, repositoryUrl);
    const config = await services.config.load();
    config.projectId = projectId;
    config.repositoryUrl = repositoryUrl;
    config.repositoryPath = status.root;
    await services.config.save(config);
    services.output.stdout(JSON.stringify(status, null, 2));
    return;
  }
  if (subcommand === "status") {
    const config = await services.config.load();
    const root = config.projectId === projectId && config.repositoryPath
      ? config.repositoryPath
      : path.join(services.config.home, "projects", safeProjectName(projectId), "repo");
    services.output.stdout(JSON.stringify(await services.git.inspect(root), null, 2));
    return;
  }
  throw new Error("Usage: ballet project clone <project-id> <repository-url> | ballet project status <project-id>");
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

const helpText = `Ballet local runtime

Usage:
  ballet setup --repo <git-url> [--server <url>] [--app <url>] [--name <device-name>]
  ballet setup --server <url> --device-code <code> [--repo <git-url>]
  ballet open
  ballet update
  ballet project clone <project-id> <repository-url>
  ballet project status <project-id>
  ballet daemon start|stop|restart|status|logs [--lines N]
  ballet version`;
