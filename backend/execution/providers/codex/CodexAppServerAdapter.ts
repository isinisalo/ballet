import { spawn } from "node:child_process";
import path from "node:path";
import { AsyncEventQueue } from "../../AsyncEventQueue.js";
import type {
  CliRuntimeAdapter,
  RuntimeEvent,
  RuntimeExecutionRequest,
  RuntimeModel,
  RuntimePermissionRequest,
  RuntimeProbe
} from "../CliRuntimeAdapter.js";
import { denyAllRuntimePermissions } from "../CliRuntimeAdapter.js";
import { probeCommandVersion, providerChildEnvironment, resolveCommandPath, runCommandCapture } from "../processProbe.js";
import { isVersionAtLeast } from "../semanticVersion.js";
import {
  modelsFromCodexResult,
  nextCodexModelCursor,
  normalizeCodexNotification,
  threadIdFromCodexResult,
  turnIdFromCodexResult,
  type CodexTurnState
} from "./CodexEventNormalizer.js";
import { CodexJsonRpcClient, type CodexRpcMessage } from "./CodexJsonRpcClient.js";

const CLIENT_INFO = { name: "ballet", title: "Ballet local runtime", version: "0.1.0" };

interface ActiveCodexExecution {
  client: CodexJsonRpcClient;
  threadId?: string;
  turnId?: string;
}

export interface CodexAppServerOptions {
  command?: string;
  minimumVersion?: string;
}

export class CodexAppServerAdapter implements CliRuntimeAdapter {
  readonly provider = "codex" as const;
  readonly minimumVersion: string;
  private readonly command: string;
  private readonly active = new Map<string, ActiveCodexExecution>();

  constructor(options: CodexAppServerOptions = {}) {
    this.command = options.command ?? "codex";
    this.minimumVersion = options.minimumVersion ?? "0.144.1";
  }

  // Authentication and version compatibility are one fail-closed probe boundary.
  // eslint-disable-next-line complexity
  async probe(signal?: AbortSignal): Promise<RuntimeProbe> {
    const result = await probeCommandVersion(this.command, ["--version"], signal);
    const executablePath = result.installed ? await resolveCommandPath(this.command).catch(() => this.command) : this.command;
    const compatible = Boolean(result.version && isVersionAtLeast(result.version, this.minimumVersion));
    const auth = result.installed && compatible
      ? await runCommandCapture(this.command, ["login", "status"], signal).catch(() => undefined)
      : undefined;
    return {
      provider: this.provider,
      command: executablePath,
      installed: result.installed,
      compatible,
      version: result.version,
      minimumVersion: this.minimumVersion,
      authStatus: process.env.OPENAI_API_KEY || auth?.exitCode === 0
        ? "ready"
        : /expired/i.test(`${auth?.stdout ?? ""}\n${auth?.stderr ?? ""}`) ? "expired" : auth ? "required" : "unknown",
      policyCapabilities: { workspaceWrite: true, networkControl: true, readOnlyRoots: false },
      reason: result.reason
        ?? (!compatible ? `Codex ${this.minimumVersion} or newer is required.` : auth?.exitCode === 0 || process.env.OPENAI_API_KEY ? undefined : (auth?.stderr || auth?.stdout || "Codex authentication is required.").trim())
    };
  }

  async listModels(signal?: AbortSignal): Promise<RuntimeModel[]> {
    const child = this.spawnServer(process.cwd(), signal);
    const client = new CodexJsonRpcClient(child, () => undefined, async () => {
      throw new Error("Codex requested permission while listing models.");
    });
    try {
      await this.initialize(client);
      const models: RuntimeModel[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 20; page += 1) {
        const result = await client.request("model/list", { cursor, limit: 100 });
        models.push(...modelsFromCodexResult(result));
        cursor = nextCodexModelCursor(result);
        if (!cursor) break;
      }
      return models;
    } finally {
      client.close();
      setTimeout(() => child.kill("SIGKILL"), 250).unref();
    }
  }

