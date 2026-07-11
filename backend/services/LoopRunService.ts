import type { AppData } from "../../shared/api/workspaceData.js";
import type { LoopRunSource, StepRunResult } from "../../shared/domain/runtime.js";
import { LoopRunNotFoundError, LoopRunStateError } from "../runtime/LoopRunErrors.js";
import { notifyRuntimeChanged } from "../runtime-events.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";

export class LoopRunService {
  constructor(
    private readonly readData: () => Promise<AppData>,
    private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider
  ) {}

  async start(loopId: string, input?: string, source: LoopRunSource = "manual") {
    const data = await this.readData();
    if (data.automationIssues.length > 0) {
      throw new LoopRunStateError("Cannot start a loop while project.json is invalid.");
    }
    const run = this.database().startLoopRun(data.automation, loopId, input, source);
    notifyRuntimeChanged("loop-runs");
    return run;
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
    notifyRuntimeChanged("loop-runs");
    return run;
  }

  cancel(runId: string) {
    const run = this.database().cancelLoopRun(runId);
    notifyRuntimeChanged("loop-runs");
    return run;
  }

  list() {
    return this.database().listLoopRuns();
  }

  database(): RuntimeDatabase {
    return this.runtimeDatabaseProvider.runtimeDatabase();
  }
}
