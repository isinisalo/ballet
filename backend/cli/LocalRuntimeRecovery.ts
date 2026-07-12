import type { DaemonConfig } from "../daemon/config/DaemonConfigStore.js";
import type { LaunchdService } from "./LaunchdService.js";
import type { LocalRuntimeStatus, LocalServerService } from "./LocalServerService.js";
import { daemonKeychainAccount, type SecretStore } from "./Keychain.js";

export const restoreConfiguredLocalRuntime = async (input: {
  serverUrl: string;
  controlToken: string;
  config: DaemonConfig;
  secrets: SecretStore;
  localServer: LocalServerService;
  launchd: () => LaunchdService;
}): Promise<LocalRuntimeStatus> => {
  const account = daemonKeychainAccount(input.config.serverUrl, input.config.deviceId);
  const daemonToken = await input.secrets.get(account);
  if (daemonToken.length < 32) throw new Error("The saved daemon credential is missing from macOS Keychain.");
  await input.localServer.recoverRuntime(input.serverUrl, input.controlToken, input.config, daemonToken);
  try {
    const daemon = input.launchd();
    if (!(await daemon.status()).running) await daemon.installAndStart();
    return await input.localServer.waitForRuntime(input.serverUrl, input.controlToken, input.config.deviceId);
  } catch {
    return { registered: true, online: false, backendsReady: false };
  }
};
