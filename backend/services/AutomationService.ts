import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import { loadMarkdownAppData } from "../markdown-adapter.js";
import {
  AutomationConflictError,
  AutomationValidationError,
  loadProjectAutomationConfigWithIssues,
  saveProjectAutomationConfig
} from "../automation.js";
import { LoopRunConflictError } from "../runtime/LoopRunErrors.js";
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
    return saveProjectAutomationConfig(this.root(), config, data.agents);
  }

  async assertAgentRemovable(agentId: string): Promise<void> {
    const data = await loadMarkdownAppData(this.root());
    const automation = await loadProjectAutomationConfigWithIssues(this.root(), data.agents);
    if (automation.issues.length > 0) {
      throw new AutomationValidationError("Automation config is invalid.", automation.issues);
    }
    const references = automation.config.loops.flatMap((loop) => loop.nodes
      .filter((node) => (node.type === "agent" || node.type === "scheduled") && node.agentId === agentId)
      .map((node) => `${loop.id}:${node.id}`));
    if (references.length > 0) {
      throw new AutomationConflictError(
        `Agent ${agentId} is referenced by automation steps: ${references.join(", ")}.`
      );
    }
  }
}
