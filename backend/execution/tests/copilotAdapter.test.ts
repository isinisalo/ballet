import { describe, expect, it } from "vitest";
import { CopilotClient } from "@github/copilot-sdk";
import { CopilotSdkAdapter } from "../providers/copilot/CopilotSdkAdapter.js";
import { normalizeCopilotEvent } from "../providers/copilot/CopilotEventNormalizer.js";
import type {
  CopilotClientLike,
  CopilotSdkModule,
  CopilotSessionEvent,
  CopilotSessionLike
} from "../providers/copilot/copilotSdkTypes.js";

class FakeSession implements CopilotSessionLike {
  readonly sessionId = "copilot-session-1";
  readonly prompts: string[] = [];
  readonly optionUpdates: Record<string, unknown>[] = [];
  readonly rpc = { options: { update: async (options: Record<string, unknown>) => { this.optionUpdates.push(options); } } };
  aborted = false;
  private handler?: (event: CopilotSessionEvent) => void;

  on(handler: (event: CopilotSessionEvent) => void): () => void {
    this.handler = handler;
    return () => { this.handler = undefined; };
  }

  async sendAndWait(options: { prompt: string }): Promise<unknown> {
    this.prompts.push(options.prompt);
    this.handler?.({ type: "assistant.message_delta", data: { deltaContent: "stream" } });
    const content = this.prompts.length === 1
      ? "not-json"
      : JSON.stringify({ outcome: "ready", summary: "Done.", checks: [] });
    return { type: "assistant.message", data: { content } };
  }

  async abort(): Promise<void> { this.aborted = true; }
  async disconnect(): Promise<void> {}
}

class FakeClient implements CopilotClientLike {
  readonly session = new FakeSession();
  config?: Record<string, unknown>;
  async start(): Promise<void> {}
  async stop(): Promise<Error[]> { return []; }
  async forceStop(): Promise<void> {}
  async getAuthStatus() { return { isAuthenticated: true }; }
  async listModels(): Promise<unknown[]> { return []; }
  async createSession(config: Record<string, unknown>): Promise<CopilotSessionLike> {
    this.config = config;
    return this.session;
  }
  async resumeSession(_sessionId: string, config: Record<string, unknown>): Promise<CopilotSessionLike> {
    this.config = config;
    return this.session;
  }
}

