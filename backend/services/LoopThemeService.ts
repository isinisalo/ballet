import type {
  CreateLoopThemeRequest,
  CreateLoopThemeResponse
} from "../../shared/api/workspace-contracts.js";
import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import {
  builtInLoopThemes,
  introducedLoopThemeReferenceIssues,
  validateAutomationThemeReferences,
  type LoopTheme,
  type LoopThemeId
} from "../../shared/domain/loopThemes.js";
import { loadProjectAutomationConfigWithIssues } from "../automation.js";
import { validateProjectAutomationConfig, AutomationValidationError } from "../automation/validateAutomationConfig.js";
import { loadMarkdownAppData } from "../markdown-adapter.js";
import { notifyRuntimeChanged } from "../runtime-events.js";
import { LoopThemeConflictError, LoopThemeNotFoundError, LoopThemeValidationError } from "../loop-themes/LoopThemeErrors.js";
import type { LoopThemeRepository } from "../loop-themes/LoopThemeRepository.js";
import { parseLoopTheme } from "../loop-themes/loopThemeValidation.js";

type SaveAutomation = (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;

export class LoopThemeService {
  private createQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly root: () => string,
    private readonly repository: LoopThemeRepository,
    private readonly saveAutomation: SaveAutomation
  ) {}

  async update(themeId: LoopThemeId, value: unknown): Promise<LoopTheme> {
    const theme = parseLoopTheme(value);
    if (theme.id !== themeId) {
      throw new LoopThemeValidationError("Loop theme id does not match the request URL.", [{
        path: "id",
        message: `Theme id ${theme.id} must match URL id ${themeId}.`,
        themeId
      }]);
    }
    const loaded = await this.repository.load(this.root());
    const isBuiltIn = builtInLoopThemes.some((candidate) => candidate.id === themeId);
    const isKnown = loaded.themes.some((candidate) => candidate.id === themeId);
    if (!isBuiltIn && !isKnown && !await this.repository.hasFile(this.root(), themeId)) {
      throw new LoopThemeNotFoundError(`Theme ${themeId} was not found.`);
    }
    const saved = await this.repository.update(this.root(), theme);
    notifyRuntimeChanged("automation");
    return saved;
  }

  async create(input: CreateLoopThemeRequest): Promise<CreateLoopThemeResponse> {
    const predecessor = this.createQueue;
    let release!: () => void;
    this.createQueue = new Promise<void>((resolve) => { release = resolve; });
    await predecessor;
    try {
      return await this.createTransaction(input);
    } finally {
      release();
    }
  }

  private async createTransaction(input: CreateLoopThemeRequest): Promise<CreateLoopThemeResponse> {
    const theme = parseLoopTheme(input.theme);
    const root = this.root();
    const data = await loadMarkdownAppData(root);
    const [automation, loadedThemes] = await Promise.all([
      loadProjectAutomationConfigWithIssues(root, data.agents),
      this.repository.load(root)
    ]);
    if (automation.issues.length > 0) {
      throw new AutomationValidationError("Automation config is invalid.", automation.issues);
    }
    if (
      loadedThemes.themes.some((candidate) => candidate.id === theme.id)
      || await this.repository.hasFile(root, theme.id)
    ) {
      throw new LoopThemeConflictError(`Theme ${theme.id} already exists.`);
    }
    if (!automation.config.loops.some((loop) => loop.id === input.assignToLoopId)) {
      throw new LoopThemeNotFoundError(`Loop ${input.assignToLoopId} was not found.`);
    }

    const config: ProjectAutomationConfig = {
      ...automation.config,
      loops: automation.config.loops.map((loop) => loop.id === input.assignToLoopId
        ? { ...loop, theme: theme.id }
        : loop)
    };
    const configIssues = validateProjectAutomationConfig(config, data.agents);
    const currentReferenceIssues = validateAutomationThemeReferences(automation.config, loadedThemes.themes);
    const referenceIssues = validateAutomationThemeReferences(config, [...loadedThemes.themes, theme]);
    const introducedReferenceIssues = introducedLoopThemeReferenceIssues(currentReferenceIssues, referenceIssues);
    if (configIssues.length > 0 || introducedReferenceIssues.length > 0) {
      throw new AutomationValidationError("Automation config is invalid.", [...configIssues, ...introducedReferenceIssues]);
    }

    const created = await this.repository.create(root, theme);
    try {
      return { theme: created, automation: await this.saveAutomation(config) };
    } catch (error) {
      try {
        await this.repository.remove(root, created.id);
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], `Theme ${created.id} could not be rolled back after automation save failed.`);
      }
      throw error;
    }
  }
}