  async *execute(request: RuntimeExecutionRequest): AsyncIterable<RuntimeEvent> {
    const queue = new AsyncEventQueue<RuntimeEvent>();
    void this.run(request, queue).catch((error) => queue.fail(error));
    yield* queue;
  }

  async cancel(executionId: string, reason = "Cancellation requested."): Promise<void> {
    const active = this.active.get(executionId);
    if (!active) return;
    setTimeout(() => active.client.forceKill(), 2_000).unref();
    if (active.threadId && active.turnId) {
      void active.client.request("turn/interrupt", { threadId: active.threadId, turnId: active.turnId }).catch(() => undefined);
    }
    void reason;
  }

  private async run(request: RuntimeExecutionRequest, queue: AsyncEventQueue<RuntimeEvent>): Promise<void> {
    const child = this.spawnServer(request.workingDirectory, request.signal);
    const state: CodexTurnState = { finalText: "" };
    let settleTurn: (() => void) | undefined;
    let failTurn: ((error: Error) => void) | undefined;
    const turnDone = new Promise<void>((resolve, reject) => {
      settleTurn = resolve;
      failTurn = reject;
    });
    void turnDone.catch(() => undefined);
    const client = new CodexJsonRpcClient(
      child,
      (message) => {
        for (const event of normalizeCodexNotification(message, state)) queue.push(event);
        if (message.method === "turn/completed" || message.method === "error") settleTurn?.();
      },
      (message) => this.handleServerRequest(message, request, queue),
      (error) => failTurn?.(error)
    );
    const active: ActiveCodexExecution = { client };
    this.active.set(request.executionId, active);
    const abort = () => {
      const reason = request.signal?.reason;
      failTurn?.(reason instanceof Error ? reason : new Error("Codex execution was cancelled."));
      void this.cancel(request.executionId, "Execution signal aborted.");
    };
    request.signal?.addEventListener("abort", abort, { once: true });
    const timeout = request.timeoutMs ? setTimeout(abort, request.timeoutMs) : undefined;
    timeout?.unref();

    try {
      queue.push({ type: "execution.started", executionId: request.executionId, provider: this.provider, at: new Date().toISOString() });
      await this.initialize(client);
      state.threadId = await this.openThread(client, request);
      active.threadId = state.threadId;
      const result = await client.request("turn/start", {
        threadId: state.threadId,
        input: [{ type: "text", text: request.prompt, text_elements: [] }],
        cwd: request.workingDirectory,
        model: providerSetting(request.model),
        effort: providerSetting(request.reasoning),
        approvalPolicy: "never",
        sandboxPolicy: codexSandboxPolicy(request),
        outputSchema: request.outputSchema
      });
      state.turnId = turnIdFromCodexResult(result);
      active.turnId = state.turnId;
      await turnDone;
      if (state.status && state.status !== "completed") throw new Error(state.error ?? `Codex turn ended with status ${state.status}.`);
      if (state.error) throw new Error(state.error);
      if (!state.finalText.trim()) throw new Error("Codex completed without a final response.");
      const structuredOutput = request.outputSchema ? parseStructuredOutput(state.finalText) : undefined;
      queue.push({ type: "execution.completed", output: state.finalText, structuredOutput });
      queue.close();
    } finally {
      if (timeout) clearTimeout(timeout);
      request.signal?.removeEventListener("abort", abort);
      this.active.delete(request.executionId);
      client.close();
      setTimeout(() => child.kill("SIGKILL"), 500).unref();
    }
  }

  private async initialize(client: CodexJsonRpcClient): Promise<void> {
    await client.request("initialize", { clientInfo: CLIENT_INFO, capabilities: { experimentalApi: true } });
    client.notify("initialized");
  }

