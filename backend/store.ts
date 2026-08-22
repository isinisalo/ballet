import path from "node:path";
import type { AppData, CollectionName, WorkspaceSaveRequestByCollection } from "../shared/api/workspace-contracts.js";
import type { ProjectAutomationConfig } from "../shared/domain/automation.js";
import type { MarkdownDocument } from "../shared/domain/documents.js";
import { getProjectRoot } from "./markdown.js";
import { RuntimeDatabase } from "./runtime-db.js";
import { AutomationService } from "./services/AutomationService.js";
import { MarkdownEntityService } from "./services/MarkdownEntityService.js";
import { RuntimeDatabaseProvider } from "./services/RuntimeDatabaseProvider.js";
import { WorkspaceDataService } from "./services/WorkspaceDataService.js";
import type { WorkspaceContentData } from "./documents/markdownAppDataLoader.js";
import type { CanvasTheme } from "../shared/domain/canvasTheme.js";
import type { ExecutionProfile } from "../shared/domain/projectConfig.js";
import { CanvasThemeRepository } from "./canvas-themes/CanvasThemeRepository.js";
import { CanvasThemeService } from "./services/CanvasThemeService.js";
import type {
  InstalledGraphNodeModuleStatus,
  GraphNodeModuleExportResult,
  GraphNodeModuleInspection,
  GraphNodeModuleInstallPlan,
  GraphNodeModuleLibraryEntry
} from "../shared/domain/graphNodeModules.js";
import { GraphNodeModuleService } from "./graph-node-modules/GraphNodeModuleService.js";

export class MarkdownStore {
  private readonly projectRoot: string;
  private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider;
  private projectConfigMutationQueue: Promise<void> = Promise.resolve();
  private readonly canvasThemeRepository = new CanvasThemeRepository();
  private readonly workspaceDataService: WorkspaceDataService;
  private readonly markdownEntityService: MarkdownEntityService;
  private readonly automationService: AutomationService;
  private readonly canvasThemeService: CanvasThemeService;
  private readonly graphNodeModuleService: GraphNodeModuleService;

  constructor(root = getProjectRoot(), runtimeDatabase?: RuntimeDatabase) {
    this.projectRoot = root;
    this.runtimeDatabaseProvider = new RuntimeDatabaseProvider(
      runtimeDatabase ?? new RuntimeDatabase(path.join(root, ".git", "ballet", "state.sqlite"))
    );
    this.workspaceDataService = new WorkspaceDataService(() => this.root, this.runtimeDatabaseProvider, this.canvasThemeRepository);
    this.markdownEntityService = new MarkdownEntityService(() => this.root, () => this.read());
    this.automationService = new AutomationService(() => this.root, this.runtimeDatabaseProvider);
    this.canvasThemeService = new CanvasThemeService(() => this.root, this.canvasThemeRepository);
    this.graphNodeModuleService = new GraphNodeModuleService(() => this.root, this.runtimeDatabaseProvider);
  }

  get root(): string {
    return this.projectRoot;
  }

  read(): Promise<AppData> {
    return this.workspaceDataService.read();
  }

  setWorkspaceEnricher(
    enrich: (data: WorkspaceContentData & Pick<AppData,
      "graphNodeInvocations" | "activeRootRuns" | "routingDecisions">) => Promise<AppData>
  ): void {
    this.workspaceDataService.setEnricher(enrich);
  }

  list<T extends CollectionName>(collection: T): Promise<AppData[T]> {
    return this.markdownEntityService.list(collection);
  }

  upsert<T extends CollectionName>(
    collection: T,
    item: WorkspaceSaveRequestByCollection[T]
  ): Promise<AppData[T][number]> {
    return this.markdownEntityService.upsert(collection, item);
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    await this.runProjectConfigMutation(async () => {
      await this.automationService.assertProjectResourceRemovable(id);
      await this.markdownEntityService.remove(collection, id);
    });
  }

  saveAutomation(config: ProjectAutomationConfig): Promise<ProjectAutomationConfig> {
    return this.runProjectConfigMutation(() => this.automationService.save(config));
  }

  createExecutionProfile(profile: ExecutionProfile): Promise<ExecutionProfile> {
    return this.runProjectConfigMutation(async () => this.automationService.createExecutionProfile(profile));
  }

  updateExecutionProfile(profile: ExecutionProfile): Promise<ExecutionProfile> {
    return this.runProjectConfigMutation(async () => this.automationService.updateExecutionProfile(profile));
  }

  removeExecutionProfile(executionProfileId: string): Promise<void> {
    return this.runProjectConfigMutation(async () => this.automationService.removeExecutionProfile(executionProfileId));
  }

  updateCanvasTheme(theme: CanvasTheme): Promise<CanvasTheme> {
    return this.canvasThemeService.update(theme);
  }

  listGraphNodeModuleLibrary(): Promise<GraphNodeModuleLibraryEntry[]> {
    return this.graphNodeModuleService.listLibrary();
  }

  inspectGraphNodeModule(input: unknown, source?: string): GraphNodeModuleInspection {
    return this.graphNodeModuleService.inspect(input, source);
  }

  planGraphNodeModuleInstall(input: { package: unknown; source: string; profileMappings?: Record<string, string> }): Promise<GraphNodeModuleInstallPlan> {
    return this.graphNodeModuleService.plan(input);
  }

  installGraphNodeModule(input: {
    package: unknown;
    source: string;
    profileMappings?: Record<string, string>;
    expectedPlanHash: string;
  }): Promise<InstalledGraphNodeModuleStatus> {
    return this.runProjectConfigMutation(() => this.graphNodeModuleService.commit(input));
  }

  exportGraphNodeModule(input: {
    graphNodeId: string;
    title?: string;
    description?: string;
    version?: string;
    category?: string;
    tags?: string[];
  }): Promise<GraphNodeModuleExportResult> {
    return this.graphNodeModuleService.exportGraphNode(input);
  }

  graphNodeModuleStatuses(): Promise<InstalledGraphNodeModuleStatus[]> {
    return this.graphNodeModuleService.statuses();
  }

  removeInstalledGraphNodeModule(graphNodeId: string): Promise<void> {
    return this.runProjectConfigMutation(() => this.graphNodeModuleService.remove(graphNodeId));
  }

  saveProjectDocument(input: {
    relativePath: string;
    frontmatter: Record<string, unknown>;
    body: string;
  }): Promise<MarkdownDocument> {
    return this.markdownEntityService.saveProjectDocument(input);
  }

  createProjectDocument(input: {
    directoryPath: string;
    title: string;
  }): Promise<MarkdownDocument> {
    return this.markdownEntityService.createProjectDocument(input);
  }

  runtimeDatabase(): RuntimeDatabase {
    return this.runtimeDatabaseProvider.runtimeDatabase();
  }

  private async runProjectConfigMutation<T>(mutation: () => Promise<T>): Promise<T> {
    const predecessor = this.projectConfigMutationQueue;
    let release!: () => void;
    this.projectConfigMutationQueue = new Promise<void>((resolve) => { release = resolve; });
    await predecessor;
    try {
      return await mutation();
    } finally {
      release();
    }
  }
}
