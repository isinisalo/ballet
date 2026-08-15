import { mkdir, mkdtemp, rm } from "node:fs/promises";
import type Database from "better-sqlite3";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";
import type { ExecutionTask, RuntimeProvider } from "../../shared/domain/runtime.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { ExecutionStore } from "./ExecutionStore.js";
import { LocalExecutionQueue } from "./LocalExecutionQueue.js";
import { insertRuntimeRoot } from "./LocalExecutionQueue.test-data.js";
import type { LocalRuntimeService } from "./LocalRuntimeService.js";
import type {
  CliRuntimeAdapter,
  RuntimeEvent,
  RuntimeExecutionRequest,
  RuntimeModel,
  RuntimeProbe
} from "./providers/CliRuntimeAdapter.js";

export { specification } from "./LocalExecutionQueue.test-data.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

class ControlledAdapter implements CliRuntimeAdapter {
  readonly minimumVersion = "0.0.0";
  readonly started: string[] = [];
  readonly cancelled: string[] = [];
  readonly exited: string[] = [];
  readonly outputSchemas: Array<Record<string, unknown> | undefined> = [];
  readonly prompts = new Map<string, string>();
  maximumActive = 0;
  private active = 0;
  private readonly gates = new Map<string, Deferred>();
  private readonly drainAfterCancellation = new Set<string>();

  constructor(readonly provider: RuntimeProvider, private readonly validOutcome: boolean) {}

  hold(taskId: string): void {
    this.gates.set(taskId, deferred());
  }

  holdThroughCancellation(taskId: string): void {
    this.hold(taskId);
    this.drainAfterCancellation.add(taskId);
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
    this.prompts.set(request.executionId, request.prompt);
    this.active += 1;
    this.maximumActive = Math.max(this.maximumActive, this.active);
    try {
      yield {
        type: "execution.started",
        executionId: request.executionId,
        provider: this.provider,
        at: new Date().toISOString()
      };
      const gate = this.gates.get(request.executionId);
      if (gate) {
        if (this.drainAfterCancellation.has(request.executionId)) await gate.promise;
        else await abortable(gate.promise, request.signal);
      }
      if (request.signal?.aborted) throw request.signal.reason;
      yield {
        type: "execution.completed",
        output: "done",
        structuredOutput: this.validOutcome
          ? approvedOutcome
          : { role: "work", status: "completed" }
      };
    } finally {
      this.active -= 1;
      this.exited.push(request.executionId);
    }
  }

  async cancel(executionId: string): Promise<void> {
    this.cancelled.push(executionId);
  }
}

const approvedOutcome = {
  role: "work" as const,
  status: "completed" as const,
  summary: "Completed."
};

interface QueueFixture {
  database: RuntimeDatabase;
  store: ExecutionStore;
  queue: LocalExecutionQueue;
  codex: ControlledAdapter;
  copilot: ControlledAdapter;
  terminal: ExecutionTask[];
  insertRoot(rootRunId: string, taskIds: string[]): void;
  connection(): Database.Database;
  close(): Promise<void>;
}

export const createFixture = async (
  {
    validOutcome = true,
    onStarted,
    onTerminal
  }: {
    validOutcome?: boolean;
    onStarted?(task: ExecutionTask): Promise<boolean | void> | boolean | void;
    onTerminal?(task: ExecutionTask): Promise<void> | void;
  } = {}
): Promise<QueueFixture> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-local-queue-"));
  temporaryRoots.push(root);
  const worktreesRoot = path.join(root, "worktrees");
  await mkdir(worktreesRoot);
  const database = new RuntimeDatabase(path.join(root, "state.sqlite"));
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
    onStarted,
    onTerminal: async (task) => {
      terminal.push(task);
      await onTerminal?.(task);
    }
  });
  const insertRoot = (rootRunId: string, taskIds: string[]): void => {
    const worktreePath = path.join(worktreesRoot, rootRunId);
    insertRuntimeRoot(connection(), worktreePath, rootRunId, taskIds);
  };
  return {
    database,
    store,
    queue,
    codex,
    copilot,
    terminal,
    insertRoot,
    connection,
    close: async () => {
      await queue.shutdown(100);
      database.close();
    }
  };
};

interface Deferred { promise: Promise<void>; resolve(): void }

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

export const waitFor = async (predicate: () => boolean, timeoutMs = 2_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for local execution queue state.");
};
