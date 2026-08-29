import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import type { ControlPlaneService } from "./ControlPlaneService.js";

interface LiveSocket extends WebSocket {
  isAlive: boolean;
  deviceId: string;
}

export interface DaemonWebSocketHubOptions {
  service: ControlPlaneService;
  path?: string;
  pingIntervalMs?: number;
}

export class DaemonWebSocketHub {
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly sockets = new Map<string, Set<LiveSocket>>();
  private readonly path: string;
  private readonly pingInterval: ReturnType<typeof setInterval>;
  private readonly unsubscribe: () => void;

  constructor(private readonly options: DaemonWebSocketHubOptions) {
    this.path = options.path ?? "/api/daemon/ws";
    this.pingInterval = setInterval(() => this.ping(), options.pingIntervalMs ?? 25_000);
    this.pingInterval.unref();
    this.unsubscribe = options.service.onChange((type, payload) => this.onServiceChange(type, payload));
    this.wss.on("connection", (socket: LiveSocket) => this.register(socket));
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== this.path) return false;
    try {
      const token = bearerToken(request.headers.authorization);
      const identity = this.options.service.authenticateDaemon(token);
      this.wss.handleUpgrade(request, socket, head, (webSocket) => {
        const live = webSocket as LiveSocket;
        live.deviceId = identity.deviceId;
        live.isAlive = true;
        this.wss.emit("connection", live, request);
      });
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
    }
    return true;
  }

  attach(server: Server): () => void {
    const listener = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      void this.handleUpgrade(request, socket, head);
    };
    server.on("upgrade", listener);
    return () => server.off("upgrade", listener);
  }

  close(): void {
    clearInterval(this.pingInterval);
    this.unsubscribe();
    for (const socket of this.wss.clients) socket.terminate();
    this.wss.close();
  }

  private register(socket: LiveSocket): void {
    const deviceSockets = this.sockets.get(socket.deviceId) ?? new Set<LiveSocket>();
    deviceSockets.add(socket);
    this.sockets.set(socket.deviceId, deviceSockets);
    socket.on("pong", () => { socket.isAlive = true; });
    socket.on("close", () => {
      deviceSockets.delete(socket);
      if (deviceSockets.size === 0) this.sockets.delete(socket.deviceId);
    });
    send(socket, { type: "connected", deviceId: socket.deviceId });
  }

  private ping(): void {
    for (const socket of this.wss.clients as Set<LiveSocket>) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }

  private onServiceChange(type: string, payload: Record<string, unknown>): void {
    if (type === "task_available" && typeof payload.runtimeBackendId === "string") {
      const deviceId = this.options.service.backendDeviceId(payload.runtimeBackendId);
      if (deviceId) this.notify(deviceId, { type: "task.available", runtimeBackendId: payload.runtimeBackendId });
      return;
    }
    if (type === "task_cancel_requested" && typeof payload.deviceId === "string" && typeof payload.taskId === "string") {
      this.notify(payload.deviceId, { type: "task.cancel", taskId: payload.taskId });
      return;
    }
    if (type === "root_finalize_requested" && typeof payload.deviceId === "string"
      && typeof payload.projectId === "string" && typeof payload.rootRunId === "string"
      && typeof payload.success === "boolean") {
      this.notify(payload.deviceId, {
        type: "root.finalize",
        projectId: payload.projectId,
        rootRunId: payload.rootRunId,
        success: payload.success
      });
      return;
    }
    if (type === "restart_requested" && typeof payload.deviceId === "string") {
      this.notify(payload.deviceId, { type: "daemon.restart" });
      return;
    }
    if (type === "refresh_requested" && typeof payload.deviceId === "string") {
      this.notify(payload.deviceId, {
        type: "runtime.refresh",
        ...(typeof payload.requestId === "string" ? { requestId: payload.requestId } : {})
      });
    }
  }

  private notify(deviceId: string, payload: Record<string, unknown>): void {
    for (const socket of this.sockets.get(deviceId) ?? []) send(socket, payload);
  }
}

const bearerToken = (authorization: string | undefined): string => {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new Error("Missing daemon token.");
  return match[1];
};

const send = (socket: WebSocket, payload: Record<string, unknown>): void => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
};
