import type { AgentRunLog, AppData, CollectionName, EventDefinition, EventRecord, MarkdownDocument } from "./shared/domain.js";
import { ContractRegistry, ContractRegistryError } from "./shared/contracts.js";
import { getProjectRoot } from "./markdown.js";
import { loadMarkdownAppData, removeEntityMarkdown, writeEntityMarkdown, writeProjectMarkdownDocument } from "./markdown-adapter.js";
import { RuntimeDatabase, resolveRuntimeDbPath } from "./runtime-db.js";
import { notifyRuntimeChanged } from "./runtime-events.js";
import { routeEventToOperations } from "./routing-engine.js";
import { evaluateEmissionPolicies } from "./emission-engine.js";

type MutableMarkdownCollection = Exclude<CollectionName, "events"> | "eventDefinitions";

const markdownCollections = new Set<MutableMarkdownCollection>([
  "projects",
  "goals",
  "adrs",
  "agents",
  "skills",
  "runtimes",
  "contracts",
  "operations",
  "policies",
  "emissionPolicies",
  "loopDefinitions",
  "eventDefinitions"
]);

export class EventValidationError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = "EventValidationError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const eventTypesForPolicy = (policy: unknown): string[] => {
  if (!isRecord(policy)) return [];
  const consumes = isRecord(policy.consumes) ? policy.consumes : undefined;
  const eventType = consumes?.eventType;
  return typeof eventType === "string" && eventType ? [eventType] : [];
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
    data.loopInstances = this.db().listLoopInstances();
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
    const definition = data.eventDefinitions.find((candidate) =>
      candidate.active && candidate.eventType === input.eventType
    );
    const hasActiveDefinition = Boolean(definition);
    if (!hasActiveDefinition || !definition) {
      throw new EventValidationError(`Unknown or inactive event type: ${input.eventType}`);
    }
    if (!definition.dataContract) {
      throw new EventValidationError(`Event type ${input.eventType} does not declare a data contract.`);
    }
    try {
      const registry = new ContractRegistry(data.contracts);
      const validation = registry.validate(definition.dataContract, input.payload ?? {}, "event-data");
      if (!validation.valid) {
        throw new EventValidationError(`Event data failed contract ${validation.contractId}@${validation.contractVersion} validation.`, validation.errors);
      }
    } catch (error) {
      if (error instanceof EventValidationError) throw error;
      if (error instanceof ContractRegistryError) throw new EventValidationError(error.message, error.details);
      throw error;
    }

    const inputWithLoop = input as unknown as { loopDefinitionId?: unknown };
    let activeLoopId = typeof inputWithLoop.loopDefinitionId === "string"
      ? inputWithLoop.loopDefinitionId
      : undefined;
    if (activeLoopId) {
      const loop = data.loopDefinitions.find((candidate) => candidate.active && candidate.id === activeLoopId);
      if (!loop) throw new EventValidationError(`Unknown or inactive loop definition: ${activeLoopId}`);
      if (!loop.entryEventTypes.includes(input.eventType)) {
        throw new EventValidationError(`Event type ${input.eventType} is not an entry event for loop ${activeLoopId}.`);
      }
    } else {
      const matchingLoops = data.loopDefinitions.filter((loop) => loop.active && loop.entryEventTypes.includes(input.eventType));
      if (matchingLoops.length > 1) {
        throw new EventValidationError(`Ambiguous loop selection for event type ${input.eventType}: ${matchingLoops.map((loop) => loop.id).join(", ")}`);
      }
      activeLoopId = matchingLoops[0]?.id;
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
      body: input.body,
      loopDefinitionId: activeLoopId
    }, this.runtimeDefinitions(data));
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

  listLoopInstances() {
    return this.db().listLoopInstances();
  }

  runtimeHealth() {
    return this.db().health();
  }

  runtimeDatabase(): RuntimeDatabase {
    return this.db();
  }

  runtimeDefinitions(data: AppData) {
    return {
      agents: data.agents,
      contracts: data.contracts,
      operations: data.operations,
      routingPolicies: data.policies,
      emissionPolicies: data.emissionPolicies,
      eventDefinitions: data.eventDefinitions,
      loopDefinitions: data.loopDefinitions
    };
  }

  async dryRunRoutingPolicy(policyId: string, event: Partial<EventRecord> & Pick<EventRecord, "eventType">) {
    const data = await this.read();
    const policy = data.policies.find((candidate) => candidate.id === policyId);
    if (!policy) throw new EventValidationError(`Routing policy not found: ${policyId}`);
    const registry = new ContractRegistry(data.contracts);
    const now = new Date().toISOString();
    return routeEventToOperations({
      event: {
        id: "dry-run-event",
        eventId: "dry-run-event",
        projectId: event.projectId ?? data.projects[0]?.id ?? "project",
        source: event.source ?? "dry-run",
        type: event.eventType,
        eventType: event.eventType,
        subject: event.subject ?? "dry-run",
        correlationId: event.correlationId ?? "dry-run-correlation",
        correlationDepth: event.correlationDepth ?? 0,
        occurredAt: now,
        tags: event.tags ?? [],
        payload: event.payload ?? {},
        data: event.payload ?? {},
        status: "received",
        createdAt: now
      },
      policies: [policy],
      operations: data.operations,
      agents: data.agents,
      contracts: registry
    });
  }

  async dryRunEmissionPolicy(policyId: string, input: { operationInput?: unknown; operationOutput?: unknown }) {
    const data = await this.read();
    const policy = data.emissionPolicies.find((candidate) => candidate.id === policyId);
    if (!policy) throw new EventValidationError(`Emission policy not found: ${policyId}`);
    const operation = data.operations.find((candidate) =>
      candidate.id === policy.observes.operation.id &&
      candidate.version === policy.observes.operation.version
    );
    if (!operation) throw new EventValidationError(`Observed operation not found for emission policy: ${policyId}`);
    const now = new Date().toISOString();
    return evaluateEmissionPolicies({
      projectRoot: this.root,
      operation,
      run: {
        runId: "dry-run",
        triggerEventId: "dry-run-event",
        policyId: "dry-run-routing-policy",
        policyVersion: 1,
        agentRole: operation.agentId,
        operationId: operation.id,
        operationVersion: operation.version,
        inputJson: input.operationInput as never,
        status: "running",
        attempt: 1,
        createdAt: now,
        updatedAt: now
      },
      trigger: {
        seq: 0,
        eventId: "dry-run-event",
        type: "dry-run.event",
        source: "dry-run",
        subject: "dry-run",
        correlationId: "dry-run-correlation",
        correlationDepth: 0,
        occurredAt: now,
        projectId: data.projects[0]?.id ?? "project",
        tags: [],
        payload: {},
        status: "received"
      },
      input: input.operationInput as never,
      output: input.operationOutput as never,
      policies: [policy],
      eventDefinitions: data.eventDefinitions,
      contracts: new ContractRegistry(data.contracts)
    });
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
