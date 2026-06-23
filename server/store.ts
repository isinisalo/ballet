import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { v4 as uuid } from "uuid";
import type { AppData, CollectionName, EventRecord } from "../shared/domain.js";
import { routeEvent } from "../shared/policy.js";
import { seedData } from "../shared/seed.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

const timestamp = () => new Date().toISOString();

const cloneData = (data: AppData): AppData => JSON.parse(JSON.stringify(data)) as AppData;

const ensureDataFile = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(seedData, null, 2));
  }
};

export class JsonStore {
  private data: AppData | null = null;

  async read(): Promise<AppData> {
    if (this.data) return cloneData(this.data);
    await ensureDataFile();
    const raw = await readFile(DATA_FILE, "utf8");
    this.data = JSON.parse(raw) as AppData;
    return cloneData(this.data);
  }

  async write(data: AppData): Promise<AppData> {
    this.data = cloneData(data);
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(this.data, null, 2));
    return cloneData(this.data);
  }

  async reset(): Promise<AppData> {
    return this.write(seedData);
  }

  async list<T extends CollectionName>(collection: T): Promise<AppData[T]> {
    const data = await this.read();
    return data[collection];
  }

  async upsert<T extends CollectionName>(
    collection: T,
    item: Partial<AppData[T][number]> & { id?: string }
  ): Promise<AppData[T][number]> {
    const data = await this.read();
    const now = timestamp();
    const items = data[collection] as unknown as Array<Record<string, unknown>>;
    const id = item.id ?? uuid();
    const index = items.findIndex((candidate) => candidate.id === id);
    const existing = index >= 0 ? items[index] : { createdAt: now };
    const next = {
      ...existing,
      ...item,
      id,
      updatedAt: now,
      createdAt: existing.createdAt ?? now
    };

    if (index >= 0) items[index] = next;
    else items.unshift(next);

    await this.write(data);
    return next as unknown as AppData[T][number];
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    const data = await this.read();
    if (collection === "projects") {
      data.goals = data.goals.filter((goal) => goal.projectId !== id);
      data.adrs = data.adrs.filter((adr) => adr.projectId !== id);
      data.policies = data.policies.filter((policy) => policy.projectId !== id);
      data.events = data.events.filter((event) => event.projectId !== id);
    }

    const items = data[collection] as Array<{ id: string }>;
    data[collection] = items.filter((item) => item.id !== id) as never;
    await this.write(data);
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

    data.events.unshift(routedEvent);
    await this.write(data);
    return routedEvent;
  }
}

export const store = new JsonStore();
