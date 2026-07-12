import type { AppData } from "../../shared/api/workspaceData.js";
import { loadMarkdownAppData } from "../markdown-adapter.js";
import { loadProjectAutomationConfigWithIssues } from "../automation.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";
import type { LoopThemeRepository } from "../loop-themes/LoopThemeRepository.js";
import { validateAutomationThemeReferences } from "../../shared/domain/loopThemes.js";

export class WorkspaceDataService {
  constructor(
    private readonly root: () => string,
    private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider,
    private readonly loopThemeRepository: LoopThemeRepository
  ) {}

  async read(): Promise<AppData> {
    const data = await loadMarkdownAppData(this.root());
    const [automation, themes] = await Promise.all([
      loadProjectAutomationConfigWithIssues(this.root(), data.agents),
      this.loopThemeRepository.load(this.root())
    ]);
    data.automation = automation.config;
    data.automationIssues = automation.issues;
    data.loopThemes = themes.themes;
    data.loopThemeIssues = [
      ...themes.issues,
      ...validateAutomationThemeReferences(automation.config, themes.themes)
    ];
    data.eventDefinitions = [];
    data.events = this.runtimeDatabaseProvider.runtimeDatabase().listEventRecords();
    data.loopRuns = this.runtimeDatabaseProvider.runtimeDatabase().listLoopRuns();
    data.scheduleStates = this.runtimeDatabaseProvider.runtimeDatabase().listLoopScheduleStates();
    return data;
  }
}
