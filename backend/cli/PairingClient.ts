import type { DaemonConfig } from "../daemon/config/DaemonConfigStore.js";

export interface PairingSession {
  pairingId: string;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: string;
  intervalSeconds: number;
}

export interface PairingClaim {
  deviceId: string;
  daemonToken: string;
}

export interface PairingDeviceFacts {
  hostname: string;
  displayName?: string;
  platform: "darwin";
  architecture: "arm64" | "x64";
  daemonVersion: string;
  daemonId: string;
}

export class PairingExpiredError extends Error {
  constructor(message = "Pairing session expired or was already claimed.") {
    super(message);
    this.name = "PairingExpiredError";
  }
}

export class PairingClient {
  constructor(
    private readonly serverUrl: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    const url = new URL(serverUrl);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname.toLowerCase())) {
      throw new Error("Remote pairing URLs must use HTTPS.");
    }
  }

  async create(facts: PairingDeviceFacts, signal?: AbortSignal): Promise<PairingSession> {
    const response = await this.fetchImpl(new URL("/api/daemon/pairing/sessions", this.serverUrl), {
      method: "POST",
      signal: boundedSignal(signal),
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(facts.displayName ? { displayName: facts.displayName } : {})
    });
    return this.decode<PairingSession>(response);
  }

  async pollUntilApproved(
    session: PairingSession,
    facts: PairingDeviceFacts,
    onPending?: () => void,
    signal?: AbortSignal
  ): Promise<PairingClaim> {
    return this.pollDeviceCode(session.deviceCode, facts, {
      deadline: new Date(session.expiresAt).getTime(),
      intervalSeconds: session.intervalSeconds,
      onPending,
      signal
    });
  }

  async pollDeviceCode(
    deviceCode: string,
    facts: PairingDeviceFacts,
    options: { deadline?: number; intervalSeconds?: number; onPending?: () => void; signal?: AbortSignal } = {}
  ): Promise<PairingClaim> {
    if (deviceCode.length < 32) throw new Error("--device-code is missing or malformed.");
    const deadline = options.deadline ?? Date.now() + 10 * 60_000;
    const signal = options.signal;
    while (!signal?.aborted && Date.now() < deadline) {
      const response = await this.fetchImpl(new URL("/api/daemon/pairing/poll", this.serverUrl), {
        method: "POST",
        signal: boundedSignal(signal),
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ deviceCode, ...facts })
      });
      if (response.status === 202) {
        options.onPending?.();
        await delay(Math.max(1, options.intervalSeconds ?? 2) * 1000, signal);
        continue;
      }
      if (response.status === 410) throw new PairingExpiredError();
      const claimed = await this.decode<{ status: string; deviceId: string; daemonToken: string }>(response);
      if (claimed.status !== "claimed" || !claimed.deviceId || claimed.daemonToken.length < 32) {
        throw new Error("Pairing server returned an invalid claimed response.");
      }
      return { deviceId: claimed.deviceId, daemonToken: claimed.daemonToken };
    }
    if (signal?.aborted) throw signal.reason;
    throw new PairingExpiredError();
  }

  private async decode<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 2000);
      throw new Error(`Pairing request returned ${response.status}: ${detail || response.statusText}`);
    }
    try {
      return await response.json() as T;
    } catch (error) {
      throw new Error(`Pairing server returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const pairingFactsFromConfig = (config: Pick<DaemonConfig, "displayName" | "daemonVersion" | "daemonId">): PairingDeviceFacts => ({
  hostname: process.env.HOSTNAME ?? config.displayName,
  displayName: config.displayName,
  platform: "darwin",
  architecture: process.arch === "arm64" ? "arm64" : "x64",
  daemonVersion: config.daemonVersion,
  daemonId: config.daemonId
});

const delay = (milliseconds: number, signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
  const timer = setTimeout(finish, milliseconds);
  const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(signal?.reason); };
  signal?.addEventListener("abort", abort, { once: true });
});

const boundedSignal = (signal?: AbortSignal): AbortSignal => {
  const timeout = AbortSignal.timeout(30_000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
};
