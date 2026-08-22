import type { AppData } from "../../shared/api/workspace-contracts.js";
import { loadMarkdownAppData } from "../documents/markdownAppDataLoader.js";
import type { WorkspaceContentData } from "../documents/markdownAppDataLoader.js";
import { loadProjectAutomationConfigWithIssues, validateProjectExecutionResources } from "../automation.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";
import type { CanvasThemeRepository } from "../canvas-themes/CanvasThemeRepository.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";

export class WorkspaceDataService {
  private enrich?: (data: WorkspaceContentData & Pick<AppData,
    "graphNodeInvocations" | "activeRootRuns" | "routingDecisions">) => Promise<AppData>;
  private readonly projectConfigurations = new ProjectConfigurationRepository();

  constructor(
    private readonly root: () => string,
    private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider,
    private readonly canvasThemeRepository: CanvasThemeRepository
  ) {}

  setEnricher(enrich: (data: WorkspaceContentData & Pick<AppData,
    "graphNodeInvocations" | "activeRootRuns" | "routingDecisions">) => Promise<AppData>): void {
    this.enrich = enrich;
  }

  async read(): Promise<AppData> {
    const data = await loadMarkdownAppData(this.root());
    const projectConfiguration = this.projectConfigurations.load(this.root());
    const [automation, themeLoad] = await Promise.all([
      loadProjectAutomationConfigWithIssues(this.root()),
      this.canvasThemeRepository.load(this.root())
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
    data.canvasTheme = themeLoad.theme;
    data.canvasThemeIssues = themeLoad.issues;
    const content = {
      ...data,
      graphNodeInvocations: this.runtimeDatabaseProvider.runtimeDatabase().listGraphNodeInvocations(),
      activeRootRuns: [],
      routingDecisions: []
    };
    if (!this.enrich) throw new Error("Workspace runtime enrichment is not configured.");
    return this.enrich(content);
  }
}