describe("CopilotSdkAdapter", () => {
  it("drops Copilot extended-thinking events instead of persisting them as summaries", () => {
    expect(normalizeCopilotEvent({ type: "assistant.reasoning", data: { content: "private reasoning" } })).toEqual([]);
    expect(normalizeCopilotEvent({ type: "assistant.reasoning_delta", data: { deltaContent: "private delta" } })).toEqual([]);
  });

  it("normalizes Copilot partial, progress, and terminal tool output", () => {
    expect(normalizeCopilotEvent({
      type: "tool.execution_partial_result",
      data: { toolCallId: "tool-1", partialOutput: "partial output" }
    })).toContainEqual({ type: "tool.output", toolCallId: "tool-1", text: "partial output" });
    expect(normalizeCopilotEvent({
      type: "tool.execution_progress",
      data: { toolCallId: "tool-1", progressMessage: "still running" }
    })).toContainEqual({ type: "tool.output", toolCallId: "tool-1", text: "still running" });
    expect(normalizeCopilotEvent({
      type: "tool.execution_complete",
      data: { toolCallId: "tool-1", success: true, result: { content: "final output" } }
    })).toContainEqual({ type: "tool.output", toolCallId: "tool-1", text: "final output" });
  });

  it("streams SDK events and performs exactly one structured-output repair", async () => {
    const client = new FakeClient();
    const sdk: CopilotSdkModule = {
      CopilotClient: class { constructor() { return client; } } as unknown as CopilotSdkModule["CopilotClient"],
      RuntimeConnection: { forStdio: (options) => ({ kind: "stdio", ...options }) }
    };
    const adapter = new CopilotSdkAdapter({ command: "copilot", loadSdk: async () => sdk });
    const events = [];
    for await (const event of adapter.execute({
      executionId: "task-1",
      prompt: "Do the work.",
      workingDirectory: "/tmp/worktree",
      model: "provider-default",
      reasoning: "provider-default",
      policy: { network: false, readOnlyRoots: [] },
      outputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["outcome", "summary", "checks"],
        properties: {
          outcome: { type: "string", enum: ["ready"] },
          summary: { type: "string" },
          checks: { type: "array" }
        }
      }
    })) events.push(event);

    expect(client.session.prompts).toHaveLength(2);
    expect(client.session.prompts[1]).toContain("previous response was invalid");
    expect(events).toContainEqual(expect.objectContaining({ type: "assistant.delta", text: "stream" }));
    expect(events).toContainEqual(expect.objectContaining({
      type: "execution.completed",
      structuredOutput: { outcome: "ready", summary: "Done.", checks: [] }
    }));
    expect(client.session.optionUpdates).toContainEqual(expect.objectContaining({
      sandboxConfig: expect.objectContaining({ enabled: true, addCurrentWorkingDirectory: false })
    }));
  });

  it("denies an outside-worktree permission by default instead of enabling allow-all", async () => {
    const client = new FakeClient();
    const sdk: CopilotSdkModule = {
      CopilotClient: class { constructor() { return client; } } as unknown as CopilotSdkModule["CopilotClient"],
      RuntimeConnection: { forStdio: () => ({ kind: "stdio" }) }
    };
    const adapter = new CopilotSdkAdapter({ loadSdk: async () => sdk });
    for await (const event of adapter.execute({
      executionId: "task-policy",
      prompt: "Return JSON.",
      workingDirectory: "/tmp/worktree",
      model: "provider-default",
      reasoning: "provider-default",
      policy: { network: false, readOnlyRoots: [] },
      outputSchema: { type: "object" }
    })) { void event; }

    const permission = client.config?.onPermissionRequest as (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
    await expect(permission({ kind: "write", fileName: "../outside.txt" })).resolves.toMatchObject({ kind: "reject" });
    expect(client.config).not.toHaveProperty("allowAll");
    expect(client.config).toMatchObject({
      enableConfigDiscovery: false,
      enableFileHooks: false,
      enableSessionStore: false,
      remoteSession: "off",
      reasoningSummary: "none",
      availableTools: ["builtin:*"],
      excludedTools: ["builtin:ask_user"]
    });
    expect(client.session.optionUpdates.at(-1)).toMatchObject({
      sandboxConfig: {
        enabled: true,
        addCurrentWorkingDirectory: false,
        userPolicy: {
          filesystem: { readwritePaths: ["/tmp/worktree"], readonlyPaths: [], clearPolicyOnExit: true },
          network: { allowOutbound: false, allowLocalNetwork: false },
          seatbelt: { keychainAccess: false }
        }
      }
    });
    const sdkValidator = new CopilotClient({ mode: "empty", baseDirectory: "/tmp/copilot-sdk-filter-test" }) as unknown as {
      resolveToolFilterOptions(config: Record<string, unknown>): unknown;
    };
    expect(() => sdkValidator.resolveToolFilterOptions(client.config!)).not.toThrow();
  });

  it("marks an SDK/CLI handshake failure as an unsupported version", async () => {
    class IncompatibleClient extends FakeClient {
      override async start(): Promise<void> { throw new Error("protocol mismatch"); }
    }
    const client = new IncompatibleClient();
    const sdk: CopilotSdkModule = {
      CopilotClient: class { constructor() { return client; } } as unknown as CopilotSdkModule["CopilotClient"],
      RuntimeConnection: { forStdio: () => ({ kind: "stdio" }) }
    };
    const adapter = new CopilotSdkAdapter({ command: process.execPath, loadSdk: async () => sdk });

    await expect(adapter.probe()).resolves.toMatchObject({
      installed: true,
      compatible: false,
      authStatus: "unknown",
      reason: expect.stringContaining("protocol mismatch")
    });
  });
});
