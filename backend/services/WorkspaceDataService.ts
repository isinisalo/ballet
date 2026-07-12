import type { AppData } from "../../shared/api/workspace-contracts.js";
import { loadMarkdownAppData } from "../documents/markdownAppDataLoader.js";
import type { WorkspaceContentData } from "../documents/markdownAppDataLoader.js";
import { loadProjectAutomationConfigWithIssues } from "../automation.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";
import type { LoopThemeRepository } from "../loop-themes/LoopThemeRepository.js";
import { validateAutomationThemeReferences } from "../../shared/domain/loopThemes.js";

export class WorkspaceDataService {
  private enrich?: (data: WorkspaceContentData & Pick<AppData, "loopRuns" | "scheduleStates">) => Promise<AppData>;

  constructor(
    private readonly root: () => string,
    private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider,
    private readonly loopThemeRepository: LoopThemeRepository
  ) {}

  setEnricher(enrich: (data: WorkspaceContentData & Pick<AppData, "loopRuns" | "scheduleStates">) => Promise<AppData>): void {
    this.enrich = enrich;
  }

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
    const content = {
      ...data,
      loopRuns: this.runtimeDatabaseProvider.runtimeDatabase().listLoopRuns(),
      scheduleStates: this.runtimeDatabaseProvider.runtimeDatabase().listLoopScheduleStates()
    };
    if (!this.enrich) throw new Error("Workspace runtime enrichment is not configured.");
    return this.enrich(content);
  }
}
