import type { DaemonConfigStore } from "../daemon/config/DaemonConfigStore.js";
import type { LaunchdService } from "./LaunchdService.js";
import { isLocalServerUrl, type LocalServerService } from "./LocalServerService.js";
import type { SecretStore } from "./Keychain.js";
import { restoreConfiguredLocalRuntime } from "./LocalRuntimeRecovery.js";
import { resolveLocalGitProject } from "./ProjectIdentity.js";

export const startBalletApp = async (services: {
  config: DaemonConfigStore;
  secrets: SecretStore;
  launchd(): LaunchdService;
  localServer: LocalServerService;
  output: { stdout(message: string): void };
  openUrl(url: string): Promise<void>;
  localControlToken: string;
  cwd?: () => string;
}): Promise<void> => {
  const project = await resolveLocalGitProject(services.cwd?.() ?? process.cwd());
  const serverUrl = "http://127.0.0.1:4317";
  const active = await services.localServer.activeProject(serverUrl);
  if (active?.projectId && active.projectId !== project.id) {
    throw new Error(`Ballet is already running for project ${active.projectId}. Run \`ballet stop\` before switching projects.`);
  }
  const projectConfig = await services.config.activateProject(project.id, {
    repositoryUrl: project.repositoryUrl,
    repositoryPath: project.root
  });
  if (active?.projectId !== project.id) {
    await services.localServer.ensureStarted({
      serverUrl,
      projectId: project.id,
      repositoryUrl: project.repositoryUrl,
      repositoryPath: project.root,
      localControlToken: services.localControlToken
    });
  }
  const configuredServer = projectConfig ? new URL(projectConfig.serverUrl) : undefined;
  const managedServer = new URL(serverUrl);
  if (!projectConfig || !configuredServer || !isLocalServerUrl(projectConfig.serverUrl)
    || (configuredServer.port || "80") !== (managedServer.port || "80")) {
    await services.openUrl(new URL("/runtimes?connect=1", serverUrl).toString());
    return;
  }
  try {
    const status = await restoreConfiguredLocalRuntime({
      serverUrl,
      controlToken: services.localControlToken,
      config: projectConfig,
      secrets: services.secrets,
      localServer: services.localServer,
      launchd: services.launchd
    });
    if (!status.online || !status.backendsReady) {
      services.output.stdout("Ballet opened before the saved runtime finished reporting readiness; diagnostics remain available in Runtimes.");
    }
  } catch (error) {
    services.output.stdout(`Stored runtime could not be restored automatically: ${error instanceof Error ? error.message : String(error)}`);
    await services.openUrl(new URL("/runtimes?connect=1", serverUrl).toString());
    return;
  }
  await services.openUrl(serverUrl);
};
