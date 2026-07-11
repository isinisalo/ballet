#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runBalletCli, defaultOpenUrl } from "./BalletCli.js";
import { DaemonConfigStore } from "../daemon/config/DaemonConfigStore.js";
import { GitWorkspaceManager } from "../daemon/git/GitWorkspaceManager.js";
import { MacOsKeychain } from "./Keychain.js";
import { LaunchdService } from "./LaunchdService.js";
import { LocalServerService } from "./LocalServerService.js";
import { superviseLaunchdProcess } from "./LaunchdLogSupervisor.js";
import { PairingClient } from "./PairingClient.js";
import { VerifiedReleaseUpdater } from "./VerifiedReleaseUpdater.js";

const version = process.env.BALLET_VERSION ?? process.env.npm_package_version ?? "0.1.0";
const config = new DaemonConfigStore();
const cliEntry = fileURLToPath(import.meta.url);
const packagedExecutable = process.env.BALLET_PACKAGED_EXECUTABLE;
if (packagedExecutable) process.env.BALLET_INSTALL_PATH ??= packagedExecutable;
const programArguments = packagedExecutable
  ? [packagedExecutable, "daemon-internal-run"]
  : [process.execPath, cliEntry, "daemon-internal-run"];
const serverProgramArguments = packagedExecutable
  ? [packagedExecutable, "server-internal-run"]
  : [process.execPath, cliEntry, "server-internal-run"];

const argv = process.argv.slice(2);
if (argv[0] === "launchd-log-supervisor-internal-run") {
  const service = argv[1];
  if (service !== "daemon" && service !== "server") throw new Error("Launchd log supervisor requires daemon or server mode.");
  process.title = `ballet-${service}-supervisor`;
  const logDirectory = config.logDirectory();
  process.exitCode = await superviseLaunchdProcess({
    entrypoint: cliEntry,
    childArguments: [`${service}-internal-run`],
    stdoutPath: path.join(logDirectory, service === "daemon" ? "daemon.bootstrap.log" : "server.log"),
    stderrPath: path.join(logDirectory, service === "daemon" ? "daemon.err.log" : "server.err.log")
  });
} else if (argv[0] === "daemon-internal-run") {
  await import("../daemon/main.js");
} else if (argv[0] === "server-internal-run") {
  await import("../index.js");
} else {
  const exitCode = await runBalletCli(argv, {
  config,
  secrets: new MacOsKeychain(),
  pairing: (serverUrl) => new PairingClient(serverUrl),
  launchd: () => new LaunchdService({
    balletHome: config.home,
    logDirectory: config.logDirectory(),
    programArguments
  }),
  localServer: new LocalServerService({
    balletHome: config.home,
    logDirectory: config.logDirectory(),
    programArguments: serverProgramArguments,
    webDistPath: packagedExecutable ? process.env.BALLET_WEB_DIST : undefined
  }),
  git: new GitWorkspaceManager({ root: config.home }),
  updater: new VerifiedReleaseUpdater(),
  output: {
    stdout: (message) => process.stdout.write(`${message}\n`),
    stderr: (message) => process.stderr.write(`${message}\n`)
  },
  openUrl: defaultOpenUrl,
  version
  });

  process.exitCode = exitCode;
}
