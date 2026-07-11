import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SERVICE = "ai.ballet.daemon";

export interface SecretStore {
  set(account: string, secret: string): Promise<void>;
  get(account: string): Promise<string>;
  delete(account: string): Promise<void>;
}

export class MacOsKeychain implements SecretStore {
  private ensureSupported(): void {
    if (process.platform !== "darwin") throw new Error("Ballet daemon credentials currently require macOS Keychain.");
  }

  async set(account: string, secret: string): Promise<void> {
    this.ensureSupported();
    await execFileAsync("security", ["add-generic-password", "-U", "-a", account, "-s", SERVICE, "-w", secret]);
  }

  async get(account: string): Promise<string> {
    this.ensureSupported();
    const result = await execFileAsync("security", ["find-generic-password", "-a", account, "-s", SERVICE, "-w"]);
    const secret = result.stdout.trim();
    if (!secret) throw new Error("Ballet daemon credential is missing from macOS Keychain. Run `ballet setup` again.");
    return secret;
  }

  async delete(account: string): Promise<void> {
    this.ensureSupported();
    await execFileAsync("security", ["delete-generic-password", "-a", account, "-s", SERVICE]).catch(() => undefined);
  }
}

export const daemonKeychainAccount = (serverUrl: string, deviceId: string): string =>
  `${new URL(serverUrl).origin}:${deviceId}`;
