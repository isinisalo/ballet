import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Agent, AgentOutcome } from "../shared/domain.js";
import { agentOutcomeSchema, parseAgentOutcomeText } from "./runtime-policy.js";

type JsonRpcId = string | number;

interface JsonRpcMessage {
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
  };
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export interface CodexRunOptions {
  runId: string;
  workItemId: string;
  agentRole: string;
  agent: Agent;
  prompt: string;
  projectRoot: string;
  resumeThreadId?: string;
  timeoutMs?: number;
  codexCommand?: string;
  onLog?: (level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) => void;
  onThread?: (threadId: string, turnId?: string) => void;
}

export interface CodexRunResult {
  threadId: string;
  turnId?: string;
  outcome: AgentOutcome;
}

class JsonLineRpcClient {
  private nextId = 1;
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private closed = false;
  private stderrTail = "";

  constructor(
    private readonly proc: ChildProcessWithoutNullStreams,
    private readonly onNotification: (message: JsonRpcMessage) => void,
    private readonly onLog: NonNullable<CodexRunOptions["onLog"]>
  ) {
    const rl = createInterface({ input: proc.stdout });
    rl.on("line", (line) => this.handleLine(line));
    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8").trim();
      if (text) {
        this.stderrTail = `${this.stderrTail}\n${text}`.trim().slice(-2000);
        this.onLog("warn", "codex stderr", { text });
      }
    });
    proc.on("error", (error) => {
      this.closed = true;
      const enriched = new Error(`codex app-server failed to start: ${error.message}`);
      for (const pending of this.pending.values()) pending.reject(enriched);
      this.pending.clear();
    });
    proc.on("exit", (code, signal) => {
      this.closed = true;
      const stderr = this.stderrTail ? ` Stderr: ${this.stderrTail}` : "";
      const error = new Error(`codex app-server exited with code ${code ?? "null"} signal ${signal ?? "null"}.${stderr}`);
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    });
  }

  request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (this.closed) return Promise.reject(new Error("codex app-server is already closed."));
    const id = this.nextId++;
    const message = { method, id, params: params ?? {} };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send(message);
    });
  }

  notify(method: string, params?: Record<string, unknown>): void {
    this.send({ method, params: params ?? {} });
  }

  close(): void {
    this.closed = true;
    this.proc.stdin.end();
  }

  private send(message: Record<string, unknown>): void {
    const payload = Object.prototype.hasOwnProperty.call(message, "jsonrpc")
      ? message
      : { jsonrpc: "2.0", ...message };
    this.proc.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  private handleLine(line: string): void {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch (error) {
      this.onLog("warn", "Ignoring non-JSON codex stdout line.", { line, error: error instanceof Error ? error.message : String(error) });
      return;
    }

    if (message.id !== undefined && this.pending.has(message.id) && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? `JSON-RPC error ${message.error.code ?? "unknown"}`));
      else pending.resolve(message.result);
      return;
    }

    if (message.id !== undefined && message.method) {
      this.respondToServerRequest(message);
      return;
    }

    this.onNotification(message);
  }

  private respondToServerRequest(message: JsonRpcMessage): void {
    if (message.id === undefined || !message.method) return;
    switch (message.method) {
      case "item/commandExecution/requestApproval":
      case "item/fileChange/requestApproval":
      case "item/permissions/requestApproval":
        this.send({ id: message.id, result: { decision: "accept" } });
        return;
      case "execCommandApproval":
      case "applyPatchApproval":
        this.send({ id: message.id, result: { decision: "approved" } });
        return;
      case "mcpServer/elicitation/request":
        this.send({ id: message.id, result: { action: "cancel", content: {}, _meta: {} } });
        return;
      default:
        this.send({
          id: message.id,
          error: {
            code: -32601,
            message: `Ballet agentd does not support Codex server request ${message.method}.`
          }
        });
    }
  }
}

