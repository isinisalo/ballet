import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import type { PreparedRootWorkspace } from "../execution/git/LocalWorkspaceManager.js";
import { WorkLoopRuntimeUnavailableError } from "../runtime/LoopRunErrors.js";

export class LoopExecutionPlanner {
  constructor(
    _configurations: RuntimeConfigurationService,
    _runtime: LocalRuntimeService
  ) {
    void _configurations;
    void _runtime;
  }

  async create(
    _workspace: PreparedRootWorkspace,
    _rootLoopId: string,
    _runInput = ""
  ): Promise<RootExecutionSnapshot> {
    void _workspace;
    void _rootLoopId;
    void _runInput;
    throw new WorkLoopRuntimeUnavailableError();
  }
}
