export type EntityStatus = "active" | "paused" | "archived";
export type AdrStatus = "proposed" | "accepted" | "superseded" | "rejected";
export type EventStatus = "received" | "routed" | "unassigned" | "handled";
export type AgentStatus = "online" | "offline";
export type RuntimeType = "codex-cli" | "custom";
export type AgentRunStatus = "queued" | "running" | "completed" | "failed" | "blocked" | "needs_input" | "cancelled";
export type AgentOutcomeStatus = "ready" | "blocked" | "needs_input" | "approved" | "changes_requested" | "failed";
export type RunCheckStatus = "passed" | "failed" | "skipped";
export type PolicyPredicateOperator = "equals" | "in" | "exists";
export type PolicyPredicateScalar = string | number | boolean | null;

export interface PolicyPredicate {
  operator: PolicyPredicateOperator;
  value?: PolicyPredicateScalar | PolicyPredicateScalar[];
}

export interface PolicyMatch {
  eventTypes?: string[];
  projectId?: string | PolicyPredicate;
  source?: string | PolicyPredicate;
  subject?: string | PolicyPredicate;
  tags?: string[] | PolicyPredicate;
  payload?: Record<string, PolicyPredicate | PolicyPredicateScalar | PolicyPredicateScalar[]>;
}

export interface PolicyAction {
  type: "start_agent_run";
  targetAgentId: string;
}

export interface EventRoutingPolicyDecision {
  policyId: string;
  policyName: string;
  policyVersion: number;
  targetAgentId: string;
  status: "routed" | "skipped";
  runId?: string;
  reason: string;
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
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  active: boolean;
  match?: PolicyMatch;
  action?: PolicyAction;
  projectId: string | "*";
  eventTypes: string[];
  source: string;
  payloadMetadata: Record<string, string>;
  targetAgentId: string;
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
  status: EventStatus;
  matchedPolicyId?: string;
  assignedAgentId?: string;
  routing?: EventRoutingSummary;
  handlingResult?: string;
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
  status: EventStatus;
  matchedPolicyId?: string;
  assignedAgentId?: string;
  routing?: EventRoutingSummary;
  handlingResult?: string;
}

export interface RunCheck {
  name: string;
  status: RunCheckStatus;
  details?: string;
}

export interface AgentOutcome {
  outcome: AgentOutcomeStatus;
  summary: string;
  artifacts?: {
    git_sha?: string;
    changed_files?: string[];
    [key: string]: unknown;
  };
  checks: RunCheck[];
}

export interface AgentRun {
  runId: string;
  triggerEventId: string;
  triggerEventSeq?: number;
  policyId: string;
  policyVersion: number;
  agentRole: string;
  status: AgentRunStatus;
  attempt: number;
  leaseOwner?: string;
  leaseUntil?: string;
  threadId?: string;
  turnId?: string;
  outcome?: AgentOutcome;
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
  policies: Policy[];
  events: EventRecord[];
  agentRuns: AgentRun[];
  projectDocumentTree?: ProjectDocumentTreeNode[];
  documents?: {
    project: MarkdownDocument[];
    goals: MarkdownDocument[];
    adr: MarkdownDocument[];
    agents: MarkdownDocument[];
    skills: MarkdownDocument[];
    events: MarkdownDocument[];
    policies: MarkdownDocument[];
  };
  projectRoot?: string;
}

export type CollectionName = "projects" | "goals" | "adrs" | "agents" | "skills" | "runtimes" | "policies" | "events";

export interface RouteDecision {
  policyId: string;
  policyName: string;
  policyVersion: number;
  targetAgentId: string;
  status: "routed" | "skipped";
  runId?: string;
  reason: string;
}