const safePathPart = (value: string): string => value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "run";

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const prepareCodexHome = async (projectRoot: string, workItemId: string, agentRole: string): Promise<string> => {
  const homeRoot = process.env.BALLET_CODEX_HOME_ROOT
    ? path.resolve(projectRoot, process.env.BALLET_CODEX_HOME_ROOT)
    : path.join(projectRoot, "data", "codex-home");
  const codexHome = path.join(homeRoot, `${safePathPart(workItemId)}-${safePathPart(agentRole)}`);
  await mkdir(codexHome, { recursive: true });

  const sourceHome = process.env.BALLET_CODEX_HOME_TEMPLATE
    ? path.resolve(projectRoot, process.env.BALLET_CODEX_HOME_TEMPLATE)
    : process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
  for (const filename of ["auth.json", "credentials.json", "device.json", "device_id"]) {
    const source = path.join(sourceHome, filename);
    if (await exists(source)) {
      await copyFile(source, path.join(codexHome, filename));
    }
  }

  await writeFile(
    path.join(codexHome, "config.toml"),
    [
      "# Generated by Ballet agentd. Do not edit by hand.",
      "[agents]",
      "max_depth = 0",
      "max_threads = 1",
      ""
    ].join("\n"),
    { mode: 0o600 }
  );

  return codexHome;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const threadIdFromResult = (result: unknown): string | undefined => {
  const record = asRecord(result);
  const thread = asRecord(record.thread);
  return typeof thread.id === "string" ? thread.id : undefined;
};

const turnIdFromResult = (result: unknown): string | undefined => {
  const record = asRecord(result);
  const turn = asRecord(record.turn);
  return typeof turn.id === "string" ? turn.id : undefined;
};

const turnStatusFromNotification = (message: JsonRpcMessage): { id?: string; status?: string; error?: string } => {
  const params = asRecord(message.params);
  const turn = asRecord(params.turn);
  const error = asRecord(turn.error);
  return {
    id: typeof turn.id === "string" ? turn.id : undefined,
    status: typeof turn.status === "string" ? turn.status : undefined,
    error: typeof error.message === "string" ? error.message : undefined
  };
};

export const runCodexAgent = async (options: CodexRunOptions): Promise<CodexRunResult> => {
  const onLog = options.onLog ?? (() => undefined);
  const codexHome = await prepareCodexHome(options.projectRoot, options.workItemId, options.agentRole);
  const proc = spawn(options.codexCommand ?? "codex", ["app-server", "--listen", "stdio://"], {
    cwd: options.projectRoot,
    env: { ...process.env, CODEX_HOME: codexHome },
    stdio: ["pipe", "pipe", "pipe"]
  });

  let threadId = options.resumeThreadId;
  let turnId: string | undefined;
  let finalAgentMessage = "";
  let turnCompleted: ((value: void) => void) | undefined;
  let turnFailed: ((error: Error) => void) | undefined;

  const turnPromise = new Promise<void>((resolve, reject) => {
    turnCompleted = resolve;
    turnFailed = reject;
  });

  const client = new JsonLineRpcClient(proc, (message) => {
    if (message.method === "turn/started") {
      const params = asRecord(message.params);
      const turn = asRecord(params.turn);
      if (typeof turn.id === "string") {
        turnId = turn.id;
        if (threadId) options.onThread?.(threadId, turnId);
      }
      return;
    }

    if (message.method === "item/completed") {
      const params = asRecord(message.params);
      const item = asRecord(params.item);
      if (item.type === "agentMessage" && item.phase === "final_answer" && typeof item.text === "string") {
        finalAgentMessage = item.text;
      }
      return;
    }

    if (message.method === "turn/completed") {
      const turn = turnStatusFromNotification(message);
      if (turn.id) turnId = turn.id;
      if (turn.status && turn.status !== "completed") {
        turnFailed?.(new Error(turn.error ?? `Codex turn ended with status ${turn.status}.`));
      } else {
        turnCompleted?.();
      }
      return;
    }

    if (message.method === "error") {
      const params = asRecord(message.params);
      const error = asRecord(params.error);
      turnFailed?.(new Error(typeof error.message === "string" ? error.message : "Codex app-server emitted an error."));
    }
  }, onLog);

  const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000;
  const timeout = setTimeout(() => {
    turnFailed?.(new Error(`Codex run timed out after ${timeoutMs}ms.`));
    proc.kill("SIGTERM");
  }, timeoutMs);

  try {
    await client.request("initialize", {
      clientInfo: {
        name: "ballet-agentd",
        title: "Ballet Agent Runtime",
        version: "0.1.0"
      },
      capabilities: {
        experimentalApi: true
      }
    });
    client.notify("initialized");

    const sharedThreadParams = {
      model: options.agent.model ?? undefined,
      cwd: options.projectRoot,
      approvalPolicy: "never",
      permissionProfile: { type: "disabled" },
      developerInstructions: options.agent.instructions,
      persistExtendedHistory: true
    };
    const startThreadParams = {
      ...sharedThreadParams,
      experimentalRawEvents: false
    };

    if (threadId) {
      try {
        const result = await client.request("thread/resume", {
          ...sharedThreadParams,
          threadId,
          excludeTurns: true
        });
        threadId = threadIdFromResult(result) ?? threadId;
      } catch (error) {
        onLog("warn", "Codex thread resume failed; starting a fresh thread.", {
          threadId,
          error: error instanceof Error ? error.message : String(error)
        });
        threadId = undefined;
      }
    }

    if (!threadId) {
      const result = await client.request("thread/start", startThreadParams);
      threadId = threadIdFromResult(result);
      if (!threadId) throw new Error("Codex thread/start did not return a thread id.");
    }
    options.onThread?.(threadId);

    const turnResult = await client.request("turn/start", {
      threadId,
      input: [{ type: "text", text: options.prompt }],
      cwd: options.projectRoot,
      approvalPolicy: "never",
      permissionProfile: { type: "disabled" },
      model: options.agent.model ?? undefined,
      effort: options.agent.modelReasoningEffort ?? undefined,
      outputSchema: agentOutcomeSchema
    });
    turnId = turnIdFromResult(turnResult) ?? turnId;
    options.onThread?.(threadId, turnId);

    await turnPromise;
    if (!finalAgentMessage.trim()) throw new Error("Codex completed without a final agentMessage.");
    return {
      threadId,
      turnId,
      outcome: parseAgentOutcomeText(finalAgentMessage)
    };
  } finally {
    clearTimeout(timeout);
    client.close();
  }
};
