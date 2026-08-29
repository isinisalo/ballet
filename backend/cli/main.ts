#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { runBalletCli, defaultOpenUrl } from "./BalletCli.js";
import { LaunchdService } from "./LaunchdService.js";
import { LocalServerService } from "./LocalServerService.js";
import { VerifiedReleaseUpdater } from "./VerifiedReleaseUpdater.js";
import { DaemonConfigStore } from "../daemon/config/DaemonConfigStore.js";
import { DaemonLaunchdService } from "./DaemonLaunchdService.js";
import { DaemonCliService } from "./DaemonCliService.js";

const argv = process.argv.slice(2);
if (argv[0] === "daemon-internal-run") {
  await import("../daemon/main.js");
} else if (argv[0] === "server-internal-run") {
  await import("../index.js");
} else {
  const version = process.env.BALLET_VERSION ?? process.env.npm_package_version ?? "0.1.0";
  const cliEntry = fileURLToPath(import.meta.url);
  const packagedExecutable = process.env.BALLET_PACKAGED_EXECUTABLE;
  if (packagedExecutable) process.env.BALLET_INSTALL_PATH ??= packagedExecutable;
  const programArguments = packagedExecutable
    ? [packagedExecutable, "server-internal-run"]
    : [process.execPath, cliEntry, "server-internal-run"];
  const daemonProgramArguments = packagedExecutable
    ? [packagedExecutable, "daemon-internal-run"]
    : [process.execPath, cliEntry, "daemon-internal-run"];
  const daemonConfig = new DaemonConfigStore();
  const daemonLaunchd = new DaemonLaunchdService({
    balletHome: daemonConfig.home,
    logDirectory: daemonConfig.logDirectory(),
    programArguments: daemonProgramArguments
  });
  const output = {
    stdout: (message: string) => process.stdout.write(`${message}\n`),
    stderr: (message: string) => process.stderr.write(`${message}\n`)
  };

  process.exitCode = await runBalletCli(argv, {
    server: (project) => {
      const launchd = new LaunchdService({
        project,
        programArguments,
        webDistPath: packagedExecutable ? process.env.BALLET_WEB_DIST : undefined
      });
      return new LocalServerService({ project, launchd });
    },
    updater: new VerifiedReleaseUpdater(),
    output,
    daemon: new DaemonCliService(daemonConfig, daemonLaunchd, version, output),
    openUrl: defaultOpenUrl,
    version
  });
}
