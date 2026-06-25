import path from "node:path";
import { stat, unlink } from "node:fs/promises";
import type { Adr, AdrStatus, Agent, AgentOutcomeStatus, AgentStatus, AppData, EntityStatus, EventDefinition, EventProducerDefinition, Goal, MarkdownDocument, Policy, Project, Runtime, Skill } from "./shared/domain.js";
import type { ContractDefinition, ContractKind } from "./shared/contracts.js";
import type { EmissionPolicy } from "./shared/emission-policy.js";
import type { LoopDefinition } from "./shared/loop.js";
import type { AgentOperation } from "./shared/operations.js";
import type { RoutingPolicy } from "./shared/routing-policy.js";
import type { MappingExpression } from "./shared/mapping.js";
import type { VersionedRef } from "./shared/json.js";
import { assertInsideRoot, loadAdr, loadAgents, loadBalletProject, loadBalletProjectTree, loadContracts, loadEmissionPolicies, loadEvents, loadGoals, loadLoopDefinitions, loadOperations, loadPolicies, loadRuntimes, loadSkills, readMarkdownDocument, safeSlug, writeMarkdownDocument, writeTomlDocument } from "./markdown.js";

const now = () => new Date().toISOString();

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const stringValue = (value: unknown, fallback = ""): string => typeof value === "string" ? value : value === undefined || value === null ? fallback : String(value);
const booleanValue = (value: unknown, fallback = false): boolean => typeof value === "boolean" ? value : typeof value === "string" ? value.toLowerCase() === "true" : fallback;
const stringArray = (value: unknown): string[] => Array.isArray(value) ? value.map((item) => stringValue(item)).filter(Boolean) : typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
const cloneRecord = (value: unknown): Record<string, unknown> | undefined => isRecord(value) ? JSON.parse(JSON.stringify(value)) as Record<string, unknown> : undefined;
const numberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};
const recordValue = (value: unknown): Record<string, unknown> => cloneRecord(value) ?? {};
const arrayValue = <T = unknown>(value: unknown): T[] => Array.isArray(value) ? JSON.parse(JSON.stringify(value)) as T[] : [];

const validEntityStatus = (value: unknown): EntityStatus => ["active", "paused", "archived"].includes(stringValue(value)) ? stringValue(value) as EntityStatus : "active";
const validGoalStatus = (value: unknown): Goal["status"] => ["not-started", "in-progress", "at-risk", "done"].includes(stringValue(value)) ? stringValue(value) as Goal["status"] : "not-started";
const validAdrStatus = (value: unknown): AdrStatus => ["proposed", "accepted", "superseded", "rejected"].includes(stringValue(value)) ? stringValue(value) as AdrStatus : "proposed";
const validAgentStatus = (value: unknown): AgentStatus => ["online", "offline"].includes(stringValue(value)) ? stringValue(value) as AgentStatus : "offline";
const validAgentOutcomeStatus = (value: unknown): AgentOutcomeStatus | undefined =>
  ["ready", "blocked", "needs_input", "approved", "changes_requested", "failed"].includes(stringValue(value))
    ? stringValue(value) as AgentOutcomeStatus
    : undefined;
const dateValue = (value: unknown): string => stringValue(value, now());

