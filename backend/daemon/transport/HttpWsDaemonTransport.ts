import WebSocket from "ws";
import type {
  ClaimedExecutionTask,
  DaemonControlPlane,
  DaemonHeartbeatPayload,
  DaemonHeartbeatResult,
  DaemonWakeup,
  DaemonWakeupSubscription,
  LeaseResult,
  RuntimeEventUpload,
  RootFinalizationReport,
  TaskCancellation,
  TaskCompletion,
  TaskDispositionResult,
  TaskFailure
} from "./DaemonControlPlane.js";
import { defaultDaemonServerContract, type DaemonServerContract } from "./DaemonServerContract.js";

export interface HttpWsDaemonTransportOptions {
  baseUrl: string;
  daemonToken: string;
  contract?: DaemonServerContract;
  fetch?: typeof fetch;
  createSocket?: (url: string, token: string) => WebSocket;
}

export class DaemonTransportError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false
  ) {
    super(message);
    this.name = "DaemonTransportError";
  }
}

export class HttpWsDaemonTransport implements DaemonControlPlane {
  private readonly baseUrl: URL;
  private readonly token: string;
  private readonly contract: DaemonServerContract;
  private readonly fetchImpl: typeof fetch;
  private readonly socketFactory: (url: string, token: string) => WebSocket;

  constructor(options: HttpWsDaemonTransportOptions) {
    this.baseUrl = new URL(options.baseUrl);
    if (this.baseUrl.protocol !== "https:" && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(this.baseUrl.hostname.toLowerCase())) {
      throw new Error("Remote daemon control-plane URLs must use HTTPS.");
    }
    if (options.daemonToken.length < 32) throw new Error("Daemon bearer token is missing or malformed.");
    this.token = options.daemonToken;
    this.contract = options.contract ?? defaultDaemonServerContract;
    this.fetchImpl = options.fetch ?? fetch;
    this.socketFactory = options.createSocket ?? ((url, token) => new WebSocket(url, "ballet.daemon.v1", {
      headers: { Authorization: `Bearer ${token}` }
    }));
  }

  heartbeat(payload: DaemonHeartbeatPayload, signal?: AbortSignal): Promise<DaemonHeartbeatResult> {
    return this.request("POST", this.contract.heartbeat, payload, this.token, signal);
  }

  diagnostics(lines: string[], signal?: AbortSignal): Promise<void> {
    if (lines.length === 0) return Promise.resolve();
    return this.request("POST", this.contract.diagnostics, { lines }, this.token, signal);
  }

  async claim(runtimeBackendId: string, signal?: AbortSignal): Promise<ClaimedExecutionTask | undefined> {
    const response = await this.rawRequest("POST", this.contract.claim, { runtimeBackendId }, this.token, signal);
    if (response.status === 204) return undefined;
    return this.decode<ClaimedExecutionTask>(response);
  }

  async renewLease(claim: ClaimedExecutionTask, signal?: AbortSignal): Promise<LeaseResult> {
    const result = await this.request<unknown>("POST", this.contract.taskLease(claim.task.id), fenced(claim), this.token, signal);
    return validateLeaseResult(result);
  }

  setTaskState(claim: ClaimedExecutionTask, status: "preparing" | "running", signal?: AbortSignal): Promise<void> {
    return this.request("POST", this.contract.taskState(claim.task.id), { ...fenced(claim), status }, this.token, signal);
  }

  appendEvents(claim: ClaimedExecutionTask, events: RuntimeEventUpload[], signal?: AbortSignal): Promise<void> {
    if (events.length === 0) return Promise.resolve();
    return this.request("POST", this.contract.taskEvents(claim.task.id), { ...fenced(claim), events }, this.token, signal);
  }

  complete(claim: ClaimedExecutionTask, completion: TaskCompletion, signal?: AbortSignal): Promise<TaskDispositionResult> {
    return this.request("POST", this.contract.taskComplete(claim.task.id), { ...fenced(claim), ...completion }, this.token, signal);
  }

  cancel(claim: ClaimedExecutionTask, cancellation: TaskCancellation, signal?: AbortSignal): Promise<TaskDispositionResult> {
    return this.request("POST", this.contract.taskCancel(claim.task.id), { ...fenced(claim), ...cancellation }, this.token, signal);
  }

  fail(claim: ClaimedExecutionTask, failure: TaskFailure, signal?: AbortSignal): Promise<TaskDispositionResult> {
    return this.request("POST", this.contract.taskFail(claim.task.id), { ...fenced(claim), ...failure }, this.token, signal);
  }

  reportRootFinalization(
    claim: ClaimedExecutionTask,
    rootRunId: string,
    report: RootFinalizationReport,
    signal?: AbortSignal
  ): Promise<void> {
    return this.request("POST", this.contract.rootFinalize(rootRunId), { ...fenced(claim), ...report }, this.token, signal);
  }

