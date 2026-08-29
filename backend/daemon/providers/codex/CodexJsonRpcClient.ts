import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

export type JsonRpcId = string | number;

export interface CodexRpcMessage {
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

export class CodexJsonRpcClient {
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private nextId = 1;
  private closed = false;
  private stderrTail = "";

  constructor(
    private readonly process: ChildProcessWithoutNullStreams,
    private readonly onNotification: (message: CodexRpcMessage) => void,
    private readonly onServerRequest: (message: CodexRpcMessage) => Promise<unknown>,
    private readonly onFailure?: (error: Error) => void
  ) {
    const lines = createInterface({ input: process.stdout });
    lines.on("line", (line) => this.receiveLine(line));
    process.stderr.on("data", (chunk: Buffer) => {
      this.stderrTail = `${this.stderrTail}${chunk.toString("utf8")}`.slice(-4096);
    });
    process.on("error", (error) => this.fail(new Error(
      error.name === "AbortError" ? "Codex app-server was aborted." : `Codex failed to start: ${error.message}`
    )));
    process.on("exit", (code, signal) => {
      if (this.closed) return;
      const detail = this.stderrTail.trim() ? ` ${this.stderrTail.trim()}` : "";
      this.fail(new Error(`Codex app-server exited (${code ?? signal ?? "unknown"}).${detail}`));
    });
  }

  request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (this.closed) return Promise.reject(new Error("Codex app-server connection is closed."));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.write({ id, method, params });
    });
  }

  notify(method: string, params: Record<string, unknown> = {}): void {
    if (!this.closed) this.write({ method, params });
  }

  respond(id: JsonRpcId, result?: unknown, error?: { code: number; message: string }): void {
    if (this.closed) return;
    this.write(error ? { id, error } : { id, result: result ?? {} });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.process.stdin.end();
    this.rejectAll(new Error("Codex app-server connection closed."));
  }

  forceKill(): void {
    if (this.closed) return;
    this.process.kill("SIGKILL");
    this.fail(new Error("Codex app-server was killed."));
  }

  private write(payload: Record<string, unknown>): void {
    this.process.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...payload })}\n`);
  }

  private receiveLine(line: string): void {
    let message: CodexRpcMessage;
    try {
      message = JSON.parse(line) as CodexRpcMessage;
    } catch {
      this.onNotification({ method: "ballet/nonJsonOutput", params: { line } });
      return;
    }
    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? "Codex JSON-RPC request failed."));
      else pending.resolve(message.result);
      return;
    }
    if (message.id !== undefined && message.method) {
      void this.handleServerRequest(message);
      return;
    }
    this.onNotification(message);
  }

  private async handleServerRequest(message: CodexRpcMessage): Promise<void> {
    if (message.id === undefined) return;
    try {
      this.respond(message.id, await this.onServerRequest(message));
    } catch (error) {
      this.respond(message.id, undefined, {
        code: -32001,
        message: error instanceof Error ? error.message : "Ballet denied the Codex request."
      });
    }
  }

  private rejectAll(error: Error): void {
    this.closed = true;
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }

  private fail(error: Error): void {
    if (this.closed) return;
    this.rejectAll(error);
    this.onFailure?.(error);
  }
}