const bodyPreview = (body: string): string => body.replace(/^#+\s+/gm, "").split(/\n{2,}/)[0]?.trim() ?? "";

const metadataFromDocument = (doc: MarkdownDocument): Record<string, unknown> =>
  isRecord(doc.frontmatter.metadata) ? doc.frontmatter.metadata : {};

const metadataFromItem = (item: Record<string, unknown>): Record<string, unknown> =>
  isRecord(item.frontmatter) && isRecord(item.frontmatter.metadata) ? item.frontmatter.metadata : {};

const specFromDocument = (doc: MarkdownDocument): Record<string, unknown> =>
  isRecord(doc.frontmatter.spec) ? doc.frontmatter.spec : doc.frontmatter;

const documentId = (doc: MarkdownDocument): string => stringValue(metadataFromDocument(doc).id ?? doc.frontmatter.id, doc.id);

const documentVersion = (doc: MarkdownDocument, fallback = 1): number =>
  numberValue(metadataFromDocument(doc).version ?? doc.frontmatter.version ?? specFromDocument(doc).version, fallback);

const versionedRef = (value: unknown, fallbackId = "", fallbackVersion = 1): VersionedRef => {
  const record = isRecord(value) ? value : {};
  return {
    id: stringValue(record.id, fallbackId),
    version: numberValue(record.version, fallbackVersion)
  };
};

const mappingExpression = (value: unknown, fallback: MappingExpression = { object: {} }): MappingExpression =>
  (isRecord(value) ? JSON.parse(JSON.stringify(value)) : fallback) as MappingExpression;

const attachDocument = <T extends object>(entity: T, doc: MarkdownDocument): T => ({
  ...entity,
  frontmatter: doc.frontmatter,
  body: doc.body,
  relativePath: doc.relativePath,
  slug: doc.slug,
  errors: doc.errors
});

const projectFromDocument = (doc: MarkdownDocument): Project => {
  const fm = doc.frontmatter;
  return attachDocument({
    id: doc.id,
    name: stringValue(fm.name, stringValue(fm.title, doc.title ?? doc.slug)),
    description: doc.body.trim(),
    status: validEntityStatus(fm.status),
    createdAt: dateValue(fm.createdAt),
    updatedAt: dateValue(fm.updatedAt ?? fm.createdAt)
  }, doc);
};

const goalFromDocument = (doc: MarkdownDocument, defaultProjectId: string): Goal => {
  const fm = doc.frontmatter;
  return attachDocument({
    id: doc.id,
    projectId: stringValue(fm.projectId, defaultProjectId),
    title: stringValue(fm.title, doc.title ?? doc.slug),
    description: stringValue(fm.description, bodyPreview(doc.body)),
    status: validGoalStatus(fm.status),
    targetDate: stringValue(fm.targetDate ?? fm.dueDate),
    owner: stringValue(fm.owner),
    createdAt: dateValue(fm.createdAt),
    updatedAt: dateValue(fm.updatedAt ?? fm.createdAt)
  }, doc);
};

const adrFromDocument = (doc: MarkdownDocument, defaultProjectId: string): Adr => {
  const fm = doc.frontmatter;
  return attachDocument({
    id: doc.id,
    projectId: stringValue(fm.projectId, defaultProjectId),
    title: stringValue(fm.title, doc.title ?? doc.slug),
    context: stringValue(fm.context, doc.body),
    decision: stringValue(fm.decision),
    consequences: stringValue(fm.consequences),
    status: validAdrStatus(fm.status),
    createdAt: dateValue(fm.createdAt),
    updatedAt: dateValue(fm.updatedAt ?? fm.createdAt)
  }, doc);
};

const skillFromUnknown = (value: unknown, index: number): Skill => {
  if (isRecord(value)) {
    const name = stringValue(value.name ?? value.id, `skill-${index + 1}`);
    const metadata = Object.fromEntries(Object.entries(value).filter(([key]) => !["id", "name", "description", "enabled"].includes(key)).map(([key, item]) => [key, stringValue(item)]));
    return {
      id: stringValue(value.id, safeSlug(name)),
      name,
      description: stringValue(value.description),
      metadata,
      enabled: booleanValue(value.enabled, true)
    };
  }
  const name = stringValue(value, `skill-${index + 1}`);
  return { id: safeSlug(name), name, description: "", metadata: {}, enabled: true };
};

const normalizeSkillConfigPath = (value: string): string => {
  const trimmed = value.trim().replaceAll("\\", "/").replace(/\/SKILL\.md$/i, "");
  const segments = trimmed.split("/").filter(Boolean);
  const agentsSkillsIndex = segments.findIndex((segment, index) => segment === ".agents" && segments[index + 1] === "skills");
  if (agentsSkillsIndex >= 0) return segments.slice(agentsSkillsIndex).join("/");
  return path.posix.normalize(trimmed).replace(/^\.\//, "");
};

const skillLookupKeys = (skill: Skill): string[] => {
  const keys = [skill.id, skill.slug].filter(Boolean) as string[];
  if (skill.relativePath) {
    const normalized = normalizeSkillConfigPath(skill.relativePath);
    keys.push(normalized, normalized.replace(/\/SKILL\.md$/i, ""), path.posix.basename(normalized.replace(/\/SKILL\.md$/i, "")));
  }
  return [...new Set(keys)];
};

const buildSkillLookup = (skills: Skill[]): Map<string, Skill> => {
  const lookup = new Map<string, Skill>();
  for (const skill of skills) {
    for (const key of skillLookupKeys(skill)) {
      lookup.set(key, skill);
    }
  }
  return lookup;
};

const skillFromConfig = (value: unknown, index: number, skillLookup: Map<string, Skill>): Skill | undefined => {
  if (!isRecord(value)) return undefined;
  const rawPath = stringValue(value.path).trim();
  if (!rawPath) return undefined;

  const normalizedPath = normalizeSkillConfigPath(rawPath);
  const name = path.posix.basename(normalizedPath) || `skill-${index + 1}`;
  const enabled = booleanValue(value.enabled, true);
  const matchedSkill = skillLookup.get(normalizedPath) ?? skillLookup.get(name) ?? skillLookup.get(safeSlug(name));
  const metadata = { ...(matchedSkill?.metadata ?? {}), path: rawPath };

  return matchedSkill
    ? { ...matchedSkill, metadata, enabled }
    : {
      id: safeSlug(name),
      name,
      description: "",
      metadata,
      enabled
    };
};

const agentSkillsFromFrontmatter = (fm: Record<string, unknown>, skillLookup: Map<string, Skill>): Skill[] => {
  if (Array.isArray(fm.skills)) return fm.skills.map(skillFromUnknown);

  if (isRecord(fm.skills) && Array.isArray(fm.skills.config)) {
    return fm.skills.config
      .map((skill, index) => skillFromConfig(skill, index, skillLookup))
      .filter((skill): skill is Skill => Boolean(skill));
  }

  return [];
};

const agentFromDocument = (doc: MarkdownDocument, skillLookup: Map<string, Skill>): Agent => {
  const fm = doc.frontmatter;
  return attachDocument({
    id: doc.id,
    name: stringValue(fm.name, stringValue(fm.title, doc.title ?? doc.slug)),
    description: stringValue(fm.description, bodyPreview(doc.body)),
    instructions: stringValue(fm.developer_instructions ?? fm.instructions, doc.body),
    skills: agentSkillsFromFrontmatter(fm, skillLookup),
    enabled: booleanValue(fm.enabled, true),
    status: validAgentStatus(fm.status),
    createdAt: dateValue(fm.createdAt),
    updatedAt: dateValue(fm.updatedAt ?? fm.createdAt),
    model: stringValue(fm.model) || undefined,
    modelReasoningEffort: stringValue(fm.model_reasoning_effort) || undefined,
    nicknameCandidates: stringArray(fm.nickname_candidates)
  }, doc);
};

const skillDocumentFromDocument = (doc: MarkdownDocument): Skill => {
  const fm = doc.frontmatter;
  return attachDocument({
    id: doc.id,
    name: stringValue(fm.name, doc.title ?? doc.slug),
    description: stringValue(fm.description, bodyPreview(doc.body)),
    metadata: Object.fromEntries(Object.entries(fm).filter(([key]) => !["id", "name", "description"].includes(key)).map(([key, value]) => [key, stringValue(value)]))
  }, doc);
};

const runtimeFromDocument = (doc: MarkdownDocument): Runtime => {
  const fm = doc.frontmatter;
  const config = isRecord(fm.config)
    ? Object.fromEntries(Object.entries(fm.config).map(([key, value]) => [key, stringValue(value)]))
    : {};
  const type = stringValue(fm.type) === "custom" ? "custom" : "codex-cli";
  return attachDocument({
    id: doc.id,
    name: stringValue(fm.name, doc.title ?? doc.slug),
    type,
    command: stringValue(fm.command),
    config,
    enabled: booleanValue(fm.enabled, true),
    createdAt: dateValue(fm.createdAt),
    updatedAt: dateValue(fm.updatedAt ?? fm.createdAt)
  }, doc);
};

const validContractKind = (value: unknown): ContractKind =>
  ["event-data", "agent-input", "agent-output"].includes(stringValue(value))
    ? stringValue(value) as ContractKind
    : "event-data";

const contractFromDocument = (doc: MarkdownDocument): ContractDefinition => {
  const spec = specFromDocument(doc);
  return attachDocument({
    id: documentId(doc),
    version: documentVersion(doc),
    name: stringValue(spec.name ?? metadataFromDocument(doc).name ?? doc.title, doc.slug),
    description: stringValue(spec.description ?? doc.frontmatter.description, bodyPreview(doc.body)),
    kind: validContractKind(spec.kind),
    active: booleanValue(spec.active, true),
    schema: recordValue(spec.schema),
    examples: arrayValue(spec.examples),
    createdAt: dateValue(spec.createdAt ?? doc.frontmatter.createdAt),
    updatedAt: dateValue(spec.updatedAt ?? doc.frontmatter.updatedAt ?? doc.frontmatter.createdAt)
  }, doc);
};

const operationFromDocument = (doc: MarkdownDocument): AgentOperation => {
  const spec = specFromDocument(doc);
  return attachDocument({
    id: documentId(doc),
    version: documentVersion(doc),
    name: stringValue(spec.name ?? metadataFromDocument(doc).name ?? doc.title, doc.slug),
    description: stringValue(spec.description ?? doc.frontmatter.description, bodyPreview(doc.body)),
    active: booleanValue(spec.active, true),
    agentId: stringValue(spec.agentId),
    instructions: stringValue(spec.instructions, doc.body),
    inputContract: versionedRef(spec.inputContract),
    outputContract: versionedRef(spec.outputContract),
    emissionRequired: booleanValue(spec.emissionRequired, false),
    createdAt: dateValue(spec.createdAt ?? doc.frontmatter.createdAt),
    updatedAt: dateValue(spec.updatedAt ?? doc.frontmatter.updatedAt ?? doc.frontmatter.createdAt)
  }, doc);
};

const legacyOperationForPolicy = (doc: MarkdownDocument): VersionedRef => {
  const fm = doc.frontmatter;
  const action = cloneRecord(fm.action) as Policy["action"] | undefined;
  const targetAgentId = action?.type === "start_agent_run" && action.targetAgentId
    ? action.targetAgentId
    : stringValue(fm.targetAgentId ?? fm.agentId);
  return { id: targetAgentId, version: 1 };
};

const routingPolicyFromDocument = (doc: MarkdownDocument): RoutingPolicy => {
  const fm = doc.frontmatter;
  const spec = specFromDocument(doc);
  const legacyMatch = cloneRecord(fm.match);
  const consumes = isRecord(spec.consumes)
    ? { eventType: stringValue(spec.consumes.eventType) }
    : { eventType: stringArray(legacyMatch?.eventTypes ?? fm.eventTypes ?? fm.eventType)[0] ?? "" };
  const dispatch = isRecord(spec.dispatch) && isRecord(spec.dispatch.operation)
    ? { operation: versionedRef(spec.dispatch.operation) }
    : { operation: legacyOperationForPolicy(doc) };
  return attachDocument({
    id: documentId(doc),
    name: stringValue(spec.name ?? metadataFromDocument(doc).name ?? fm.name, doc.title ?? doc.slug),
    description: stringValue(spec.description ?? fm.description, bodyPreview(doc.body)),
    active: booleanValue(spec.active, true),
    consumes,
    when: cloneRecord(spec.when) as RoutingPolicy["when"],
    dispatch,
    input: mappingExpression(spec.input, { object: {} }),
    priority: spec.priority === undefined ? undefined : numberValue(spec.priority),
    selection: isRecord(spec.selection) ? {
      mode: spec.selection.mode === "exclusive" ? "exclusive" : "fanout",
      group: stringValue(spec.selection.group) || undefined
    } : undefined,
    onInvalidInput: spec.onInvalidInput === "reject-event" ? "reject-event" : "skip",
    createdAt: dateValue(spec.createdAt ?? fm.createdAt),
    updatedAt: dateValue(spec.updatedAt ?? fm.updatedAt ?? fm.createdAt)
  }, doc);
};

const producerFromUnknown = (value: unknown): EventProducerDefinition | undefined => {
  if (!isRecord(value)) return undefined;
  const agentRole = stringValue(value.agentRole ?? value.agent_role);
  if (!agentRole) return undefined;
  const outcomes = stringArray(value.outcomes ?? value.outcome)
    .map(validAgentOutcomeStatus)
    .filter((outcome): outcome is AgentOutcomeStatus => Boolean(outcome));
  if (outcomes.length === 0) return undefined;

  return {
    agentRole,
    outcomes,
    requires: isRecord(value.requires) ? {
      ...(value.requires.gitCommitExists !== undefined ? { gitCommitExists: booleanValue(value.requires.gitCommitExists) } : {}),
      ...(value.requires.requiredChecksPassed !== undefined ? { requiredChecksPassed: booleanValue(value.requires.requiredChecksPassed) } : {})
    } : undefined
  };
};

const producersFromUnknown = (value: unknown): EventProducerDefinition[] =>
  Array.isArray(value)
    ? value.map(producerFromUnknown).filter((producer): producer is EventProducerDefinition => Boolean(producer))
    : [];

const eventDefinitionFromDocument = (doc: MarkdownDocument): EventDefinition => {
  const fm = doc.frontmatter;
  const spec = specFromDocument(doc);
  return attachDocument({
    id: documentId(doc),
    name: stringValue(spec.name ?? metadataFromDocument(doc).name ?? fm.name, stringValue(fm.title, doc.title ?? doc.slug)),
    description: stringValue(spec.description ?? fm.description, bodyPreview(doc.body)),
    active: booleanValue(spec.active, true),
    eventType: stringValue(spec.eventType ?? fm.eventType ?? fm.type, doc.slug),
    source: stringValue(spec.source ?? fm.source) || undefined,
    tags: stringArray(spec.tags ?? fm.tags),
    dataContract: isRecord(spec.dataContract) ? versionedRef(spec.dataContract) : undefined,
    examples: arrayValue<Record<string, unknown>>(spec.examples ?? fm.examples ?? (isRecord(fm.payloadExample) ? [fm.payloadExample] : [])),
    producers: producersFromUnknown(fm.producers),
    payloadExample: isRecord(fm.payloadExample) ? fm.payloadExample : isRecord(fm.payload) ? fm.payload : undefined,
    createdAt: dateValue(spec.createdAt ?? fm.createdAt),
    updatedAt: dateValue(spec.updatedAt ?? fm.updatedAt ?? fm.createdAt)
  }, doc);
};

const emissionPolicyFromDocument = (doc: MarkdownDocument): EmissionPolicy => {
  const spec = specFromDocument(doc);
  return attachDocument({
    id: documentId(doc),
    version: documentVersion(doc),
    name: stringValue(spec.name ?? metadataFromDocument(doc).name ?? doc.title, doc.slug),
    description: stringValue(spec.description ?? doc.frontmatter.description, bodyPreview(doc.body)),
    active: booleanValue(spec.active, true),
    observes: {
      operation: versionedRef(isRecord(spec.observes) ? spec.observes.operation : undefined)
    },
    when: cloneRecord(spec.when) as EmissionPolicy["when"],
    gates: arrayValue(spec.gates) as EmissionPolicy["gates"],
    emissions: arrayValue(spec.emissions) as EmissionPolicy["emissions"],
    onGateFailure: spec.onGateFailure === "fail_run" ? "fail_run" : "skip",
    priority: spec.priority === undefined ? undefined : numberValue(spec.priority),
    createdAt: dateValue(spec.createdAt ?? doc.frontmatter.createdAt),
    updatedAt: dateValue(spec.updatedAt ?? doc.frontmatter.updatedAt ?? doc.frontmatter.createdAt)
  }, doc);
};

const loopDefinitionFromDocument = (doc: MarkdownDocument): LoopDefinition => {
  const spec = specFromDocument(doc);
  const limits = isRecord(spec.limits) ? spec.limits : {};
  return attachDocument({
    id: documentId(doc),
    version: documentVersion(doc),
    name: stringValue(spec.name ?? metadataFromDocument(doc).name ?? doc.title, doc.slug),
    description: stringValue(spec.description ?? doc.frontmatter.description, bodyPreview(doc.body)),
    active: booleanValue(spec.active, true),
    entryEventTypes: stringArray(spec.entryEventTypes),
    terminalEventTypes: stringArray(spec.terminalEventTypes),
    routingPolicyIds: stringArray(spec.routingPolicyIds),
    emissionPolicyIds: stringArray(spec.emissionPolicyIds),
    limits: {
      maxHops: numberValue(limits.maxHops, 20),
      maxRuns: numberValue(limits.maxRuns, 50),
      maxIterationsPerStep: numberValue(limits.maxIterationsPerStep, 5),
      deadlineSeconds: limits.deadlineSeconds === undefined ? undefined : numberValue(limits.deadlineSeconds)
    },
    onLimitExceeded: isRecord(spec.onLimitExceeded) ? { eventType: stringValue(spec.onLimitExceeded.eventType) || undefined } : undefined,
    createdAt: dateValue(spec.createdAt ?? doc.frontmatter.createdAt),
    updatedAt: dateValue(spec.updatedAt ?? doc.frontmatter.updatedAt ?? doc.frontmatter.createdAt)
  }, doc);
};

export const loadMarkdownAppData = async (root: string): Promise<AppData> => {
  const [
    projectDocs,
    projectDocumentTree,
    agentDocs,
    skillDocs,
    adrDocs,
    goalDocs,
    runtimeDocs,
    contractDocs,
    operationDocs,
    eventDocs,
    policyDocs,
    emissionPolicyDocs,
    loopDefinitionDocs
  ] = await Promise.all([
    loadBalletProject(root),
    loadBalletProjectTree(root),
    loadAgents(root),
    loadSkills(root),
    loadAdr(root),
    loadGoals(root),
    loadRuntimes(root),
    loadContracts(root),
    loadOperations(root),
    loadEvents(root),
    loadPolicies(root),
    loadEmissionPolicies(root),
    loadLoopDefinitions(root)
  ]);

  const projects = projectDocs.map(projectFromDocument);
  const defaultProjectId = projects[0]?.id ?? "project";
  const skills = skillDocs.map(skillDocumentFromDocument);
  const skillLookup = buildSkillLookup(skills);
  const agents = agentDocs.map((doc) => agentFromDocument(doc, skillLookup));

  return {
    projectRoot: root,
    projects,
    goals: goalDocs.map((doc) => goalFromDocument(doc, defaultProjectId)),
    adrs: adrDocs.map((doc) => adrFromDocument(doc, defaultProjectId)),
    agents,
    skills,
    runtimes: runtimeDocs.map(runtimeFromDocument),
    contracts: contractDocs.map(contractFromDocument),
    operations: operationDocs.map(operationFromDocument),
    policies: policyDocs.map(routingPolicyFromDocument),
    emissionPolicies: emissionPolicyDocs.map(emissionPolicyFromDocument),
    loopDefinitions: loopDefinitionDocs.map(loopDefinitionFromDocument),
    eventDefinitions: eventDocs.map(eventDefinitionFromDocument),
    events: [],
    agentRuns: [],
    loopInstances: [],
    projectDocumentTree,
    documents: {
      project: projectDocs,
      agents: agentDocs,
      skills: skillDocs,
      runtimes: runtimeDocs,
      contracts: contractDocs,
      operations: operationDocs,
      adr: adrDocs,
      goals: goalDocs,
      events: eventDocs,
      policies: policyDocs,
      emissionPolicies: emissionPolicyDocs,
      loopDefinitions: loopDefinitionDocs
    }
  };
};

const collectionFolder: Record<string, string> = {
  projects: ".ballet",
  goals: ".ballet/goals",
  adrs: ".ballet/adr",
  agents: ".codex/agents",
  skills: ".agents/skills",
  runtimes: ".ballet/runtimes",
  contracts: ".ballet/contracts",
  operations: ".ballet/operations",
  policies: ".ballet/policies",
  emissionPolicies: ".ballet/emissions",
  loopDefinitions: ".ballet/loops",
  eventDefinitions: ".ballet/events"
};

const collectionName: Record<string, string> = {
  projects: "project",
  goals: "goals",
  adrs: "adr",
  agents: "agents",
  skills: "skills",
  runtimes: "runtimes",
  contracts: "contracts",
  operations: "operations",
  policies: "policies",
  emissionPolicies: "emissions",
  loopDefinitions: "loops",
  eventDefinitions: "events"
};

const entityBody = (item: Record<string, unknown>): string => stringValue(item.body);
const projectBody = (item: Record<string, unknown>): string => stringValue(item.description, stringValue(item.body));

const entityFrontmatter = (item: Record<string, unknown>, id: string): Record<string, unknown> => {
  const base = isRecord(item.frontmatter) ? { ...item.frontmatter } : {};
  const updatedAt = now();
  return {
    ...base,
    ...Object.fromEntries(Object.entries(item).filter(([key]) => !["frontmatter", "body", "relativePath", "slug", "errors", "createdAt", "updatedAt"].includes(key))),
    id,
    createdAt: item.createdAt ?? base.createdAt ?? updatedAt,
    updatedAt
  };
};

const projectFrontmatter = (item: Record<string, unknown>, id: string): Record<string, unknown> => {
  const frontmatter = entityFrontmatter(item, id);
  delete frontmatter.key;
  delete frontmatter.title;
  delete frontmatter.description;
  return frontmatter;
};

const agentFrontmatter = (item: Record<string, unknown>): Record<string, unknown> => {
  const base = isRecord(item.frontmatter) ? { ...item.frontmatter } : {};
  const model = stringValue(item.model ?? base.model);
  const modelReasoningEffort = stringValue(item.model_reasoning_effort ?? item.modelReasoningEffort ?? base.model_reasoning_effort);
  const status = validAgentStatus(item.status ?? base.status);
  const nicknameCandidates = Array.isArray(item.nickname_candidates)
    ? stringArray(item.nickname_candidates)
    : Array.isArray(item.nicknameCandidates)
      ? stringArray(item.nicknameCandidates)
      : stringArray(base.nickname_candidates);

  const next: Record<string, unknown> = {
    ...base,
    name: stringValue(item.name ?? base.name),
    status,
    description: stringValue(item.description ?? base.description),
    developer_instructions: stringValue(item.developer_instructions ?? item.instructions ?? base.developer_instructions)
  };

  if (model) next.model = model;
  else delete next.model;
  if (modelReasoningEffort) next.model_reasoning_effort = modelReasoningEffort;
  else delete next.model_reasoning_effort;
  if (nicknameCandidates.length > 0) next.nickname_candidates = nicknameCandidates;
  else delete next.nickname_candidates;

  return next;
};

const skillFrontmatter = (item: Record<string, unknown>): Record<string, unknown> => {
  const base = isRecord(item.frontmatter) ? { ...item.frontmatter } : {};
  return {
    ...base,
    name: stringValue(item.name ?? base.name),
    description: stringValue(item.description ?? base.description)
  };
};

const metadataSpecFrontmatter = (
  item: Record<string, unknown>,
  id: string,
  kind: string,
  spec: Record<string, unknown>,
  version?: number
): Record<string, unknown> => {
  const base = isRecord(item.frontmatter) ? { ...item.frontmatter } : {};
  const baseMetadata = isRecord(base.metadata) ? base.metadata : {};
  const updatedAt = now();
  return {
    apiVersion: stringValue(base.apiVersion, "ballet.dev/v1"),
    kind,
    metadata: {
      ...baseMetadata,
      id,
      ...(version !== undefined ? { version } : {}),
      ...(item.createdAt ?? base.createdAt ? { createdAt: item.createdAt ?? base.createdAt } : { createdAt: updatedAt }),
      updatedAt
    },
    spec
  };
};

const contractFrontmatter = (item: Record<string, unknown>, id: string): Record<string, unknown> => {
  const version = numberValue(item.version ?? metadataFromItem(item).version, 1);
  return metadataSpecFrontmatter(item, id, "ContractDefinition", {
    name: stringValue(item.name),
    description: stringValue(item.description),
    kind: stringValue(item.kind, "event-data"),
    active: booleanValue(item.active, true),
    schema: recordValue(item.schema),
    examples: arrayValue(item.examples)
  }, version);
};

const operationFrontmatter = (item: Record<string, unknown>, id: string): Record<string, unknown> => {
  const version = numberValue(item.version ?? metadataFromItem(item).version, 1);
  return metadataSpecFrontmatter(item, id, "AgentOperation", {
    name: stringValue(item.name),
    description: stringValue(item.description),
    active: booleanValue(item.active, true),
    agentId: stringValue(item.agentId),
    instructions: stringValue(item.instructions),
    inputContract: recordValue(item.inputContract),
    outputContract: recordValue(item.outputContract),
    emissionRequired: booleanValue(item.emissionRequired, false)
  }, version);
};

const routingPolicyFrontmatter = (item: Record<string, unknown>, id: string): Record<string, unknown> =>
  metadataSpecFrontmatter(item, id, "RoutingPolicy", {
    name: stringValue(item.name),
    description: stringValue(item.description),
    active: booleanValue(item.active, true),
    consumes: recordValue(item.consumes),
    ...(item.when !== undefined ? { when: item.when } : {}),
    dispatch: recordValue(item.dispatch),
    input: item.input ?? { object: {} },
    ...(item.priority !== undefined ? { priority: item.priority } : {}),
    ...(item.selection !== undefined ? { selection: item.selection } : {}),
    onInvalidInput: stringValue(item.onInvalidInput, "skip")
  });

const eventDefinitionFrontmatter = (item: Record<string, unknown>, id: string): Record<string, unknown> =>
  metadataSpecFrontmatter(item, id, "EventDefinition", {
    name: stringValue(item.name),
    description: stringValue(item.description),
    active: booleanValue(item.active, true),
    eventType: stringValue(item.eventType),
    ...(item.source !== undefined ? { source: item.source } : {}),
    tags: stringArray(item.tags),
    dataContract: recordValue(item.dataContract),
    examples: arrayValue(item.examples)
  });

const emissionPolicyFrontmatter = (item: Record<string, unknown>, id: string): Record<string, unknown> => {
  const version = numberValue(item.version ?? metadataFromItem(item).version, 1);
  return metadataSpecFrontmatter(item, id, "EmissionPolicy", {
    name: stringValue(item.name),
    description: stringValue(item.description),
    active: booleanValue(item.active, true),
    observes: recordValue(item.observes),
    ...(item.when !== undefined ? { when: item.when } : {}),
    gates: arrayValue(item.gates),
    emissions: arrayValue(item.emissions),
    onGateFailure: stringValue(item.onGateFailure, "skip"),
    ...(item.priority !== undefined ? { priority: item.priority } : {})
  }, version);
};

const loopDefinitionFrontmatter = (item: Record<string, unknown>, id: string): Record<string, unknown> => {
  const version = numberValue(item.version ?? metadataFromItem(item).version, 1);
  return metadataSpecFrontmatter(item, id, "LoopDefinition", {
    name: stringValue(item.name),
    description: stringValue(item.description),
    active: booleanValue(item.active, true),
    entryEventTypes: stringArray(item.entryEventTypes),
    terminalEventTypes: stringArray(item.terminalEventTypes),
    routingPolicyIds: stringArray(item.routingPolicyIds),
    emissionPolicyIds: stringArray(item.emissionPolicyIds),
    limits: recordValue(item.limits),
    ...(item.onLimitExceeded !== undefined ? { onLimitExceeded: item.onLimitExceeded } : {})
  }, version);
};

export const writeEntityMarkdown = async (root: string, collection: keyof typeof collectionFolder, item: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const id = stringValue(item.id, safeSlug(stringValue(item.title ?? item.name, collectionName[collection])));
  const existingPath = stringValue(item.relativePath);
  const markdownFilename = `${safeSlug(id)}.md`;
  const relativePath = collection === "projects"
    ? ".ballet/project.md"
    : collection === "agents"
      ? existingPath || path.posix.join(collectionFolder[collection], `${safeSlug(stringValue(item.name, id))}.toml`)
      : collection === "skills"
        ? existingPath || path.posix.join(collectionFolder[collection], safeSlug(stringValue(item.name, id)), "SKILL.md")
        : existingPath || path.posix.join(collectionFolder[collection], markdownFilename);
  const frontmatter = collection === "projects"
    ? projectFrontmatter(item, id)
    : collection === "agents"
      ? agentFrontmatter(item)
      : collection === "skills"
        ? skillFrontmatter(item)
        : collection === "contracts"
          ? contractFrontmatter(item, id)
          : collection === "operations"
            ? operationFrontmatter(item, id)
        : collection === "policies"
          ? routingPolicyFrontmatter(item, id)
          : collection === "eventDefinitions"
            ? eventDefinitionFrontmatter(item, id)
            : collection === "emissionPolicies"
              ? emissionPolicyFrontmatter(item, id)
              : collection === "loopDefinitions"
                ? loopDefinitionFrontmatter(item, id)
                : entityFrontmatter(item, id);
  const body = collection === "projects" ? projectBody(item) : entityBody(item);
  if (collection === "agents") {
    await writeTomlDocument({ root, relativePath, frontmatter });
  } else {
    await writeMarkdownDocument({ root, relativePath, frontmatter, body });
  }
  return { ...item, id, frontmatter, relativePath, slug: safeSlug(path.basename(relativePath, path.extname(relativePath))) };
};

export const removeEntityMarkdown = async (root: string, relativePath: string): Promise<void> => {
  const absolutePath = assertInsideRoot(root, relativePath);
  await unlink(absolutePath);
};

export const writeProjectMarkdownDocument = async (
  root: string,
  input: {
    relativePath: string;
    frontmatter: Record<string, unknown>;
    body: string;
  }
): Promise<MarkdownDocument> => {
  const absolutePath = assertInsideRoot(root, input.relativePath);
  const balletRoot = assertInsideRoot(root, ".ballet");
  const relativeToBallet = path.relative(balletRoot, absolutePath);

  if (relativeToBallet.startsWith("..") || path.isAbsolute(relativeToBallet)) {
    throw new Error("Project document must be inside .ballet.");
  }

  if (path.extname(absolutePath).toLowerCase() !== ".md") {
    throw new Error("Project document must be a .md file.");
  }

  const existing = await stat(absolutePath);
  if (!existing.isFile()) {
    throw new Error("Project document must be an existing file.");
  }

  await writeMarkdownDocument({
    root,
    relativePath: input.relativePath,
    frontmatter: input.frontmatter,
    body: input.body
  });

  return readProjectMarkdownDocument(root, input.relativePath);
};

const readProjectMarkdownDocument = async (root: string, relativePath: string): Promise<MarkdownDocument> => {
  return readMarkdownDocument({ root, relativePath, collection: "project" });
};
