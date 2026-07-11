import type { AppData, CollectionName } from "../shared/api/workspaceData.js";
import type { ProjectAutomationConfig } from "../shared/domain/automation.js";
import type { MarkdownDocument } from "../shared/domain/documents.js";
import type { EventRecord } from "../shared/domain/events.js";
import type { LoopRunSource, StepRunConsolePage, StepRunResult, StepRunLog } from "../shared/domain/runtime.js";
import { getProjectRoot } from "./markdown.js";
import type { RuntimeDatabase } from "./runtime-db.js";
import { AutomationValidationError } from "./automation.js";
import { AutomationService } from "./services/AutomationService.js";
import { EventIntakeService } from "./services/EventIntakeService.js";
import { MarkdownEntityService } from "./services/MarkdownEntityService.js";
import { RuntimeDatabaseProvider } from "./services/RuntimeDatabaseProvider.js";
import { LoopRunService } from "./services/LoopRunService.js";
import { WorkspaceDataService } from "./services/WorkspaceDataService.js";

export class MarkdownStore {
  private readonly runtimeDatabaseProvider = new RuntimeDatabaseProvider(() => this.root);
  private readonly workspaceDataService = new WorkspaceDataService(() => this.root, this.runtimeDatabaseProvider);
  private readonly markdownEntityService = new MarkdownEntityService(() => this.root, () => this.read());
  private readonly automationService = new AutomationService(() => this.root, this.runtimeDatabaseProvider);
  private readonly eventIntakeService = new EventIntakeService(this.runtimeDatabaseProvider);
  private readonly loopRunService = new LoopRunService(() => this.read(), this.runtimeDatabaseProvider);

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

  startLoopRun(loopId: string, input?: string, source: LoopRunSource = "manual") {
    return this.loopRunService.start(loopId, input, source);
  }

  latestLoopRun(loopId: string) {
    return this.loopRunService.latest(loopId);
  }

  getLoopRun(runId: string) {
    return this.loopRunService.database().getLoopRun(runId);
  }

  respondToStepRun(runId: string, stepRunId: string, result: StepRunResult, input: string) {
    return this.loopRunService.respond(runId, stepRunId, result, input);
  }

  cancelLoopRun(runId: string) {
    return this.loopRunService.cancel(runId);
  }

  listLoopRuns() {
    return this.loopRunService.list();
  }

  listStepRunLogs(stepRunId?: string): StepRunLog[] {
    return this.loopRunService.database().listStepRunLogs(stepRunId);
  }

  getStepRunConsole(runId: string, stepRunId: string, afterId = 0, limit = 500): StepRunConsolePage | undefined {
    const run = this.loopRunService.database().getLoopRun(runId);
    const stepRun = this.loopRunService.database().getStepRun(stepRunId);
    if (!run || !stepRun || stepRun.runId !== runId) return undefined;
    return this.loopRunService.database().getStepRunConsole(stepRunId, afterId, limit);
  }

  runtimeHealth() {
    return this.loopRunService.database().health();
  }

  runtimeDatabase(): RuntimeDatabase {
    return this.loopRunService.database();
  }
}

export const store = new MarkdownStore();
export { AutomationValidationError };
