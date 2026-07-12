import os from "node:os";
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
import { probeCommandVersion, providerChildEnvironment, resolveCommandPath } from "../processProbe.js";
import { isVersionAtLeast } from "../semanticVersion.js";
import { parseStructuredJson } from "../structuredOutput.js";
import { copilotMessageText, normalizeCopilotEvent } from "./CopilotEventNormalizer.js";
import {
  loadCopilotSdk,
  type CopilotClientLike,
  type CopilotSdkLoader,
  type CopilotSessionLike
} from "./copilotSdkTypes.js";

interface ActiveCopilotExecution {
  client: CopilotClientLike;
  session?: CopilotSessionLike;
}

export interface CopilotSdkAdapterOptions {
  command?: string;
  minimumVersion?: string;
  loadSdk?: CopilotSdkLoader;
  copilotHome?: string;
}

export class CopilotSdkAdapter implements CliRuntimeAdapter {
  readonly provider = "copilot" as const;
  readonly minimumVersion: string;
  private readonly command: string;
  private readonly loadSdk: CopilotSdkLoader;
  private readonly copilotHome: string;
  private readonly active = new Map<string, ActiveCopilotExecution>();

  constructor(options: CopilotSdkAdapterOptions = {}) {
    this.command = options.command ?? "copilot";
    this.minimumVersion = options.minimumVersion ?? "1.0.70";
    this.loadSdk = options.loadSdk ?? loadCopilotSdk;
    this.copilotHome = options.copilotHome ?? process.env.COPILOT_HOME ?? path.join(os.homedir(), ".copilot");
  }

  async probe(signal?: AbortSignal): Promise<RuntimeProbe> {
    const result = await probeCommandVersion(this.command, ["--version"], signal);
    const executablePath = result.installed ? await resolveCommandPath(this.command).catch(() => this.command) : this.command;
    let compatible = Boolean(result.version && isVersionAtLeast(result.version, this.minimumVersion));
    let authStatus: RuntimeProbe["authStatus"] = "unknown";
    let authReason: string | undefined;
    if (result.installed && compatible) {
      let client: CopilotClientLike | undefined;
      try {
        client = await this.createClient(process.cwd());
        await client.start();
        const auth = await client.getAuthStatus();
        authStatus = auth.isAuthenticated ? "ready" : /expired/i.test(auth.statusMessage ?? "") ? "expired" : "required";
        authReason = auth.statusMessage;
        if (auth.isAuthenticated) {
          const probeRequest = sandboxProbeRequest();
          const session = await client.createSession(this.sessionConfig(probeRequest, new AsyncEventQueue<RuntimeEvent>()));
          try {
            await enforceCopilotSandbox(session, probeRequest);
          } finally {
            await session.disconnect().catch(() => undefined);
          }
        }
      } catch (error) {
        compatible = false;
        authReason = `Copilot SDK/CLI compatibility probe failed: ${error instanceof Error ? error.message : String(error)}`;
      } finally {
        await client?.stop().catch(() => []);
      }
    }
    return {
      provider: this.provider,
      command: executablePath,
      installed: result.installed,
      compatible,
      version: result.version,
      minimumVersion: this.minimumVersion,
      authStatus,
      policyCapabilities: { workspaceWrite: true, networkControl: true, readOnlyRoots: true },
      reason: result.reason ?? (compatible ? authReason : authReason ?? `Copilot CLI ${this.minimumVersion} or newer is required.`)
    };
  }

  async listModels(signal?: AbortSignal): Promise<RuntimeModel[]> {
    const client = await this.createClient(process.cwd());
    const abort = () => { void client.forceStop().catch(() => undefined); };
    signal?.addEventListener("abort", abort, { once: true });
    try {
      if (signal?.aborted) throw signal.reason;
      await client.start();
      const models = await client.listModels();
      return models.flatMap((entry) => modelFromSdk(entry));
    } finally {
      signal?.removeEventListener("abort", abort);
      await client.stop().catch(() => []);
    }
  }

  async *execute(request: RuntimeExecutionRequest): AsyncIterable<RuntimeEvent> {
    const queue = new AsyncEventQueue<RuntimeEvent>();
    void this.run(request, queue).catch((error) => queue.fail(error));
    yield* queue;
  }

  async cancel(executionId: string): Promise<void> {
    const active = this.active.get(executionId);
    if (!active) return;
    await active.session?.abort().catch(() => undefined);
    setTimeout(() => { void active.client.forceStop().catch(() => undefined); }, 2_000).unref();
  }

