import type { AgentRunLog, AppData, CollectionName, EventDefinition, EventRecord, MarkdownDocument } from "./shared/domain.js";
import { getProjectRoot } from "./markdown.js";
import { loadMarkdownAppData, removeEntityMarkdown, writeEntityMarkdown, writeProjectMarkdownDocument } from "./markdown-adapter.js";
import { RuntimeDatabase, resolveRuntimeDbPath } from "./runtime-db.js";
import { notifyRuntimeChanged } from "./runtime-events.js";

type MutableMarkdownCollection = Exclude<CollectionName, "events"> | "eventDefinitions";

const markdownCollections = new Set<MutableMarkdownCollection>(["projects", "goals", "adrs", "agents", "skills", "runtimes", "policies", "eventDefinitions"]);

export class EventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventValidationError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const eventTypesForPolicy = (policy: unknown): string[] => {
  if (!isRecord(policy)) return [];
  const match = isRecord(policy.match) ? policy.match : undefined;
  const rawEventTypes = match?.eventTypes ?? policy.eventTypes;
  if (Array.isArray(rawEventTypes)) return rawEventTypes.map(String).filter(Boolean);
  if (typeof rawEventTypes === "string") return rawEventTypes ? [rawEventTypes] : [];
  return [];
};

export class MarkdownStore {
  private runtimeDb?: RuntimeDatabase;
  private runtimeDbPath?: string;

  get root(): string {
    return getProjectRoot();
  }

  async read(): Promise<AppData> {
    const data = await loadMarkdownAppData(this.root);
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

  async listEventDefinitions(): Promise<EventDefinition[]> {
    const data = await this.read();
    return data.eventDefinitions;
  }

  async upsert<T extends CollectionName>(
    collection: T,
    item: Partial<AppData[T][number]> & { id?: string }
  ): Promise<AppData[T][number]> {
    if (!markdownCollections.has(collection as MutableMarkdownCollection)) {
      throw new Error(`Unsupported collection: ${collection}`);
    }

    const data = await this.read();
    const existing = (data[collection] as unknown as Array<Record<string, unknown>>).find((candidate) => candidate.id === item.id);
    const nextInput = { ...existing, ...item } as Record<string, unknown>;
    if (collection === "policies") this.validatePolicyInput(nextInput, data.eventDefinitions);
    const saved = await writeEntityMarkdown(this.root, collection as MutableMarkdownCollection, nextInput);
    const refreshed = await this.read();
    return ((refreshed[collection] as unknown as Array<Record<string, unknown>>).find((candidate) => candidate.id === saved.id) ?? saved) as unknown as AppData[T][number];
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    if (collection === "events") {
      this.db().deleteEvent(id);
      notifyRuntimeChanged("events");
      return;
    }

    const data = await this.read();
    const target = (data[collection] as unknown as Array<Record<string, unknown>>).find((item) => item.id === id);
    const relativePath = typeof target?.relativePath === "string" ? target.relativePath : undefined;
    if (!relativePath) return;
    await removeEntityMarkdown(this.root, relativePath);
  }

  async saveEventDefinition(item: Partial<EventDefinition> & { id?: string }): Promise<EventDefinition> {
    const data = await this.read();
    const existing = data.eventDefinitions.find((candidate) => candidate.id === item.id);
    const nextInput = { ...existing, ...item } as Record<string, unknown>;
    if (existing) this.validateEventDefinitionChange(existing, nextInput, data.policies);
    const saved = await writeEntityMarkdown(this.root, "eventDefinitions", nextInput);
    const refreshed = await this.read();
    return refreshed.eventDefinitions.find((candidate) => candidate.id === saved.id) ?? (saved as unknown as EventDefinition);
  }

  async removeEventDefinition(id: string): Promise<void> {
    const data = await this.read();
    const target = data.eventDefinitions.find((item) => item.id === id);
    if (!target?.relativePath) return;
    this.validateEventDefinitionRemoval(target, data.policies);
    await removeEntityMarkdown(this.root, target.relativePath);
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
    const hasActiveDefinition = data.eventDefinitions.some((definition) =>
      definition.active && definition.eventType === input.eventType
    );
    if (!hasActiveDefinition) {
      throw new EventValidationError(`Unknown or inactive event type: ${input.eventType}`);
    }
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

  private validatePolicyInput(input: Record<string, unknown>, eventDefinitions: EventDefinition[]) {
    const eventTypes = eventTypesForPolicy(input);
    if (eventTypes.length === 0) {
      throw new EventValidationError("Policy must handle exactly one active event type.");
    }
    if (eventTypes.length > 1) {
      throw new EventValidationError("Policy must handle exactly one active event type.");
    }

    const activeEventTypes = new Set(eventDefinitions.filter((definition) => definition.active).map((definition) => definition.eventType));
    const missing = eventTypes.filter((eventType) => !activeEventTypes.has(eventType));
    if (missing.length > 0) {
      throw new EventValidationError(`Policy references unknown or inactive event type: ${missing.join(", ")}`);
    }
  }

  private policiesUsingEventType(eventType: string, policies: unknown[]): string[] {
    return policies
      .filter((policy) => eventTypesForPolicy(policy).includes(eventType))
      .map((policy) => {
        if (!isRecord(policy)) return "unknown-policy";
        return typeof policy.name === "string" && policy.name ? policy.name : String(policy.id ?? "unknown-policy");
      });
  }

  private validateEventDefinitionChange(existing: EventDefinition, nextInput: Record<string, unknown>, policies: AppData["policies"]) {
    const nextEventType = typeof nextInput.eventType === "string" ? nextInput.eventType : existing.eventType;
    const nextActive = typeof nextInput.active === "boolean" ? nextInput.active : existing.active;
    const referencedBy = this.policiesUsingEventType(existing.eventType, policies);
    if (referencedBy.length === 0) return;

    if (!nextActive) {
      throw new EventValidationError(`Event type ${existing.eventType} is used by policies: ${referencedBy.join(", ")}`);
    }
    if (nextEventType !== existing.eventType) {
      throw new EventValidationError(`Event type ${existing.eventType} cannot be renamed because it is used by policies: ${referencedBy.join(", ")}`);
    }
  }

  private validateEventDefinitionRemoval(definition: EventDefinition, policies: AppData["policies"]) {
    const referencedBy = this.policiesUsingEventType(definition.eventType, policies);
    if (referencedBy.length > 0) {
      throw new EventValidationError(`Event type ${definition.eventType} is used by policies: ${referencedBy.join(", ")}`);
    }
  }
}

export const store = new MarkdownStore();
