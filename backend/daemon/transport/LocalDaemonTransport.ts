import type {
  LocalDaemonEvent, LocalDaemonHeartbeat, LocalDaemonHeartbeatResult,
  LocalDaemonLeaseResult, LocalDaemonTaskClaim, RuntimeProvider
} from "../../../shared/domain/runtime.js";

export class LocalDaemonTransportError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = "LocalDaemonTransportError"; }
}

export class LocalDaemonTransport {
  private readonly baseUrl: URL;
  constructor(serverUrl: string, private readonly token: string, private readonly fetchImpl: typeof fetch = fetch) {
    this.baseUrl = new URL(serverUrl);
    if (this.baseUrl.protocol !== "http:" || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(this.baseUrl.hostname)) {
      throw new Error("Local daemon transport requires a loopback HTTP server.");
    }
    if (!/^[0-9a-f]{64}$/i.test(token)) throw new Error("Local daemon transport token is malformed.");
  }

  heartbeat(input: LocalDaemonHeartbeat, signal?: AbortSignal): Promise<LocalDaemonHeartbeatResult> {
    return this.json("/api/daemon/heartbeat", input, signal);
  }
  async claim(provider: RuntimeProvider, signal?: AbortSignal): Promise<LocalDaemonTaskClaim | undefined> {
    return this.json("/api/daemon/tasks/claim", { provider }, signal, true);
  }
  renew(claim: LocalDaemonTaskClaim, signal?: AbortSignal): Promise<LocalDaemonLeaseResult> {
    return this.json(`/api/daemon/tasks/${encodeURIComponent(claim.taskId)}/lease`, { fencing: claim.fencing }, signal);
  }
  appendEvents(claim: LocalDaemonTaskClaim, events: LocalDaemonEvent[], signal?: AbortSignal): Promise<{ accepted: number }> {
    return this.json(`/api/daemon/tasks/${encodeURIComponent(claim.taskId)}/events`, { fencing: claim.fencing, events }, signal);
  }
  complete(claim: LocalDaemonTaskClaim, providerOutcomeKey: string, rawOutput: string, signal?: AbortSignal): Promise<{ applied: boolean }> {
    return this.json(`/api/daemon/tasks/${encodeURIComponent(claim.taskId)}/complete`, {
      fencing: claim.fencing, providerOutcomeKey, rawOutput
    }, signal);
  }
  fail(claim: LocalDaemonTaskClaim, providerOutcomeKey: string, errorMessage: string, signal?: AbortSignal): Promise<{ applied: boolean }> {
    return this.json(`/api/daemon/tasks/${encodeURIComponent(claim.taskId)}/fail`, {
      fencing: claim.fencing, providerOutcomeKey, errorMessage
    }, signal);
  }
  diagnostics(lines: string[], signal?: AbortSignal): Promise<{ accepted: number }> {
    return this.json("/api/daemon/diagnostics", { lines }, signal);
  }
  async acknowledge(kind: "refresh" | "restart", signal?: AbortSignal): Promise<void> {
    await this.json(`/api/daemon/requests/${kind}/ack`, {}, signal, false, true);
  }

  private async json<T>(pathname: string, body: unknown, signal?: AbortSignal, allowEmpty = false, noContent = false): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(new URL(pathname, this.baseUrl), {
        method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${this.token}` },
        body: JSON.stringify(body), signal
      });
    } catch (error) {
      throw new LocalDaemonTransportError(`Local daemon request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (allowEmpty && response.status === 204) return undefined as T;
    if (noContent && response.status === 204) return undefined as T;
    if (!response.ok) throw new LocalDaemonTransportError(
      `Local daemon request returned ${response.status}: ${(await response.text()).slice(0, 500)}`, response.status);
    try { return await response.json() as T; }
    catch (error) { throw new LocalDaemonTransportError(`Local daemon response was invalid JSON: ${String(error)}`, response.status); }
  }
}
