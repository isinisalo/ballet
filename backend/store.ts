import type { AppData, CollectionName } from "../shared/api/workspaceData.js";
import type { ProjectAutomationConfig } from "../shared/domain/automation.js";
import type { MarkdownDocument } from "../shared/domain/documents.js";
import type { EventRecord } from "../shared/domain/events.js";
import type { AgentRunLog } from "../shared/domain/runtime.js";
import { getProjectRoot } from "./markdown.js";
import type { RuntimeDatabase } from "./runtime-db.js";
import { AutomationValidationError } from "./automation.js";
import { AutomationService } from "./services/AutomationService.js";
import { EventIntakeService, EventValidationError } from "./services/EventIntakeService.js";
import { MarkdownEntityService } from "./services/MarkdownEntityService.js";
import { RuntimeDatabaseProvider } from "./services/RuntimeDatabaseProvider.js";
import { RuntimeRunService } from "./services/RuntimeRunService.js";
import { WorkspaceDataService } from "./services/WorkspaceDataService.js";

export class MarkdownStore {
  private readonly runtimeDatabaseProvider = new RuntimeDatabaseProvider(() => this.root);
  private readonly workspaceDataService = new WorkspaceDataService(() => this.root, this.runtimeDatabaseProvider);
  private readonly markdownEntityService = new MarkdownEntityService(() => this.root, () => this.read());
  private readonly automationService = new AutomationService(() => this.root);
  private readonly eventIntakeService = new EventIntakeService(() => this.read(), this.runtimeDatabaseProvider);
  private readonly runtimeRunService = new RuntimeRunService(this.runtimeDatabaseProvider);

  get root(): string {
    return getProjectRoot();
  }

  read(): Promise<AppData> {
    return this.workspaceDataService.read();
  }

  reset(): Promise<AppData> {
    return this.read();
  }

  list<T extends CollectionName>(collection: T): Promise<AppData[T]> {
    return this.markdownEntityService.list(collection);
  }

  upsert<T extends CollectionName>(
    collection: T,
    item: Partial<AppData[T][number]> & { id?: string }
  ): Promise<AppData[T][number]> {
    return this.markdownEntityService.upsert(collection, item);
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    if (collection === "events") {
      this.eventIntakeService.removeEvent(id);
      return;
    }
    await this.markdownEntityService.remove(collection, id);
  }

  saveAutomation(config: ProjectAutomationConfig): Promise<ProjectAutomationConfig> {
    return this.automationService.save(config);
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

  createEvent(input: Omit<Partial<EventRecord>, "id" | "createdAt" | "status"> & Pick<EventRecord, "projectId" | "eventType">) {
    return this.eventIntakeService.createEvent(input);
  }

  listAgentRuns() {
    return this.runtimeRunService.listAgentRuns();
  }

  retryAgentRun(runId: string) {
    return this.runtimeRunService.retryAgentRun(runId);
  }

  listRunLogs(runId?: string): AgentRunLog[] {
    return this.runtimeRunService.listRunLogs(runId);
  }

  runtimeHealth() {
    return this.runtimeRunService.runtimeHealth();
  }

  runtimeDatabase(): RuntimeDatabase {
    return this.runtimeRunService.runtimeDatabase();
  }
}

export const store = new MarkdownStore();
export { AutomationValidationError, EventValidationError };