  reportRequestedRootFinalization(
    projectId: string,
    rootRunId: string,
    report: RootFinalizationReport,
    signal?: AbortSignal
  ): Promise<void> {
    return this.request("POST", this.contract.rootFinalize(rootRunId), { projectId, ...report }, this.token, signal);
  }

  subscribe(
    onWakeup: (event: DaemonWakeup) => void,
    onDisconnect: (error?: Error) => void
  ): Promise<DaemonWakeupSubscription> {
    const socket = this.socketFactory(this.websocketUrl(), this.token);
    let closed = false;
    let opened = false;
    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as DaemonWakeup;
        if (isWakeup(message)) onWakeup(message);
      } catch {
        // Invalid frames never gain control of the daemon. The next valid frame can still wake it.
      }
    });
    let rejectOpening: ((error: Error) => void) | undefined;
    socket.on("error", (error) => {
      if (!opened) rejectOpening?.(error);
      else onDisconnect(error);
    });
    socket.on("close", () => {
      closed = true;
      if (!opened) rejectOpening?.(new Error("Daemon WebSocket closed before opening."));
      else onDisconnect();
    });
    const subscription: DaemonWakeupSubscription = {
      get closed() { return closed; },
      close: () => new Promise<void>((resolve) => {
        if (closed) return resolve();
        socket.once("close", () => resolve());
        socket.close(1000, "daemon shutdown");
      })
    };
    return new Promise((resolve, reject) => {
      rejectOpening = reject;
      socket.once("open", () => {
        opened = true;
        resolve(subscription);
      });
    });
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body: unknown,
    token: string,
    signal?: AbortSignal
  ): Promise<T> {
    const response = await this.rawRequest(method, endpoint, body, token, signal);
    if (response.status === 204) return undefined as T;
    return this.decode<T>(response);
  }

  private async rawRequest(
    method: string,
    endpoint: string,
    body: unknown,
    token: string,
    signal?: AbortSignal
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(new URL(endpoint, this.baseUrl), {
        method,
        signal: boundedSignal(signal),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      throw new DaemonTransportError(`Control-plane request failed: ${error instanceof Error ? error.message : String(error)}`, undefined, true);
    }
    if (!response.ok) {
      const text = (await response.text()).slice(0, 4000);
      throw new DaemonTransportError(`Control-plane request returned ${response.status}: ${text || response.statusText}`, response.status, response.status >= 500 || response.status === 429);
    }
    return response;
  }

  private async decode<T>(response: Response): Promise<T> {
    try {
      return await response.json() as T;
    } catch (error) {
      throw new DaemonTransportError(`Control-plane returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`, response.status);
    }
  }

  private websocketUrl(): string {
    const url = new URL(this.contract.websocket, this.baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  }
}

const fenced = (claim: ClaimedExecutionTask) => ({
  taskToken: claim.taskToken,
  fencing: claim.task.fencing
});

const boundedSignal = (signal?: AbortSignal): AbortSignal => {
  const timeout = AbortSignal.timeout(30_000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
};

const isWakeup = (value: unknown): value is DaemonWakeup => {
  if (!value || typeof value !== "object") return false;
  const event = value as {
    type?: unknown;
    runtimeBackendId?: unknown;
    taskId?: unknown;
    requestId?: unknown;
    projectId?: unknown;
    rootRunId?: unknown;
    success?: unknown;
  };
  if (event.type === "task.available") return typeof event.runtimeBackendId === "string" && event.runtimeBackendId.length > 0;
  if (event.type === "task.cancel") return typeof event.taskId === "string" && event.taskId.length > 0;
  if (event.type === "root.finalize") {
    return typeof event.projectId === "string" && event.projectId.length > 0
      && typeof event.rootRunId === "string" && event.rootRunId.length > 0
      && typeof event.success === "boolean";
  }
  if (event.type === "runtime.refresh") {
    return event.requestId === undefined || typeof event.requestId === "string";
  }
  return event.type === "daemon.restart";
};

const validateLeaseResult = (value: unknown): LeaseResult => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DaemonTransportError("Control-plane returned an invalid lease response.");
  }
  const result = value as Record<string, unknown>;
  if (typeof result.accepted !== "boolean"
    || (result.cancelRequested !== undefined && typeof result.cancelRequested !== "boolean")
    || (result.leaseUntil !== undefined && (typeof result.leaseUntil !== "string" || Number.isNaN(Date.parse(result.leaseUntil))))) {
    throw new DaemonTransportError("Control-plane returned an invalid lease response.");
  }
  return {
    accepted: result.accepted,
    leaseUntil: result.leaseUntil as string | undefined,
    cancelRequested: result.cancelRequested as boolean | undefined
  };
};