  private async run(request: RuntimeExecutionRequest, queue: AsyncEventQueue<RuntimeEvent>): Promise<void> {
    const client = await this.createClient(request.workingDirectory);
    let session: CopilotSessionLike | undefined;
    let unsubscribe: (() => void) | undefined;
    this.active.set(request.executionId, { client });
    const abort = () => { void this.cancel(request.executionId); };
    request.signal?.addEventListener("abort", abort, { once: true });
    try {
      await client.start();
      if (request.signal?.aborted) throw request.signal.reason;
      const config = this.sessionConfig(request, queue);
      session = await client.createSession(config);
      await enforceCopilotSandbox(session, request);
      this.active.set(request.executionId, { client, session });
      unsubscribe = session.on((event) => {
        for (const normalized of normalizeCopilotEvent(event)) queue.push(normalized);
      });
      queue.push({ type: "execution.started", executionId: request.executionId, provider: this.provider, at: new Date().toISOString() });
      const first = await session.sendAndWait({ prompt: withSchemaInstruction(request.prompt, request.outputSchema) }, request.timeoutMs);
      let output = copilotMessageText(first);
      let structured = request.outputSchema ? parseStructuredJson(output, request.outputSchema) : { value: undefined };
      if (request.outputSchema && structured.error) {
        queue.push({ type: "diagnostic", level: "warning", message: "Copilot output failed schema validation; requesting one repair.", data: structured.error });
        const repair = await session.sendAndWait({ prompt: repairPrompt(structured.error, request.outputSchema) }, request.timeoutMs);
        output = copilotMessageText(repair);
        structured = parseStructuredJson(output, request.outputSchema);
      }
      if (request.outputSchema && structured.error) throw new Error(`Copilot output repair failed: ${structured.error}`);
      if (!output.trim()) throw new Error("Copilot completed without a final response.");
      queue.push({ type: "execution.completed", output, structuredOutput: structured.value });
      queue.close();
    } finally {
      request.signal?.removeEventListener("abort", abort);
      unsubscribe?.();
      this.active.delete(request.executionId);
      await session?.disconnect().catch(() => undefined);
      const errors = await client.stop().catch((error) => [error instanceof Error ? error : new Error(String(error))]);
      if (errors.length > 0) await client.forceStop().catch(() => undefined);
    }
  }

  private async createClient(workingDirectory: string): Promise<CopilotClientLike> {
    const sdk = await this.loadSdk();
    const commandPath = await resolveCommandPath(this.command);
    return new sdk.CopilotClient({
      connection: sdk.RuntimeConnection.forStdio({ path: commandPath }),
      mode: "empty",
      workingDirectory,
      baseDirectory: this.copilotHome,
      useLoggedInUser: true,
      logLevel: "error",
      env: providerChildEnvironment()
    });
  }

  private sessionConfig(request: RuntimeExecutionRequest, queue: AsyncEventQueue<RuntimeEvent>): Record<string, unknown> {
    return {
      clientName: "ballet",
      model: request.model === "provider-default" ? undefined : request.model,
      reasoningEffort: request.reasoning === "provider-default" ? undefined : request.reasoning,
      // Copilot 1.0.6 exposes assistant.reasoning as extended thinking, not a
      // provider-authored summary. Suppress it at the source and never persist it.
      reasoningSummary: "none",
      workingDirectory: request.workingDirectory,
      streaming: true,
      // SDK 1.0.6 requires source-qualified tool filters in empty mode. All
      // built-ins remain behind the pre-tool and permission policy hooks.
      availableTools: ["builtin:*"],
      excludedTools: ["builtin:ask_user"],
      enableConfigDiscovery: false,
      enableFileHooks: false,
      enableOnDemandInstructionDiscovery: false,
      enableSessionStore: false,
      skipEmbeddingRetrieval: true,
      embeddingCacheStorage: "in-memory",
      remoteSession: "off",
      requestCanvasRenderer: false,
      requestExtensions: false,
      systemMessage: request.systemInstructions ? { mode: "append", content: request.systemInstructions } : undefined,
      onPermissionRequest: async (raw: Record<string, unknown>) => {
        const permission = permissionFromCopilot(raw, request.workingDirectory);
        const policy = request.permissionPolicy ?? denyAllRuntimePermissions;
        const allowed = !permission.pathOutsideWorkspace && await policy.authorize(permission.request);
        if (allowed) return { kind: "approve-once" };
        queue.push({ type: "permission.denied", request: permission.request });
        return { kind: "reject", feedback: "Ballet runtime policy denied this operation." };
      },
      hooks: {
        onPreToolUse: async () => ({ permissionDecision: "ask" })
      }
    };
  }
}

