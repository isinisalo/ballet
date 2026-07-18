import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { agentOutcomeSchema } from "../../shared/api/runtime-schemas.js";
import type { ExecutionSpec, ExecutionTask, RuntimeProvider } from "../../shared/domain/runtime.js";
import { LocalDatabase } from "../storage/LocalDatabase.js";
import { ExecutionStore } from "./ExecutionStore.js";
import { LocalExecutionQueue } from "./LocalExecutionQueue.js";
import type { LocalRuntimeService } from "./LocalRuntimeService.js";
import type {
  CliRuntimeAdapter,
  RuntimeEvent,
  RuntimeExecutionRequest,
  RuntimeModel,
  RuntimeProbe
} from "./providers/CliRuntimeAdapter.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("LocalExecutionQueue", () => {
  it("runs provider FIFO queues one-at-a-time while Codex and Copilot overlap", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("codex-root");
    fixture.insertRoot("copilot-root");
    fixture.store.create(specification("codex-a", "codex-root", "codex", "2026-01-01T00:00:00.000Z"));
    fixture.store.create(specification("codex-b", "codex-root", "codex", "2026-01-01T00:00:00.001Z"));
    fixture.store.create(specification("copilot-a", "copilot-root", "copilot", "2026-01-01T00:00:00.000Z"));
    fixture.codex.hold("codex-a");
    fixture.copilot.hold("copilot-a");

    fixture.queue.start();
    await waitFor(() => fixture.codex.started.includes("codex-a") && fixture.copilot.started.includes("copilot-a"));

    expect(fixture.codex.started).toEqual(["codex-a"]);
    expect(fixture.store.require("codex-b").status).toBe("queued");
    expect(fixture.store.require("codex-a").status).toBe("running");
    expect(fixture.store.require("copilot-a").status).toBe("running");

    fixture.copilot.release("copilot-a");
    await waitFor(() => fixture.store.require("copilot-a").status === "succeeded");
    fixture.codex.release("codex-a");
    await waitFor(() => fixture.store.require("codex-b").status === "succeeded");

    expect(fixture.codex.started).toEqual(["codex-a", "codex-b"]);
    expect(fixture.codex.maximumActive).toBe(1);
    expect(fixture.copilot.maximumActive).toBe(1);
    expect(fixture.terminal.map(({ id }) => id)).toEqual(expect.arrayContaining(["codex-a", "codex-b", "copilot-a"]));
    await fixture.close();
  });

  it("cancels queued work without invoking the adapter", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root");
    fixture.store.create(specification("running", "root"));
    fixture.store.create(specification("queued", "root", "codex", "2099-01-01T00:00:00.000Z"));
    fixture.codex.hold("running");
    fixture.queue.start();
    await waitFor(() => fixture.store.require("running").status === "running");

    const cancelled = await fixture.queue.cancel("queued");

    expect(cancelled.status).toBe("cancelled");
    expect(fixture.codex.started).toEqual(["running"]);
    expect(fixture.terminal).toContainEqual(expect.objectContaining({ id: "queued", status: "cancelled" }));
    fixture.codex.release("running");
    await waitFor(() => fixture.store.require("running").status === "succeeded");
    expect(fixture.codex.started).not.toContain("queued");
    await fixture.close();
  });

  it("aborts and persists cancellation for running work", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root");
    fixture.store.create(specification("running", "root"));
    fixture.codex.hold("running");
    fixture.queue.start();
    await waitFor(() => fixture.store.require("running").status === "running");

    await fixture.queue.cancel("running");
    await waitFor(() => fixture.store.require("running").status === "cancelled");

    expect(fixture.codex.cancelled).toContain("running");
    expect(fixture.store.require("running")).toMatchObject({
      status: "cancelled",
      cancelRequestedAt: expect.any(String)
    });
    expect(fixture.store.events("running").entries.at(-1)).toMatchObject({
      kind: "warn",
      terminal: true,
      message: "Execution cancelled."
    });
    await fixture.close();
  });

  it("fails interrupted running work at startup and resumes only queued work", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root");
    fixture.store.create(specification("interrupted", "root"));
    fixture.store.start("interrupted");
    fixture.store.create(specification("queued", "root", "codex", "2026-01-01T00:00:00.001Z"));

    fixture.queue.start();
    await waitFor(() => fixture.store.require("queued").status === "succeeded");

    expect(fixture.store.require("interrupted")).toMatchObject({ status: "failed", errorCode: "interrupted" });
    expect(fixture.codex.started).toEqual(["queued"]);
    expect(fixture.terminal).toContainEqual(expect.objectContaining({ id: "interrupted", status: "failed" }));
    await fixture.close();
  });

  it("rejects a provider completion without a valid structured outcome", async () => {
    const fixture = await createFixture({ validOutcome: false });
    fixture.insertRoot("root");
    fixture.store.create(specification("invalid", "root"));

    fixture.queue.start();
    await waitFor(() => fixture.store.require("invalid").status === "failed");

    expect(fixture.store.require("invalid")).toMatchObject({
      errorCode: "execution_failed",
      errorMessage: expect.stringMatching(/structured (agent )?outcome/i)
    });
    expect(fixture.store.events("invalid").entries.at(-1)).toMatchObject({ kind: "error", terminal: true });
    await fixture.close();
  });

  it("derives the provider output schema from the outcome validator", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root");
    fixture.store.create(specification("schema", "root"));

    await fixture.queue.start();
    await waitFor(() => fixture.store.require("schema").status === "succeeded");

    expect(fixture.codex.outputSchemas[0]).toEqual(z.toJSONSchema(agentOutcomeSchema));
    await fixture.close();
  });

  it("clears its shutdown timeout after workers stop", async () => {
    vi.useFakeTimers();
    try {
      const fixture = await createFixture();
      await fixture.queue.shutdown();
      expect(vi.getTimerCount()).toBe(0);
      await fixture.close();
    } finally {
      vi.useRealTimers();
    }
  });
});

