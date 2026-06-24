import { v4 as uuid } from "uuid";
import type { AppData, CollectionName, EventRecord, Runtime } from "./shared/domain.js";
import { routeEvent } from "./shared/policy.js";
import { getProjectRoot } from "./markdown.js";
import { loadMarkdownAppData, removeEntityMarkdown, runtimeDefaults, writeEntityMarkdown } from "./markdown-adapter.js";

const timestamp = () => new Date().toISOString();
const cloneData = (data: AppData): AppData => JSON.parse(JSON.stringify(data)) as AppData;

type MutableMarkdownCollection = Exclude<CollectionName, "runtimes">;

const markdownCollections = new Set<CollectionName>(["projects", "goals", "adrs", "agents", "policies", "events"]);

export class MarkdownStore {
  private runtimes: Runtime[] = runtimeDefaults();

  get root(): string {
    return getProjectRoot();
  }

  async read(): Promise<AppData> {
    const data = await loadMarkdownAppData(this.root);
    data.runtimes = cloneData({ ...data, runtimes: this.runtimes }).runtimes;
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

    const data = await this.read();
    const target = (data[collection] as unknown as Array<Record<string, unknown>>).find((item) => item.id === id);
    const relativePath = typeof target?.relativePath === "string" ? target.relativePath : undefined;
    if (!relativePath) return;
    await removeEntityMarkdown(this.root, relativePath);
  }

  async createEvent(input: Omit<Partial<EventRecord>, "id" | "createdAt" | "status"> & Pick<EventRecord, "projectId" | "eventType">) {
    const data = await this.read();
    const event: EventRecord = {
      id: uuid(),
      projectId: input.projectId,
      source: input.source ?? "unknown",
      eventType: input.eventType,
      tags: input.tags ?? [],
      payload: input.payload ?? {},
      status: "received",
      body: input.body ?? "",
      createdAt: timestamp()
    };

    const route = routeEvent(event, data.policies, data.agents);
    const routedEvent: EventRecord = {
      ...event,
      status: route.status,
      matchedPolicyId: route.matchedPolicyId,
      assignedAgentId: route.assignedAgentId,
      handlingResult: route.handlingResult
    };

    await writeEntityMarkdown(this.root, "events", routedEvent as unknown as Record<string, unknown>);
    const refreshed = await this.read();
    return refreshed.events.find((candidate) => candidate.id === routedEvent.id) ?? routedEvent;
  }
}

export const store = new MarkdownStore();
