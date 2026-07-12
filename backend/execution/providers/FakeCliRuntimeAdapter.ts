import type {
  CliRuntimeAdapter,
  RuntimeEvent,
  RuntimeExecutionRequest,
  RuntimeModel,
  RuntimeProbe,
  RuntimeProvider
} from "./CliRuntimeAdapter.js";

export class FakeCliRuntimeAdapter implements CliRuntimeAdapter {
  readonly cancelled = new Map<string, string | undefined>();
  readonly executions: RuntimeExecutionRequest[] = [];

  constructor(
    readonly provider: RuntimeProvider = "codex",
    readonly minimumVersion = "0.0.0",
    private readonly events: readonly RuntimeEvent[] = [],
    private readonly models: readonly RuntimeModel[] = []
  ) {}

  async probe(): Promise<RuntimeProbe> {
    return {
      provider: this.provider,
      command: `fake-${this.provider}`,
      installed: true,
      compatible: true,
      version: "999.0.0",
      minimumVersion: this.minimumVersion,
      authStatus: "ready",
      policyCapabilities: { workspaceWrite: true, networkControl: true, readOnlyRoots: true }
    };
  }

  async listModels(): Promise<RuntimeModel[]> {
    return [...this.models];
  }

  async *execute(request: RuntimeExecutionRequest): AsyncIterable<RuntimeEvent> {
    this.executions.push(request);
    for (const event of this.events) {
      if (request.signal?.aborted) throw request.signal.reason;
      yield event;
    }
  }

  async cancel(executionId: string, reason?: string): Promise<void> {
    this.cancelled.set(executionId, reason);
  }
}
