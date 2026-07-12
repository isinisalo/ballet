import { execFile, spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { applicationLogPath } from "./CheckoutState.js";
import { parseLogOptions, parseStartOptions } from "./CliOptions.js";
import type { LocalServerService } from "./LocalServerService.js";
import { resolveProjectContext, type ProjectContext } from "../project/ProjectContext.js";
import type { VerifiedReleaseUpdater } from "./VerifiedReleaseUpdater.js";

const execFileAsync = promisify(execFile);

export interface CliOutput {
  stdout(message: string): void;
  stderr(message: string): void;
}

export interface BalletCliServices {
  server(project: ProjectContext): LocalServerService;
  updater: VerifiedReleaseUpdater;
  output: CliOutput;
  openUrl(url: string): Promise<void>;
  version: string;
  cwd?: () => string;
  stopTimeoutMs?: number;
}

export const runBalletCli = async (argv: readonly string[], services: BalletCliServices): Promise<number> => {
  const command = argv[0]?.startsWith("-") ? undefined : argv[0];
  const args = command ? argv.slice(1) : argv;
  try {
    switch (command) {
      case "stop":
        requireNoArguments(args, "ballet stop");
        await stop(services);
        return 0;
      case "restart":
        requireNoArguments(args, "ballet restart");
        await restart(services);
        return 0;
      case "status":
        requireNoArguments(args, "ballet status");
        await status(services);
        return 0;
      case "logs":
        await logs(args, services);
        return 0;
      case "update":
        requireNoArguments(args, "ballet update");
        await update(services);
        return 0;
      case "version":
        requireNoArguments(args, "ballet version");
        services.output.stdout(services.version);
        return 0;
      case "help":
        requireNoArguments(args, "ballet help");
        services.output.stdout(helpText);
        return 0;
      case undefined:
        if (args.length === 1 && ["--version", "-v"].includes(args[0]!)) {
          services.output.stdout(services.version);
          return 0;
        }
        if (args.length === 1 && ["--help", "-h"].includes(args[0]!)) {
          services.output.stdout(helpText);
          return 0;
        }
        await start(args, services);
        return 0;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    services.output.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
};

const start = async (args: readonly string[], services: BalletCliServices): Promise<void> => {
  const options = parseStartOptions(args);
  const project = await currentProject(services);
  const state = await services.server(project).ensureStarted({
    codexCommand: options.codexCommand,
    copilotCommand: options.copilotCommand
  });
  const url = `http://127.0.0.1:${state.port}`;
  services.output.stdout(`Ballet is running for ${project.root} at ${url}.`);
  if (options.openBrowser) await services.openUrl(url);
};

const stop = async (services: BalletCliServices): Promise<void> => {
  const project = await currentProject(services);
  const stopped = await services.server(project).stopGracefully(services.stopTimeoutMs ?? 90_000);
  services.output.stdout(stopped ? "Ballet stopped." : "Ballet is not configured for this checkout.");
};

const restart = async (services: BalletCliServices): Promise<void> => {
  const project = await currentProject(services);
  const state = await services.server(project).restart({}, services.stopTimeoutMs ?? 90_000);
  services.output.stdout(`Ballet restarted at http://127.0.0.1:${state.port}.`);
};

const status = async (services: BalletCliServices): Promise<void> => {
  const project = await currentProject(services);
  const value = await services.server(project).status();
  services.output.stdout(JSON.stringify({
    checkoutRoot: project.root,
    stateRoot: project.stateRoot,
    serviceLabel: project.serviceLabel,
    configured: value.configured,
    port: value.state?.port,
    instanceId: value.state?.instanceId,
    url: value.state ? `http://127.0.0.1:${value.state.port}` : undefined,
    launchd: value.launchd,
    health: value.health
  }, null, 2));
};

const logs = async (args: readonly string[], services: BalletCliServices): Promise<void> => {
  const options = parseLogOptions(args);
  const project = await currentProject(services);
  const targets = [
    applicationLogPath(project),
    path.join(project.stateRoot, "logs", "launchd.out.log"),
    path.join(project.stateRoot, "logs", "launchd.err.log")
  ];
  if (options.follow) {
    const existing = (await Promise.all(targets.map(async (target) =>
      access(target).then(() => target, () => undefined)))).filter((target): target is string => Boolean(target));
    if (existing.length === 0) throw new Error(`Ballet has not written logs for this checkout at ${path.dirname(targets[0]!)}.`);
    await tailFiles(existing, options.lines);
    return;
  }
  const sections = await Promise.all(targets.map(async (target) => {
    const content = await readFile(target, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    const tail = content.split("\n").slice(-options.lines - 1).join("\n").trimEnd();
    return tail ? `==> ${path.basename(target)} <==\n${tail}` : undefined;
  }));
  services.output.stdout(sections.filter((section): section is string => Boolean(section)).join("\n\n"));
};

const update = async (services: BalletCliServices): Promise<void> => {
  const project = await currentProject(services);
  services.output.stdout(await services.updater.update());
  const state = await services.server(project).restart({}, services.stopTimeoutMs ?? 90_000);
  services.output.stdout(`Ballet restarted for this checkout at http://127.0.0.1:${state.port}.`);
};

const currentProject = (services: BalletCliServices): Promise<ProjectContext> =>
  resolveProjectContext({ root: services.cwd?.() ?? process.cwd() });

const requireNoArguments = (args: readonly string[], usage: string): void => {
  if (args.length > 0) throw new Error(`Usage: ${usage}`);
};

const tailFiles = (targets: readonly string[], lines: number): Promise<void> => new Promise((resolve, reject) => {
  const child = spawn("tail", ["-n", String(lines), "-F", ...targets], { stdio: "inherit" });
  child.on("error", reject);
  child.on("close", (code, signal) => {
    if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") resolve();
    else reject(new Error(`tail exited with code ${code ?? "unknown"}.`));
  });
});

export const defaultOpenUrl = async (url: string): Promise<void> => {
  if (process.platform !== "darwin") throw new Error(`Open this URL in a browser: ${url}`);
  await execFileAsync("open", [url]);
};

const helpText = `Ballet local checkout runtime

Usage:
  ballet [--codex-command <path>] [--copilot-command <path>] [--no-open]
  ballet stop
  ballet restart
  ballet status
  ballet logs [--lines N] [--follow]
  ballet update
  ballet version`;
