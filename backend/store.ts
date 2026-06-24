import { v4 as uuid } from "uuid";
import type { AgentRunLog, AppData, CollectionName, EventRecord, MarkdownDocument, Runtime } from "./shared/domain.js";
import { getProjectRoot } from "./markdown.js";
import { loadMarkdownAppData, removeEntityMarkdown, runtimeDefaults, writeEntityMarkdown, writeProjectMarkdownDocument } from "./markdown-adapter.js";
import { RuntimeDatabase, resolveRuntimeDbPath } from "./runtime-db.js";
import { notifyRuntimeChanged } from "./runtime-events.js";

const timestamp = () => new Date().toISOString();
const cloneData = (data: AppData): AppData => JSON.parse(JSON.stringify(data)) as AppData;

type MutableMarkdownCollection = Exclude<CollectionName, "runtimes">;

const markdownCollections = new Set<CollectionName>(["projects", "goals", "adrs", "agents", "skills", "policies", "events"]);

export class MarkdownStore {
  private runtimes: Runtime[] = runtimeDefaults();
  private runtimeDb?: RuntimeDatabase;
  private runtimeDbPath?: string;

  get root(): string {
    return getProjectRoot();
  }

  async read(): Promise<AppData> {
    const data = await loadMarkdownAppData(this.root);
    data.runtimes = cloneData({ ...data, runtimes: this.runtimes }).runtimes;
    data.events = this.db().listEventRecords();
    data.agentRuns = this.db().listRuns();
    return data;
  }

  async reset(): Promise<AppData> {
    return this.read();
  }

  async list<T extends CollectionName>(collection: T): Promise<AppData[T]> {
    const data = await this.read();
    return data[collection];
  }

  async upsert<T extends CollectionName>(
    collection: T,
    item: Partial<AppData[T][number]> & { id?: string }
  ): Promise<AppData[T][number]> {
    if (collection === "runtimes") {
      const id = item.id ?? uuid();
      const now = timestamp();
      const index = this.runtimes.findIndex((runtime) => runtime.id === id);
      const existing = index >= 0 ? this.runtimes[index] : { id, createdAt: now };
      const next = { ...existing, ...item, id, updatedAt: now, createdAt: existing.createdAt ?? now } as Runtime;
      if (index >= 0) this.runtimes[index] = next;
      else this.runtimes.unshift(next);
      return next as AppData[T][number];
    }

    if (!markdownCollections.has(collection)) {
      throw new Error(`Unsupported collection: ${collection}`);
    }

    const data = await this.read();
    const existing = (data[collection] as unknown as Array<Record<string, unknown>>).find((candidate) => candidate.id === item.id);
    const nextInput = { ...existing, ...item } as Record<string, unknown>;
    const saved = await writeEntityMarkdown(this.root, collection as MutableMarkdownCollection, nextInput);
    const refreshed = await this.read();
    return ((refreshed[collection] as unknown as Array<Record<string, unknown>>).find((candidate) => candidate.id === saved.id) ?? saved) as unknown as AppData[T][number];
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    if (collection === "runtimes") {
      this.runtimes = this.runtimes.filter((runtime) => runtime.id !== id);
      return;
    }

    if (collection === "events") {
      const markdownData = await loadMarkdownAppData(this.root);
      const markdownEvent = markdownData.events.find((item) => item.id === id);
      if (markdownEvent?.relativePath) {
        await removeEntityMarkdown(this.root, markdownEvent.relativePath);
        return;
      } else {
        this.db().deleteEvent(id);
        notifyRuntimeChanged("events");
        return;
      }
    }

    const data = await this.read();
    const target = (data[collection] as unknown as Array<Record<string, unknown>>).find((item) => item.id === id);
    const relativePath = typeof target?.relativePath === "string" ? target.relativePath : undefined;
    if (!relativePath) return;
    await removeEntityMarkdown(this.root, relativePath);
  }

  async saveProjectDocument(input: {
    relativePath: string;
    frontmatter: Record<string, unknown>;
    body: string;
  }): Promise<MarkdownDocument> {
    return writeProjectMarkdownDocument(this.root, input);
  }

  async createEvent(input: Omit<Partial<EventRecord>, "id" | "createdAt" | "status"> & Pick<EventRecord, "projectId" | "eventType">) {
    const data = await this.read();
    const result = this.db().intakeEvent({
      projectId: input.projectId,
      eventType: input.eventType,
      source: input.source,
      subject: typeof input.subject === "string" ? input.subject : undefined,
      correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      causationId: typeof input.causationId === "string" ? input.causationId : undefined,
      dedupeKey: typeof input.dedupeKey === "string" ? input.dedupeKey : undefined,
      correlationDepth: typeof input.correlationDepth === "number" ? input.correlationDepth : undefined,
      tags: input.tags,
      payload: input.payload,
      body: input.body
    }, data.policies, data.agents);
    notifyRuntimeChanged("events");
    if (result.runs.length > 0) notifyRuntimeChanged("agent-runs");
    return result.event;
  }

  listAgentRuns() {
    return this.db().listRuns();
  }

  retryAgentRun(runId: string) {
    const run = this.db().retryRun(runId);
    notifyRuntimeChanged("agent-runs");
    return run;
  }

  listRunLogs(runId?: string): AgentRunLog[] {
    return this.db().listRunLogs(runId);
  }

  runtimeHealth() {
    return this.db().health();
  }

  runtimeDatabase(): RuntimeDatabase {
    return this.db();
  }

  private db(): RuntimeDatabase {
    const dbPath = resolveRuntimeDbPath(this.root);
    if (!this.runtimeDb || this.runtimeDbPath !== dbPath) {
      this.runtimeDb?.close();
      this.runtimeDb = new RuntimeDatabase(dbPath);
      this.runtimeDbPath = dbPath;
    }
    return this.runtimeDb;
  }
}

export const store = new MarkdownStore();
