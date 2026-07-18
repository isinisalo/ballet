import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentOutcome, ExecutionSpec, ExecutionTask, RuntimeProvider } from "../../shared/domain/runtime.js";
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
const readyOutcome: AgentOutcome = { outcome: "ready", summary: "Ready.", checks: [] };

export const cleanupQueueFixtures = async (): Promise<void> => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
};

export const createFixture = async ({
  validOutcome = true,
  providerFailure,
  structuredOutcome = readyOutcome
}: {
  validOutcome?: boolean;
  providerFailure?: { message: string; retryable: boolean };
  structuredOutcome?: AgentOutcome;
} = {}) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-local-queue-"));
  temporaryRoots.push(root);
  const worktreesRoot = path.join(root, "worktrees");
  await mkdir(worktreesRoot);
  const database = new LocalDatabase(path.join(root, "state.sqlite"));
  const connection = () => database.connection();
  const store = new ExecutionStore(connection);
  const codex = new ControlledAdapter("codex", validOutcome, providerFailure, structuredOutcome);
  const copilot = new ControlledAdapter("copilot", validOutcome, providerFailure, structuredOutcome);
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

export const specification = (
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

export const waitFor = async (predicate: () => boolean, timeoutMs = 2_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for local execution queue state.");
};

class ControlledAdapter implements CliRuntimeAdapter {
  readonly minimumVersion = "0.0.0";
  readonly started: string[] = [];
  readonly cancelled: string[] = [];
  readonly outputSchemas: Array<Record<string, unknown> | undefined> = [];
  maximumActive = 0;
  private active = 0;
  private readonly gates = new Map<string, Deferred>();

  constructor(
    readonly provider: RuntimeProvider,
    private readonly validOutcome: boolean,
    private readonly failure?: { message: string; retryable: boolean },
    private readonly structuredOutcome: AgentOutcome = readyOutcome
  ) {}

  hold(taskId: string): void { this.gates.set(taskId, deferred()); }
  release(taskId: string): void { this.gates.get(taskId)?.resolve(); }

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

  async listModels(): Promise<RuntimeModel[]> { return []; }

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
      if (this.failure) {
        yield { type: "execution.failed", ...this.failure };
        return;
      }
      yield {
        type: "execution.completed",
        output: "done",
        structuredOutput: this.validOutcome ? this.structuredOutcome : { summary: "missing outcome and checks" }
      };
    } finally {
      this.active -= 1;
    }
  }

  async cancel(executionId: string): Promise<void> { this.cancelled.push(executionId); }
}

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