const modelFromSdk = (entry: unknown): RuntimeModel[] => {
  if (!entry || typeof entry !== "object") return [];
  const model = entry as Record<string, unknown>;
  const id = typeof model.id === "string" ? model.id : typeof model.model === "string" ? model.model : "";
  if (!id) return [];
  const capabilities = model.capabilities && typeof model.capabilities === "object"
    ? model.capabilities as Record<string, unknown>
    : {};
  const supports = capabilities.supports && typeof capabilities.supports === "object"
    ? capabilities.supports as Record<string, unknown>
    : {};
  const reasoningOptions = Array.isArray(model.supportedReasoningEfforts)
    ? model.supportedReasoningEfforts.filter((effort): effort is string => typeof effort === "string")
    : [];
  return [{
    id,
    name: typeof model.name === "string" ? model.name : id,
    reasoningOptions,
    defaultReasoning: typeof model.defaultReasoningEffort === "string" ? model.defaultReasoningEffort : undefined,
    capabilities: { reasoning: supports.reasoningEffort === true, vision: supports.vision === true }
  }];
};

const sandboxProbeRequest = (): RuntimeExecutionRequest => ({
  executionId: "ballet-capability-probe",
  prompt: "",
  workingDirectory: process.cwd(),
  model: "provider-default",
  reasoning: "provider-default",
  policy: { network: false, readOnlyRoots: [] },
  permissionPolicy: denyAllRuntimePermissions
});

const enforceCopilotSandbox = async (
  session: CopilotSessionLike,
  request: Pick<RuntimeExecutionRequest, "workingDirectory" | "policy">
): Promise<void> => {
  const workingDirectory = path.resolve(request.workingDirectory);
  await session.rpc.options.update({
    enableScriptSafety: true,
    shellInitProfile: "None",
    sandboxConfig: {
      enabled: true,
      addCurrentWorkingDirectory: false,
      userPolicy: {
        filesystem: {
          readwritePaths: [workingDirectory],
          readonlyPaths: request.policy.readOnlyRoots.map((root) => path.resolve(root)),
          clearPolicyOnExit: true
        },
        network: {
          allowOutbound: request.policy.network,
          allowLocalNetwork: request.policy.network
        },
        seatbelt: { keychainAccess: false }
      }
    }
  });
};

const withSchemaInstruction = (prompt: string, schema?: Record<string, unknown>): string => schema
  ? `${prompt}\n\nReturn only one JSON value matching this schema exactly:\n${JSON.stringify(schema)}`
  : prompt;

const repairPrompt = (error: string, schema: Record<string, unknown>): string =>
  `Your previous response was invalid (${error}). Return only corrected JSON matching this schema. Do not add prose or a code fence:\n${JSON.stringify(schema)}`;

const permissionFromCopilot = (
  raw: Record<string, unknown>,
  workspace: string
): { request: RuntimePermissionRequest; pathOutsideWorkspace: boolean } => {
  const kind = typeof raw.kind === "string" ? raw.kind : "unknown";
  const rawPath = typeof raw.fileName === "string" ? raw.fileName : kind === "shell" ? workspace : undefined;
  const resolvedPath = rawPath ? path.resolve(workspace, rawPath) : undefined;
  const root = path.resolve(workspace);
  const pathOutsideWorkspace = kind !== "read" && Boolean(resolvedPath && resolvedPath !== root && !resolvedPath.startsWith(`${root}${path.sep}`));
  const mappedKind = kind === "shell" ? "command" : kind === "write" ? "write" : kind === "read" ? "read" : kind === "url" ? "network" : kind === "mcp" ? "mcp" : "unknown";
  return {
    request: {
      provider: "copilot",
      kind: mappedKind,
      operation: kind,
      path: resolvedPath,
      command: typeof raw.fullCommandText === "string" ? raw.fullCommandText : undefined,
      url: typeof raw.url === "string" ? raw.url : undefined,
      raw
    },
    pathOutsideWorkspace
  };
};