  private async openThread(
    client: CodexJsonRpcClient,
    request: RuntimeExecutionRequest
  ): Promise<string> {
    const common = {
      cwd: request.workingDirectory,
      model: providerSetting(request.model),
      developerInstructions: request.systemInstructions,
      approvalPolicy: "never",
      sandbox: "workspace-write"
    };
    const started = await client.request("thread/start", common);
    const threadId = threadIdFromCodexResult(started);
    if (!threadId) throw new Error("Codex thread/start did not return a thread id.");
    return threadId;
  }

  private async handleServerRequest(
    message: CodexRpcMessage,
    request: RuntimeExecutionRequest,
    queue: AsyncEventQueue<RuntimeEvent>
  ): Promise<unknown> {
    const permission = codexPermission(message, request.workingDirectory);
    if (!permission) throw new Error(`Unsupported Codex server request: ${message.method ?? "unknown"}.`);
    if (message.method === "mcpServer/elicitation/request") {
      queue.push({ type: "permission.denied", request: permission.request });
      return { action: "cancel", content: {}, _meta: {} };
    }
    if (message.method === "item/permissions/requestApproval") {
      queue.push({ type: "permission.denied", request: permission.request });
      throw new Error("Ballet denied a Codex sandbox permission escalation.");
    }
    const policy = request.permissionPolicy ?? denyAllRuntimePermissions;
    const allowed = permission.pathOutsideWorkspace ? false : await policy.authorize(permission.request);
    if (!allowed) {
      queue.push({ type: "permission.denied", request: permission.request });
      return { decision: message.method?.startsWith("item/") ? "decline" : "denied" };
    }
    return { decision: message.method?.startsWith("item/") ? "accept" : "approved" };
  }

  private spawnServer(cwd: string, signal?: AbortSignal) {
    return spawn(this.command, ["app-server", "--listen", "stdio://"], {
      cwd,
      env: providerChildEnvironment(),
      stdio: ["pipe", "pipe", "pipe"],
      signal
    });
  }
}

const codexSandboxPolicy = (request: RuntimeExecutionRequest): Record<string, unknown> => ({
  type: "workspaceWrite",
  writableRoots: [path.resolve(request.workingDirectory)],
  readOnlyRoots: request.policy.readOnlyRoots.map((root) => path.resolve(root)),
  networkAccess: request.policy.network,
  excludeTmpdirEnvVar: true,
  excludeSlashTmp: true
});

const providerSetting = (value: string): string | undefined => value === "provider-default" ? undefined : value;

const parseStructuredOutput = (value: string): unknown => {
  const unwrapped = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(unwrapped) as unknown;
  } catch (error) {
    throw new Error(`Codex did not return valid structured output: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const codexPermission = (
  message: CodexRpcMessage,
  workspace: string
): { request: RuntimePermissionRequest; pathOutsideWorkspace: boolean } | undefined => {
  const method = message.method ?? "";
  const params = message.params ?? {};
  const candidatePath = typeof params.path === "string" ? params.path : typeof params.cwd === "string" ? params.cwd : undefined;
  const resolved = candidatePath ? path.resolve(workspace, candidatePath) : undefined;
  const pathOutsideWorkspace = Boolean(resolved && resolved !== path.resolve(workspace) && !resolved.startsWith(`${path.resolve(workspace)}${path.sep}`));
  if (method.includes("commandExecution") || method === "execCommandApproval") {
    return { request: { provider: "codex", kind: "command", operation: method, command: String(params.command ?? ""), path: resolved, raw: params }, pathOutsideWorkspace };
  }
  if (method.includes("fileChange") || method === "applyPatchApproval") {
    return { request: { provider: "codex", kind: "write", operation: method, path: resolved, raw: params }, pathOutsideWorkspace };
  }
  if (method.includes("permissions/requestApproval")) {
    return { request: { provider: "codex", kind: "unknown", operation: method, path: resolved, raw: params }, pathOutsideWorkspace };
  }
  if (method === "mcpServer/elicitation/request") {
    return { request: { provider: "codex", kind: "mcp", operation: method, raw: params }, pathOutsideWorkspace: false };
  }
  return undefined;
};
