import type { DaemonConfig, DaemonConfigStore } from "../daemon/config/DaemonConfigStore.js";
import { localControlToken } from "./LocalControlToken.js";
import { isLocalServerUrl, type LocalServerConfiguration, type LocalServerService } from "./LocalServerService.js";

export const restartConfiguredLocalServer = async (store: DaemonConfigStore, server: LocalServerService): Promise<void> => {
  const config = await store.load();
  if (!isLocalServerUrl(config.appUrl)) return;
  await server.restart({ ...localConfiguration(config), localControlToken: await localControlToken(store.home) });
};

const localConfiguration = (config: DaemonConfig): LocalServerConfiguration => {
  if (!config.projectId || !config.repositoryUrl || !config.repositoryPath) {
    throw new Error("Local Ballet server configuration is incomplete. Run `ballet setup` from the project checkout again.");
  }
  return {
    serverUrl: config.appUrl,
    projectId: config.projectId,
    repositoryUrl: config.repositoryUrl,
    repositoryPath: config.repositoryPath
  };
};
