import type { ContractDefinition } from "./contracts.js";
import type { EmissionPolicy } from "./emission-policy.js";
import type { LoopDefinition, LoopInstance } from "./loop.js";
import type { AgentOperation, AgentExecutionOutput } from "./operations.js";
import type { RoutingPolicy } from "./routing-policy.js";
import type { JsonValue, VersionedRef } from "./json.js";

export type EntityStatus = "active" | "paused" | "archived";
export type AdrStatus = "proposed" | "accepted" | "superseded" | "rejected";
export type EventStatus = "received" | "routed" | "unassigned" | "handled";
export type AgentStatus = "online" | "offline";
export type RuntimeType = "codex-cli" | "custom";
export type AgentRunStatus = "queued" | "running" | "completed" | "failed" | "blocked" | "needs_input" | "cancelled";

export interface EventRoutingPolicyDecision {
  policyId: string;
  policyName: string;
  policyVersion: number;
  policyHash?: string;
  agentId?: string;
  operationId?: string;
  operationVersion?: number;
  inputContractId?: string;
  inputContractVersion?: number;
  inputContractHash?: string;
  status: "routed" | "skipped" | "condition_not_matched" | "invalid_input" | "configuration_error" | "exclusive_conflict" | "matched";
  runId?: string;
  reason: string;
  conditionTrace?: unknown;
  validationErrors?: unknown[];
}

export interface EventRoutingSummary {
  matchedPolicies: number;
  routedRuns: number;
  skippedPolicies: number;
  decisions: EventRoutingPolicyDecision[];
  message: string;
}

export interface MarkdownDocument {
  id: string;
  collection: string;
  title?: string;
  frontmatter: Record<string, unknown>;
  body: string;
  absolutePath: string;
  relativePath: string;
  slug: string;
  errors?: string[];
}

export type ProjectDocumentTreeNode =
  | {
    type: "file";
    label: string;
    document: MarkdownDocument;
  }
  | {
    type: "directory";
    label: string;
    relativePath: string;
    children: ProjectDocumentTreeNode[];
  };

export interface MarkdownBackedEntity {
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

export interface Goal {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: "not-started" | "in-progress" | "at-risk" | "done";
  targetDate: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

export interface Adr {
  id: string;
  projectId: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  status: AdrStatus;
  createdAt: string;
  updatedAt: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  enabled?: boolean;
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  skills: Skill[];
  enabled: boolean;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
  model?: string;
  modelReasoningEffort?: string;
  nicknameCandidates?: string[];
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

export interface Runtime {
  id: string;
  name: string;
  type: RuntimeType;
  command: string;
  config: Record<string, string>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

export interface EventDefinition {
  id: string;
  name: string;
  description: string;
  active: boolean;
  eventType: string;
  source?: string;
  tags: string[];
  dataContract?: VersionedRef;
  examples: Record<string, unknown>[];
  payloadExample?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

export interface EventRecord {
  seq?: number;
  id: string;
  eventId?: string;
  projectId: string;
  source: string;
  type?: string;
  eventType: string;
  subject?: string;
  correlationId?: string;
  causationId?: string;
  dedupeKey?: string;
  correlationDepth?: number;
  occurredAt?: string;
  tags: string[];
  payload: Record<string, unknown>;
  data?: Record<string, unknown>;
  status: EventStatus;
  matchedPolicyId?: string;
  assignedAgentId?: string;
  routing?: EventRoutingSummary;
  handlingResult?: string;
  loopInstanceId?: string;
  loopDefinitionId?: string;
  loopDefinitionVersion?: number;
  createdAt: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

export interface RuntimeEvent {
  seq: number;
  eventId: string;
  type: string;
  source: string;
  subject: string;
  correlationId: string;
  causationId?: string;
  dedupeKey?: string;
  correlationDepth: number;
  occurredAt: string;
  projectId: string;
  tags: string[];
  payload: Record<string, unknown>;
  data?: Record<string, unknown>;
  status: EventStatus;
  matchedPolicyId?: string;
  assignedAgentId?: string;
  routing?: EventRoutingSummary;
  handlingResult?: string;
  loopInstanceId?: string;
  loopDefinitionId?: string;
  loopDefinitionVersion?: number;
}

export interface AgentRun {
  runId: string;
  triggerEventId: string;
  triggerEventSeq?: number;
  policyId: string;
  policyVersion: number;
  agentRole: string;
  correlationId?: string;
  operationId?: string;
  operationVersion?: number;
  operationHash?: string;
  inputJson?: JsonValue;
  inputContractId?: string;
  inputContractVersion?: number;
  inputContractHash?: string;
  outputJson?: AgentExecutionOutput | JsonValue;
  outputContractId?: string;
  outputContractVersion?: number;
  outputContractHash?: string;
  outputValidationErrorsJson?: Record<string, unknown>[];
  routingPolicyHash?: string;
  routingDecisionJson?: Record<string, unknown>;
  emissionDecisionsJson?: Record<string, unknown>[];
  loopInstanceId?: string;
  loopDefinitionId?: string;
  loopDefinitionVersion?: number;
  stepId?: string;
  iteration?: number;
  status: AgentRunStatus;
  attempt: number;
  leaseOwner?: string;
  leaseUntil?: string;
  threadId?: string;
  turnId?: string;
  outcome?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AgentRunLog {
  id: number;
  runId: string;
  level: "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface AppData {
  projects: Project[];
  goals: Goal[];
  adrs: Adr[];
  agents: Agent[];
  skills: Skill[];
  runtimes: Runtime[];
  contracts: ContractDefinition[];
  operations: AgentOperation[];
  policies: RoutingPolicy[];
  emissionPolicies: EmissionPolicy[];
  loopDefinitions: LoopDefinition[];
  loopInstances: LoopInstance[];
  eventDefinitions: EventDefinition[];
  events: EventRecord[];
  agentRuns: AgentRun[];
  projectDocumentTree?: ProjectDocumentTreeNode[];
  documents?: {
    project: MarkdownDocument[];
    goals: MarkdownDocument[];
    adr: MarkdownDocument[];
    agents: MarkdownDocument[];
    skills: MarkdownDocument[];
    runtimes: MarkdownDocument[];
    contracts: MarkdownDocument[];
    operations: MarkdownDocument[];
    events: MarkdownDocument[];
    policies: MarkdownDocument[];
    emissionPolicies: MarkdownDocument[];
    loopDefinitions: MarkdownDocument[];
  };
  projectRoot?: string;
}

export type CollectionName =
  | "projects"
  | "goals"
  | "adrs"
  | "agents"
  | "skills"
  | "runtimes"
  | "contracts"
  | "operations"
  | "policies"
  | "emissionPolicies"
  | "loopDefinitions"
  | "events";
