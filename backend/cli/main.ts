#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { runBalletCli, defaultOpenUrl } from "./BalletCli.js";
import { LaunchdService } from "./LaunchdService.js";
import { LocalServerService } from "./LocalServerService.js";
import { VerifiedReleaseUpdater } from "./VerifiedReleaseUpdater.js";

const argv = process.argv.slice(2);
if (argv[0] === "server-internal-run") {
  await import("../index.js");
} else {
  const version = process.env.BALLET_VERSION ?? process.env.npm_package_version ?? "0.1.0";
  const cliEntry = fileURLToPath(import.meta.url);
  const packagedExecutable = process.env.BALLET_PACKAGED_EXECUTABLE;
  if (packagedExecutable) process.env.BALLET_INSTALL_PATH ??= packagedExecutable;
  const programArguments = packagedExecutable
    ? [packagedExecutable, "server-internal-run"]
    : [process.execPath, cliEntry, "server-internal-run"];

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
    output: {
      stdout: (message) => process.stdout.write(`${message}\n`),
      stderr: (message) => process.stderr.write(`${message}\n`)
    },
    openUrl: defaultOpenUrl,
    version
  });
}
