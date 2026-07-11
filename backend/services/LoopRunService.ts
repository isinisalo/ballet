import type { AppData } from "../../shared/api/workspaceData.js";
import type { LoopRunSource, StepRunResult } from "../../shared/domain/runtime.js";
import { LoopRunNotFoundError, LoopRunStateError } from "../runtime/LoopRunErrors.js";
import { notifyRuntimeChanged } from "../runtime-events.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";
import { loopContainsAgentWork, type LoopExecutionGateway } from "./LoopExecutionGateway.js";

export class LoopRunService {
  private executionGateway?: LoopExecutionGateway;

  constructor(
    private readonly readData: () => Promise<AppData>,
    private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider
  ) {}

  setExecutionGateway(gateway: LoopExecutionGateway): void {
    this.executionGateway = gateway;
  }

  async start(loopId: string, input?: string, source: LoopRunSource = "manual") {
    const data = await this.readData();
    if (data.automationIssues.length > 0) {
      throw new LoopRunStateError("Cannot start a loop while project.json is invalid.");
    }
    if (!this.executionGateway && loopContainsAgentWork(data, loopId)) {
      throw new LoopRunStateError("Cannot start an agent loop before the runtime control plane is configured.");
    }
    const plan = await this.executionGateway?.prepare(data, loopId);
    const run = this.database().startLoopRun(data.automation, loopId, input, source, plan?.deviceId, plan);
    if (this.executionGateway) await this.executionGateway.enqueuePending(data, run.rootRunId);
    notifyRuntimeChanged("loop-runs");
    return this.database().getLoopRun(run.runId) ?? run;
  }

  async latest(loopId: string) {
    const data = await this.readData();
    if (!data.automation.loops.some((loop) => loop.id === loopId)) {
      throw new LoopRunNotFoundError(`Loop ${loopId} was not found.`);
    }
    return this.database().latestLoopRun(loopId) ?? null;
  }

  async respond(runId: string, stepRunId: string, result: StepRunResult, input: string) {
    const data = await this.readData();
    const run = this.database().respondToStepRun(data.automation, runId, stepRunId, result, input);
    if (this.executionGateway) await this.executionGateway.enqueuePending(data, run.rootRunId);
    await this.executionGateway?.finalizeIfTerminal(run.rootRunId);
    notifyRuntimeChanged("loop-runs");
    return run;
  }

  async cancel(runId: string) {
    const run = this.database().cancelLoopRun(runId);
    await this.executionGateway?.cancel(run.rootRunId);
    await this.executionGateway?.finalizeIfTerminal(run.rootRunId);
    notifyRuntimeChanged("loop-runs");
    return run;
  }

  list() {
    return this.database().listLoopRuns();
  }

  listActive() {
    return this.database().listActiveLoopRuns();
  }

  database(): RuntimeDatabase {
    return this.runtimeDatabaseProvider.runtimeDatabase();
  }
}
