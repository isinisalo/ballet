import type Database from "better-sqlite3";
import type {
  ExecutionRuntimeSnapshot,
  LoopRunDetails,
  LoopRunSource,
  StepOutcome,
  StepRunResult
} from "../../shared/domain/runtime.js";
import { WorkLoopRuntimeUnavailableError } from "./LoopRunErrors.js";
import type { LoopRunStore } from "./LoopRunStore.js";
import type { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import type { CompleteStepRunInput } from "./RuntimeDbTypes.js";

interface StartOptions {
  source?: LoopRunSource;
  input?: string;
  schedule?: { stepId: string; scheduledFor: string };
}

export type CompleteExecutionStepInput = CompleteStepRunInput & {
  executionTaskId?: string;
  outcome?: StepOutcome;
  execution?: ExecutionRuntimeSnapshot;
};

/**
 * Deliberately closed boundary while the strict-v10 orchestrator is implemented.
 * Keeping the database facade stable lets historical reads remain available
 * without routing new configurations through the removed v9 transition engine.
 */
export class LoopRunEngine {
  constructor(
    _connection: () => Database.Database,
    _store: LoopRunStore,
    _snapshots: RootExecutionSnapshotStore
  ) {
    void _connection;
    void _store;
    void _snapshots;
  }

  start(_rootRunId: string, _options: StartOptions = {}): LoopRunDetails {
    void _rootRunId;
    void _options;
    throw new WorkLoopRuntimeUnavailableError();
  }

  respond(_runId: string, _stepRunId: string, _result: StepRunResult, _input: string): LoopRunDetails {
    void _runId;
    void _stepRunId;
    void _result;
    void _input;
    throw new WorkLoopRuntimeUnavailableError();
  }

  completeExecutionStep(_input: CompleteExecutionStepInput): LoopRunDetails {
    void _input;
    throw new WorkLoopRuntimeUnavailableError();
  }

  resumeExecutionStep(_runId: string, _stepRunId: string, _input: string): LoopRunDetails {
    void _runId;
    void _stepRunId;
    void _input;
    throw new WorkLoopRuntimeUnavailableError();
  }

  cancel(_runId: string): LoopRunDetails {
    void _runId;
    throw new WorkLoopRuntimeUnavailableError();
  }
}
