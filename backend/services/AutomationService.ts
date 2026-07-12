import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import {
  introducedLoopThemeReferenceIssues,
  validateAutomationThemeReferences
} from "../../shared/domain/loopThemes.js";
import type { LoopThemeRepository } from "../loop-themes/LoopThemeRepository.js";
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
    private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider,
    private readonly loopThemeRepository: LoopThemeRepository
  ) {}

  async save(config: ProjectAutomationConfig): Promise<ProjectAutomationConfig> {
    const data = await loadMarkdownAppData(this.root());
    const themes = await this.loopThemeRepository.load(this.root());
    const current = await loadProjectAutomationConfigWithIssues(this.root(), data.agents);
    const currentReferenceIssues = validateAutomationThemeReferences(current.config, themes.themes);
    const candidateReferenceIssues = validateAutomationThemeReferences(config, themes.themes);
    const introducedReferenceIssues = introducedLoopThemeReferenceIssues(
      currentReferenceIssues,
      candidateReferenceIssues
    );
    if (introducedReferenceIssues.length > 0) {
      throw new AutomationValidationError(
        "Automation config references an unknown loop theme.",
        introducedReferenceIssues
      );
    }
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
    const references = automation.config.loops.flatMap((loop) => loop.steps
      .filter((step) => step.type === "agent" && step.agentId === agentId)
      .map((step) => `${loop.id}:${step.id}`));
    if (references.length > 0) {
      throw new AutomationConflictError(
        `Agent ${agentId} is referenced by automation steps: ${references.join(", ")}.`
      );
    }
  }
}
