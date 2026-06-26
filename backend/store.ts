import type { AgentRunLog, AppData, CollectionName, EventDefinition, EventRecord, MarkdownDocument } from "./shared/domain.js";
import { ContractRegistry, ContractRegistryError } from "./shared/contracts.js";
import { getProjectRoot, safeSlug } from "./markdown.js";
import { loadMarkdownAppData, removeEntityMarkdown, writeEntityMarkdown, writeEntityMarkdownBatch, writeProjectMarkdownDocument } from "./markdown-adapter.js";
import { RuntimeDatabase, resolveRuntimeDbPath } from "./runtime-db.js";
import { notifyRuntimeChanged } from "./runtime-events.js";
import { routeEventToOperations } from "./routing-engine.js";
import { evaluateEmissionPolicies } from "./emission-engine.js";
import { projectFlows } from "./flow-projection.js";
import { flowComposer, type FlowCreateDraft, type FlowSettingsUpdateDraft } from "./flow-composer.js";
import { workspaceValidator, type WorkspaceReference } from "./workspace-validator.js";
import { TraceService } from "./trace-service.js";
import { stableJson } from "./shared/json.js";

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

const versionedCollections = new Set<CollectionName>([
  "contracts",
  "operations",
  "emissionPolicies",
  "loopDefinitions"
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

const referenceForCollection = (
  collection: CollectionName,
  target: Record<string, unknown> | undefined,
  id: string
): WorkspaceReference | undefined => {
  const version = typeof target?.version === "number" ? target.version : undefined;
  const label = typeof target?.name === "string" && target.name ? target.name : id;
  if (collection === "contracts") return { type: "contract", id, version, label };
  if (collection === "operations") return { type: "operation", id, version, label };
  if (collection === "policies") return { type: "routing-policy", id, label };
  if (collection === "emissionPolicies") return { type: "emission-policy", id, version, label };
  if (collection === "loopDefinitions") return { type: "loop", id, version, label };
  if (collection === "agents") return { type: "agent", id, label };
  if (collection === "runtimes") return { type: "runtime", id, label };
  if (collection === "skills") return { type: "skill", id, label };
  return undefined;
};

const findVersionedResource = <T extends { id: string; version: number }>(
  items: T[],
  id: string,
  version: number | undefined,
  label: string
): T | undefined => {
  const matches = items.filter((item) => item.id === id);
  if (version !== undefined) return matches.find((item) => item.version === version);
  if (matches.length > 1) throw new EventValidationError(`${label} ${id} has multiple versions. Specify version.`);
  return matches[0];
};

const emissionPolicyKey = (policy: AppData["emissionPolicies"][number]): string =>
  `${policy.id}@${policy.version}`;

const latestVersion = <T extends { version: number }>(items: T[]): T | undefined =>
  [...items].sort((left, right) => right.version - left.version)[0];

const selectEmissionPoliciesForFlowActivation = (
  data: AppData,
  flow: AppData["loopDefinitions"][number],
  active: boolean
): Set<string> => {
  const selected = new Set<string>();
  for (const policyId of flow.emissionPolicyIds) {
    const matchingPolicies = data.emissionPolicies.filter((policy) => policy.id === policyId);
    const activePolicies = matchingPolicies.filter((policy) => policy.active);
    const policiesToUpdate = active
      ? activePolicies.length === 0
        ? [latestVersion(matchingPolicies)].filter((policy): policy is AppData["emissionPolicies"][number] => Boolean(policy))
        : activePolicies
      : activePolicies;
    for (const policy of policiesToUpdate) selected.add(emissionPolicyKey(policy));
  }
  return selected;
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
    const itemRecord = item as Record<string, unknown>;
    const itemId = typeof itemRecord.id === "string" && itemRecord.id
      ? itemRecord.id
      : safeSlug(String(itemRecord.title ?? itemRecord.name ?? collection));
    const items = data[collection] as unknown as Array<Record<string, unknown>>;
    const requestedVersion = typeof itemRecord.version === "number"
      ? itemRecord.version as number
      : undefined;
    if (versionedCollections.has(collection) && requestedVersion === undefined && items.some((candidate) => candidate.id === itemId)) {
      throw new EventValidationError(`Saving ${collection} requires both id and version.`);
    }
    const existing = items.find((candidate) =>
      candidate.id === itemId &&
      (!versionedCollections.has(collection) || candidate.version === (requestedVersion ?? candidate.version))
    );
    const nextInput = {
      ...existing,
      ...itemRecord,
      id: itemId,
      ...(versionedCollections.has(collection) ? { version: requestedVersion ?? existing?.version ?? 1 } : {})
    } as Record<string, unknown>;
    this.validateImmutableVersionedChange(collection, existing, nextInput);
    this.validateReferencedDeactivation(collection, data, existing, nextInput, itemId);
    if (collection === "policies") this.validatePolicyInput(nextInput, data.eventDefinitions);
    const proposed = {
      ...data,
      [collection]: existing
        ? items.map((candidate) => candidate === existing ? nextInput : candidate)
        : [...items, nextInput]
    } as AppData;
    const validation = workspaceValidator.validate(proposed);
    if (!validation.valid) {
      throw new EventValidationError(`Cannot save ${collection} because the workspace would have validation errors.`, validation.diagnostics);
    }
    const saved = await writeEntityMarkdown(this.root, collection as MutableMarkdownCollection, nextInput);
    const refreshed = await this.read();
    return ((refreshed[collection] as unknown as Array<Record<string, unknown>>).find((candidate) =>
      candidate.id === saved.id &&
      (!versionedCollections.has(collection) || candidate.version === saved.version)
    ) ?? saved) as unknown as AppData[T][number];
  }

  async remove(collection: CollectionName, id: string, version?: number): Promise<void> {
    if (collection === "events") {
      this.db().deleteEvent(id);
      notifyRuntimeChanged("events");
      return;
    }

    const data = await this.read();
    if (versionedCollections.has(collection) && version === undefined) {
      throw new EventValidationError(`Deleting ${collection} requires both id and version.`);
    }
    const target = (data[collection] as unknown as Array<Record<string, unknown>>).find((item) =>
      item.id === id &&
      (!versionedCollections.has(collection) || item.version === version)
    );
    if (versionedCollections.has(collection) && !target) {
      throw new EventValidationError(`Resource not found: ${collection} ${id}@${version}.`);
    }
    const targetReference = referenceForCollection(collection, target, id);
    if (targetReference) {
      const safeDelete = workspaceValidator.safeDelete(data, targetReference);
      if (!safeDelete.allowed) {
        throw new EventValidationError(`Cannot delete ${id} because it is still referenced.`, safeDelete.diagnostics);
      }
    }
    const relativePath = typeof target?.relativePath === "string" ? target.relativePath : undefined;
    if (!relativePath) return;
    await removeEntityMarkdown(this.root, relativePath);
  }

  async saveEventDefinition(item: Partial<EventDefinition> & { id?: string }): Promise<EventDefinition> {
    const data = await this.read();
    const existing = data.eventDefinitions.find((candidate) => candidate.id === item.id);
    const nextInput = { ...existing, ...item } as Record<string, unknown>;
    if (existing) this.validateEventDefinitionChange(existing, nextInput, data.policies);
    const proposed = {
      ...data,
      eventDefinitions: existing
        ? data.eventDefinitions.map((candidate) => candidate === existing ? nextInput as unknown as EventDefinition : candidate)
        : [...data.eventDefinitions, nextInput as unknown as EventDefinition]
    };
    const validation = workspaceValidator.validate(proposed);
    if (!validation.valid) {
      throw new EventValidationError("Cannot save event definition because the workspace would have validation errors.", validation.diagnostics);
    }
    const saved = await writeEntityMarkdown(this.root, "eventDefinitions", nextInput);
    const refreshed = await this.read();
    return refreshed.eventDefinitions.find((candidate) => candidate.id === saved.id) ?? (saved as unknown as EventDefinition);
  }

  async removeEventDefinition(id: string): Promise<void> {
    const data = await this.read();
    const target = data.eventDefinitions.find((item) => item.id === id);
    if (!target?.relativePath) return;
    this.validateEventDefinitionRemoval(target, data.policies);
    const safeDelete = workspaceValidator.safeDelete(data, { type: "event", id: target.id, label: target.name });
    if (!safeDelete.allowed) {
      throw new EventValidationError(`Cannot delete ${id} because it is still referenced.`, safeDelete.diagnostics);
    }
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
    const workspaceValidation = workspaceValidator.validate(data);
    if (!workspaceValidation.valid) {
      throw new EventValidationError(
        "Cannot intake event because the workspace has validation errors.",
        workspaceValidation.diagnostics
      );
    }

    const inputWithLoop = input as unknown as { loopDefinitionId?: unknown; loopDefinitionVersion?: unknown };
    let activeLoopId = typeof inputWithLoop.loopDefinitionId === "string"
      ? inputWithLoop.loopDefinitionId
      : undefined;
    let activeLoopVersion = typeof inputWithLoop.loopDefinitionVersion === "number" && Number.isInteger(inputWithLoop.loopDefinitionVersion)
      ? inputWithLoop.loopDefinitionVersion
      : undefined;
    if (activeLoopId) {
      const matchingLoops = data.loopDefinitions.filter((candidate) =>
        candidate.active &&
        candidate.id === activeLoopId &&
        (activeLoopVersion === undefined || candidate.version === activeLoopVersion)
      );
      if (activeLoopVersion === undefined && matchingLoops.length > 1) {
        throw new EventValidationError(`Loop definition ${activeLoopId} has multiple active versions. Specify loopDefinitionVersion.`);
      }
      const loop = matchingLoops[0];
      if (!loop) throw new EventValidationError(`Unknown or inactive loop definition: ${activeLoopId}${activeLoopVersion === undefined ? "" : `@${activeLoopVersion}`}`);
      if (!loop.entryEventTypes.includes(input.eventType)) {
        throw new EventValidationError(`Event type ${input.eventType} is not an entry event for loop ${activeLoopId}@${loop.version}.`);
      }
      activeLoopVersion = loop.version;
    } else {
      const matchingLoops = data.loopDefinitions.filter((loop) => loop.active && loop.entryEventTypes.includes(input.eventType));
      if (matchingLoops.length > 1) {
        throw new EventValidationError(`Ambiguous loop selection for event type ${input.eventType}: ${matchingLoops.map((loop) => `${loop.id}@${loop.version}`).join(", ")}`);
      }
      activeLoopId = matchingLoops[0]?.id;
      activeLoopVersion = matchingLoops[0]?.version;
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
      loopDefinitionId: activeLoopId,
      loopDefinitionVersion: activeLoopVersion
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

  async listFlows() {
    return projectFlows(await this.read());
  }

  async getFlow(id: string, version?: number) {
    const flows = await this.listFlows();
    return findVersionedResource(flows, id, version, "Flow");
  }

  async validateFlowDraft(draft: FlowCreateDraft) {
    return flowComposer.compose(await this.read(), draft);
  }

  async saveFlowDraft(draft: FlowCreateDraft) {
    const data = await this.read();
    const result = flowComposer.compose(data, draft);
    if (!result.validation.valid) {
      throw new EventValidationError("Flow cannot be saved because the proposed workspace has validation errors.", result.validation.diagnostics);
    }
    await writeEntityMarkdownBatch(this.root, [
      ...result.resources.contracts.map((contract) => ({ collection: "contracts" as const, item: contract as unknown as Record<string, unknown> })),
      ...result.resources.eventDefinitions.map((eventDefinition) => ({ collection: "eventDefinitions" as const, item: eventDefinition as unknown as Record<string, unknown> })),
      ...result.resources.operations.map((operation) => ({ collection: "operations" as const, item: operation as unknown as Record<string, unknown> })),
      ...result.resources.routingPolicies.map((policy) => ({ collection: "policies" as const, item: policy as unknown as Record<string, unknown> })),
      ...result.resources.emissionPolicies.map((policy) => ({ collection: "emissionPolicies" as const, item: policy as unknown as Record<string, unknown> })),
      ...result.resources.loopDefinitions.map((loop) => ({ collection: "loopDefinitions" as const, item: loop as unknown as Record<string, unknown> }))
    ]);
    const saved = await this.getFlow(result.flow?.id ?? "", result.flow?.version);
    if (!saved) throw new EventValidationError("Flow was saved but could not be reloaded.");
    return saved;
  }

  async updateFlowSettings(id: string, draft: FlowSettingsUpdateDraft, version?: number) {
    const data = await this.read();
    const result = flowComposer.composeSettingsUpdate(data, id, draft, version);
    if (!result.validation.valid) {
      throw new EventValidationError("Flow settings cannot be saved because the proposed workspace has validation errors.", result.validation.diagnostics);
    }
    await writeEntityMarkdownBatch(this.root, [
      ...result.resources.contracts.map((contract) => ({ collection: "contracts" as const, item: contract as unknown as Record<string, unknown> })),
      ...result.resources.eventDefinitions.map((eventDefinition) => ({ collection: "eventDefinitions" as const, item: eventDefinition as unknown as Record<string, unknown> })),
      ...result.resources.loopDefinitions.map((loop) => ({ collection: "loopDefinitions" as const, item: loop as unknown as Record<string, unknown> }))
    ]);
    const saved = await this.getFlow(id, result.flow?.version ?? version);
    if (!saved) throw new EventValidationError("Flow settings changed but could not be reloaded.");
    return saved;
  }

  async setFlowActive(id: string, active: boolean, version?: number) {
    const data = await this.read();
    const flow = findVersionedResource(data.loopDefinitions, id, version, "Flow");
    if (!flow) throw new EventValidationError(`Flow not found: ${id}${version === undefined ? "" : `@${version}`}`);
    const next = { ...flow, active };
    const selectedEmissionPolicyKeys = selectEmissionPoliciesForFlowActivation(data, flow, active);
    const proposed = {
      ...data,
      policies: data.policies.map((policy) => flow.routingPolicyIds.includes(policy.id) ? { ...policy, active } : policy),
      emissionPolicies: data.emissionPolicies.map((policy) => selectedEmissionPolicyKeys.has(emissionPolicyKey(policy)) ? { ...policy, active } : policy),
      loopDefinitions: data.loopDefinitions.map((loop) => loop.id === id && loop.version === flow.version ? next : loop)
    };
    const validation = workspaceValidator.validate(proposed);
    if (active && !validation.valid) throw new EventValidationError("Flow cannot be activated because the workspace has validation errors.", validation.diagnostics);
    await writeEntityMarkdownBatch(this.root, [
      ...proposed.policies
        .filter((policy) => flow.routingPolicyIds.includes(policy.id))
        .map((policy) => ({ collection: "policies" as const, item: policy as unknown as Record<string, unknown> })),
      ...proposed.emissionPolicies
        .filter((policy) => selectedEmissionPolicyKeys.has(emissionPolicyKey(policy)))
        .map((policy) => ({ collection: "emissionPolicies" as const, item: policy as unknown as Record<string, unknown> })),
      { collection: "loopDefinitions" as const, item: next as unknown as Record<string, unknown> }
    ]);
    const saved = await this.getFlow(id, flow.version);
    if (!saved) throw new EventValidationError("Flow state changed but could not be reloaded.");
    return saved;
  }

  async testFlow(id: string, payload?: Record<string, unknown>, version?: number) {
    const data = await this.read();
    const flow = findVersionedResource(projectFlows(data), id, version, "Flow");
    if (!flow) throw new EventValidationError(`Flow not found: ${id}${version === undefined ? "" : `@${version}`}`);
    const loop = data.loopDefinitions.find((candidate) => candidate.id === flow.id && candidate.version === flow.version);
    if (!loop) throw new EventValidationError(`Flow backing loop not found: ${id}`);
    const simulation = flowComposer.previewFlowTest(data, loop, flow, payload);
    return {
      flowId: id,
      matched: simulation.matched,
      trace: simulation.trace,
      routing: simulation.operationInputs,
      simulation,
      diagnostics: flow.diagnostics
    };
  }

  async validateWorkspace() {
    return workspaceValidator.validate(await this.read());
  }

  async safeDelete(target: WorkspaceReference) {
    return workspaceValidator.safeDelete(await this.read(), target);
  }

  traceService(): TraceService {
    return new TraceService(this.db());
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

  private validateImmutableVersionedChange(collection: CollectionName, existing: Record<string, unknown> | undefined, next: Record<string, unknown>) {
    if (!existing || !versionedCollections.has(collection)) return;
    if (existing.id !== next.id || existing.version !== next.version) {
      throw new EventValidationError(`Existing ${collection} versions cannot be retargeted to another id or version.`);
    }
    if (collection === "contracts") {
      if (stableJson(existing.kind) !== stableJson(next.kind) || stableJson(existing.schema) !== stableJson(next.schema)) {
        throw new EventValidationError("Published data shape versions are immutable. Create the next version to change the schema.");
      }
      return;
    }
    if (collection === "operations") {
      const semanticFields = ["name", "description", "agentId", "instructions", "inputContract", "outputContract", "emissionRequired"];
      const changed = semanticFields.filter((field) => stableJson(existing[field]) !== stableJson(next[field]));
      if (changed.length > 0) {
        throw new EventValidationError(`Published task versions are immutable. Create the next version to change ${changed.join(", ")}.`);
      }
    }
  }

  private validateReferencedDeactivation(
    collection: CollectionName,
    data: AppData,
    existing: Record<string, unknown> | undefined,
    next: Record<string, unknown>,
    id: string
  ) {
    if (!existing) return;
    const turnsOffActiveResource = existing.active !== false && next.active === false;
    const turnsOffAgent = collection === "agents" && existing.enabled !== false && next.enabled === false;
    if (!turnsOffActiveResource && !turnsOffAgent) return;

    const target = referenceForCollection(collection, existing, id);
    if (!target) return;
    const safeDelete = workspaceValidator.safeDelete(data, target);
    if (!safeDelete.allowed) {
      throw new EventValidationError(`Cannot deactivate ${id} because it is still referenced.`, safeDelete.diagnostics);
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
