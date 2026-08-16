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
import type { LoopTheme } from "../shared/domain/loopThemes.js";
import type { ExecutionProfile } from "../shared/domain/projectConfig.js";
import { LoopThemeRepository } from "./loop-themes/LoopThemeRepository.js";
import { LoopThemeService } from "./services/LoopThemeService.js";
import type {
  InstalledLoopModuleStatus,
  LoopModuleExportResult,
  LoopModuleInspection,
  LoopModuleInstallPlan,
  LoopModuleLibraryEntry
} from "../shared/domain/loopModules.js";
import { LoopModuleService } from "./loop-modules/LoopModuleService.js";

export class MarkdownStore {
  private readonly projectRoot: string;
  private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider;
  private projectConfigMutationQueue: Promise<void> = Promise.resolve();
  private readonly loopThemeRepository = new LoopThemeRepository();
  private readonly workspaceDataService: WorkspaceDataService;
  private readonly markdownEntityService: MarkdownEntityService;
  private readonly automationService: AutomationService;
  private readonly loopThemeService: LoopThemeService;
  private readonly loopModuleService: LoopModuleService;

  constructor(root = getProjectRoot(), runtimeDatabase?: RuntimeDatabase) {
    this.projectRoot = root;
    this.runtimeDatabaseProvider = new RuntimeDatabaseProvider(
      runtimeDatabase ?? new RuntimeDatabase(path.join(root, ".git", "ballet", "state.sqlite"))
    );
    this.workspaceDataService = new WorkspaceDataService(() => this.root, this.runtimeDatabaseProvider, this.loopThemeRepository);
    this.markdownEntityService = new MarkdownEntityService(() => this.root, () => this.read());
    this.automationService = new AutomationService(() => this.root, this.runtimeDatabaseProvider);
    this.loopThemeService = new LoopThemeService(() => this.root, this.loopThemeRepository);
    this.loopModuleService = new LoopModuleService(() => this.root, this.runtimeDatabaseProvider);
  }

  get root(): string {
    return this.projectRoot;
  }

  read(): Promise<AppData> {
    return this.workspaceDataService.read();
  }

  setWorkspaceEnricher(
    enrich: (data: WorkspaceContentData & Pick<AppData, "loopRuns" | "scheduleStates">) => Promise<AppData>
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

  updateLoopTheme(theme: LoopTheme): Promise<LoopTheme> {
    return this.loopThemeService.update(theme);
  }

  listLoopModuleLibrary(): Promise<LoopModuleLibraryEntry[]> {
    return this.loopModuleService.listLibrary();
  }

  inspectLoopModule(input: unknown, source?: string): LoopModuleInspection {
    return this.loopModuleService.inspect(input, source);
  }

  planLoopModuleInstall(input: { package: unknown; source: string; profileMappings?: Record<string, string> }): Promise<LoopModuleInstallPlan> {
    return this.loopModuleService.plan(input);
  }

  installLoopModule(input: {
    package: unknown;
    source: string;
    profileMappings?: Record<string, string>;
    expectedPlanHash: string;
  }): Promise<InstalledLoopModuleStatus> {
    return this.runProjectConfigMutation(() => this.loopModuleService.commit(input));
  }

  exportLoopModule(input: {
    loopId: string;
    title?: string;
    description?: string;
    version?: string;
    category?: string;
    tags?: string[];
  }): Promise<LoopModuleExportResult> {
    return this.loopModuleService.exportLoop(input);
  }

  loopModuleStatuses(): Promise<InstalledLoopModuleStatus[]> {
    return this.loopModuleService.statuses();
  }

  removeInstalledLoopModule(loopId: string): Promise<void> {
    return this.runProjectConfigMutation(() => this.loopModuleService.remove(loopId));
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