class ControlledAdapter implements CliRuntimeAdapter {
  readonly minimumVersion = "0.0.0";
  readonly started: string[] = [];
  readonly cancelled: string[] = [];
  readonly outputSchemas: Array<Record<string, unknown> | undefined> = [];
  maximumActive = 0;
  private active = 0;
  private readonly gates = new Map<string, Deferred>();

  constructor(readonly provider: RuntimeProvider, private readonly validOutcome: boolean) {}

  hold(taskId: string): void {
    this.gates.set(taskId, deferred());
  }

  release(taskId: string): void {
    this.gates.get(taskId)?.resolve();
  }

  async probe(): Promise<RuntimeProbe> {
    return {
      provider: this.provider,
      command: `fake-${this.provider}`,
      installed: true,
      compatible: true,
      version: "1.2.3",
      minimumVersion: this.minimumVersion,
      authStatus: "ready",
      policyCapabilities: { workspaceWrite: true, networkControl: true, readOnlyRoots: true }
    };
  }

  async listModels(): Promise<RuntimeModel[]> {
    return [];
  }

  async *execute(request: RuntimeExecutionRequest): AsyncIterable<RuntimeEvent> {
    this.started.push(request.executionId);
    this.outputSchemas.push(request.outputSchema);
    this.active += 1;
    this.maximumActive = Math.max(this.maximumActive, this.active);
    try {
      yield { type: "execution.started", executionId: request.executionId, provider: this.provider, at: new Date().toISOString() };
      const gate = this.gates.get(request.executionId);
      if (gate) await abortable(gate.promise, request.signal);
      if (request.signal?.aborted) throw request.signal.reason;
      yield {
        type: "execution.completed",
        output: "done",
        structuredOutput: this.validOutcome
          ? approvedOutcome
          : { state: "completed", summary: "Missing required result.", checks: [] }
      };
    } finally {
      this.active -= 1;
    }
  }

  async cancel(executionId: string): Promise<void> {
    this.cancelled.push(executionId);
  }
}

const approvedOutcome = {
  state: "completed" as const,
  result: "approved" as const,
  summary: "Approved.",
  checks: []
};

const createFixture = async ({ validOutcome = true }: { validOutcome?: boolean } = {}) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-local-queue-"));
  temporaryRoots.push(root);
  const worktreesRoot = path.join(root, "worktrees");
  await mkdir(worktreesRoot);
  const database = new LocalDatabase(path.join(root, "state.sqlite"));
  const connection = () => database.connection();
  const store = new ExecutionStore(connection);
  const codex = new ControlledAdapter("codex", validOutcome);
  const copilot = new ControlledAdapter("copilot", validOutcome);
  const adapters = new Map<RuntimeProvider, CliRuntimeAdapter>([["codex", codex], ["copilot", copilot]]);
  const runtime = {
    verify: async () => undefined,
    adapter: (provider: RuntimeProvider) => adapters.get(provider)!
  } as unknown as LocalRuntimeService;
  const terminal: ExecutionTask[] = [];
  const queue = new LocalExecutionQueue({
    store,
    runtime,
    worktreesRoot,
    onTerminal: (task) => { terminal.push(task); }
  });
  const insertRoot = (rootRunId: string): void => {
    const worktreePath = path.join(worktreesRoot, rootRunId);
    connection().prepare(`
      INSERT INTO root_runs (
        root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
        config_hash, snapshot_hash, created_at, updated_at
      ) VALUES (?, 'agent', 'agent', 'manual', 'queued', ?, ?, ?, 'config', 'snapshot', ?, ?)
    `).run(rootRunId, worktreePath, `ballet/run/${rootRunId}`, "a".repeat(40),
      "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
  };
  return {
    store, queue, codex, copilot, terminal, insertRoot,
    close: async () => {
      await queue.shutdown(100);
      database.close();
    }
  };
};

const specification = (
  taskId: string,
  rootRunId: string,
  provider: RuntimeProvider = "codex",
  createdAt = "2026-01-01T00:00:00.000Z"
): ExecutionSpec => ({
  version: 1,
  taskId,
  kind: "agent_run",
  rootRunId,
  input: `Run ${taskId}`,
  agent: {
    id: "agent", name: "Agent", description: "Test agent", instructions: "Work carefully.",
    skillIds: [], configHash: "agent-config"
  },
  runtime: {
    hostname: "localhost", provider, cliVersion: "1.2.3", model: "provider-default",
    reasoning: "provider-default", policy: { network: false, readOnlyRoots: [] },
    capabilityHash: "capabilities"
  },
  project: {
    checkoutRoot: "/checkout", headSha: "a".repeat(40), configHash: "config", snapshotHash: "snapshot"
  },
  createdAt
});

interface Deferred {
  promise: Promise<void>;
  resolve(): void;
}

const deferred = (): Deferred => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

const abortable = (promise: Promise<void>, signal?: AbortSignal): Promise<void> => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<void>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
};

const waitFor = async (predicate: () => boolean, timeoutMs = 2_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for local execution queue state.");
};
