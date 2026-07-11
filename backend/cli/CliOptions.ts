import os from "node:os";
import { isLocalServerUrl } from "./LocalServerService.js";
import { deriveProjectId } from "./ProjectIdentity.js";

export interface SetupPlan {
  serverUrl: string;
  appUrl: string;
  displayName: string;
  repositoryUrl?: string;
  projectId?: string;
  deviceCode?: string;
  codexCommand: string;
  copilotCommand: string;
  managedLocalServer: boolean;
  startDaemon: boolean;
}

export const resolveSetupPlan = (args: readonly string[]): SetupPlan => {
  const options = parseCliOptions(args);
  const serverUrl = options.get("server") ?? "http://127.0.0.1:4317";
  const appUrl = options.get("app") ?? serverUrl;
  const repositoryUrl = options.get("repo") ?? options.get("repository");
  const projectId = options.get("project") ?? (repositoryUrl ? deriveProjectId(repositoryUrl) : undefined);
  if (Boolean(projectId) !== Boolean(repositoryUrl)) throw new Error("--project and --repo must be provided together.");
  const deviceCode = options.get("device-code");
  if (options.has("device-code") && (!deviceCode || deviceCode === "true")) {
    throw new Error("--device-code requires the device code returned by an existing pairing session.");
  }
  const managedLocalServer = isLocalServerUrl(serverUrl);
  if ((managedLocalServer || isLocalServerUrl(appUrl)) && new URL(serverUrl).origin !== new URL(appUrl).origin) {
    throw new Error("The managed local Ballet app and API must use the same loopback origin.");
  }
  if (managedLocalServer && (!projectId || !repositoryUrl)) throw new Error("Local setup requires --repo <git-url>.");
  return {
    serverUrl,
    appUrl,
    displayName: options.get("name") ?? os.hostname(),
    repositoryUrl,
    projectId,
    deviceCode,
    codexCommand: options.get("codex-command") ?? "codex",
    copilotCommand: options.get("copilot-command") ?? "copilot",
    managedLocalServer,
    startDaemon: !options.has("no-start")
  };
};

export const parseCliOptions = (args: readonly string[]): Map<string, string> => {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;
    if (!value.startsWith("--")) throw new Error(`Unexpected argument: ${value}`);
    const [rawKey, inline] = value.slice(2).split("=", 2);
    if (!rawKey) throw new Error("Invalid empty option.");
    if (inline !== undefined) options.set(rawKey, inline);
    else if (args[index + 1] && !args[index + 1]!.startsWith("--")) options.set(rawKey, args[++index]!);
    else options.set(rawKey, "true");
  }
  return options;
};
