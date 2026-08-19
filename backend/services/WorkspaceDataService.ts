import type { AppData } from "../../shared/api/workspace-contracts.js";
import { loadMarkdownAppData } from "../documents/markdownAppDataLoader.js";
import type { WorkspaceContentData } from "../documents/markdownAppDataLoader.js";
import { loadProjectAutomationConfigWithIssues, validateProjectExecutionResources } from "../automation.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";
import type { LoopThemeRepository } from "../loop-themes/LoopThemeRepository.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";

export class WorkspaceDataService {
  private enrich?: (data: WorkspaceContentData & Pick<AppData,
    "loopRuns" | "activeRootRuns" | "orchestratorRoutes" | "scheduleStates">) => Promise<AppData>;
  private readonly projectConfigurations = new ProjectConfigurationRepository();

  constructor(
    private readonly root: () => string,
    private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider,
    private readonly loopThemeRepository: LoopThemeRepository
  ) {}

  setEnricher(enrich: (data: WorkspaceContentData & Pick<AppData,
    "loopRuns" | "activeRootRuns" | "orchestratorRoutes" | "scheduleStates">) => Promise<AppData>): void {
    this.enrich = enrich;
  }

  async read(): Promise<AppData> {
    const data = await loadMarkdownAppData(this.root());
    const projectConfiguration = this.projectConfigurations.load(this.root());
    const [automation, themeLoad] = await Promise.all([
      loadProjectAutomationConfigWithIssues(this.root()),
      this.loopThemeRepository.load(this.root())
    ]);
    data.executionProfiles = projectConfiguration.config?.executionProfiles ?? [];
    data.automation = automation.config;
    data.automationIssues = [
      ...automation.issues,
      ...validateProjectExecutionResources(automation.config, {
        instructions: data.instructions,
        skills: data.skills,
        issues: data.resourceIssues
      })
    ];
    data.loopTheme = themeLoad.theme;
    data.loopThemeIssues = themeLoad.issues;
    const content = {
      ...data,
      loopRuns: this.runtimeDatabaseProvider.runtimeDatabase().listLoopRuns(),
      activeRootRuns: [],
      orchestratorRoutes: [],
      scheduleStates: this.runtimeDatabaseProvider.runtimeDatabase().listLoopScheduleStates()
    };
    if (!this.enrich) throw new Error("Workspace runtime enrichment is not configured.");
    return this.enrich(content);
  }
}
