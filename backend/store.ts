import path from "node:path";
import type { AppData, CollectionName, WorkspaceSaveRequestByCollection } from "../shared/api/workspaceData.js";
import type { ProjectAutomationConfig } from "../shared/domain/automation.js";
import type { MarkdownDocument } from "../shared/domain/documents.js";
import { getProjectRoot } from "./markdown.js";
import { RuntimeDatabase } from "./runtime-db.js";
import { AutomationValidationError } from "./automation.js";
import { AutomationService } from "./services/AutomationService.js";
import { MarkdownEntityService } from "./services/MarkdownEntityService.js";
import { RuntimeDatabaseProvider } from "./services/RuntimeDatabaseProvider.js";
import { WorkspaceDataService } from "./services/WorkspaceDataService.js";
import type { WorkspaceContentData } from "./documents/markdownAppDataLoader.js";
import type { CreateLoopThemeRequest } from "../shared/api/workspace-contracts.js";
import type { LoopTheme, LoopThemeId } from "../shared/domain/loopThemes.js";
import { LoopThemeRepository } from "./loop-themes/LoopThemeRepository.js";
import { LoopThemeService } from "./services/LoopThemeService.js";

export class MarkdownStore {
  private readonly projectRoot: string;
  private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider;
  private projectConfigMutationQueue: Promise<void> = Promise.resolve();
  private readonly loopThemeRepository = new LoopThemeRepository();
  private readonly workspaceDataService: WorkspaceDataService;
  private readonly markdownEntityService: MarkdownEntityService;
  private readonly automationService: AutomationService;
  private readonly loopThemeService: LoopThemeService;
  private agentRemovalHook?: (agentId: string) => Promise<void> | void;

  constructor(root = getProjectRoot(), runtimeDatabase?: RuntimeDatabase) {
    this.projectRoot = root;
    this.runtimeDatabaseProvider = new RuntimeDatabaseProvider(
      runtimeDatabase ?? new RuntimeDatabase(path.join(root, ".git", "ballet", "state.sqlite"))
    );
    this.workspaceDataService = new WorkspaceDataService(() => this.root, this.runtimeDatabaseProvider, this.loopThemeRepository);
    this.markdownEntityService = new MarkdownEntityService(() => this.root, () => this.read());
    this.automationService = new AutomationService(() => this.root, this.runtimeDatabaseProvider, this.loopThemeRepository);
    this.loopThemeService = new LoopThemeService(() => this.root, this.loopThemeRepository, (config) => this.automationService.save(config));
  }

  get root(): string {
    return this.projectRoot;
  }

  read(): Promise<AppData> {
    return this.workspaceDataService.read();
  }

  reset(): Promise<AppData> {
    return this.read();
  }

  setWorkspaceEnricher(
    enrich: (data: WorkspaceContentData & Pick<AppData, "loopRuns" | "scheduleStates">) => Promise<AppData>
  ): void {
    this.workspaceDataService.setEnricher(enrich);
  }

  setAgentRemovalHook(hook: (agentId: string) => Promise<void> | void): void {
    this.agentRemovalHook = hook;
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
    if (collection === "agents") await this.agentRemovalHook?.(id);
    await this.markdownEntityService.remove(collection, id);
  }

  saveAutomation(config: ProjectAutomationConfig): Promise<ProjectAutomationConfig> {
    return this.runProjectConfigMutation(() => this.automationService.save(config));
  }

  updateLoopTheme(themeId: LoopThemeId, theme: LoopTheme): Promise<LoopTheme> {
    return this.loopThemeService.update(themeId, theme);
  }

  createLoopTheme(input: CreateLoopThemeRequest) {
    return this.runProjectConfigMutation(() => this.loopThemeService.create(input));
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

export const store = new MarkdownStore();
export { AutomationValidationError };
