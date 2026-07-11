import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import { loadMarkdownAppData } from "../markdown-adapter.js";
import { loadProjectAutomationConfigWithIssues, saveProjectAutomationConfig } from "../automation.js";
import { LoopRunConflictError } from "../runtime/LoopRunErrors.js";
import { notifyRuntimeChanged } from "../runtime-events.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";

export class AutomationService {
  constructor(
    private readonly root: () => string,
    private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider
  ) {}

  async save(config: ProjectAutomationConfig): Promise<ProjectAutomationConfig> {
    const data = await loadMarkdownAppData(this.root());
    const current = await loadProjectAutomationConfigWithIssues(this.root(), data.agents);
    const activeLoopIds = this.runtimeDatabaseProvider.runtimeDatabase().activeLoopIds();
    for (const loopId of activeLoopIds) {
      const before = current.config.loops.find((loop) => loop.id === loopId);
      const after = config.loops.find((loop) => loop.id === loopId);
      if (!before || !after || JSON.stringify(before) !== JSON.stringify(after)) {
        throw new LoopRunConflictError(`Loop ${loopId} cannot be edited while it has an active run.`);
      }
    }
    const saved = await saveProjectAutomationConfig(this.root(), config, data.agents);
    notifyRuntimeChanged("automation");
    return saved;
  }
}
