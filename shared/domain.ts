export type EntityStatus = "active" | "paused" | "archived";
export type AdrStatus = "proposed" | "accepted" | "superseded" | "rejected";
export type EventStatus = "received" | "routed" | "unassigned" | "handled";
export type RuntimeType = "codex-cli" | "custom";

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
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
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  skills: Skill[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
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
  priority: number;
  projectId: string | "*";
  eventTypes: string[];
  tags: string[];
  source: string;
  payloadMetadata: Record<string, string>;
  targetAgentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventRecord {
  id: string;
  projectId: string;
  source: string;
  eventType: string;
  tags: string[];
  payload: Record<string, unknown>;
  status: EventStatus;
  matchedPolicyId?: string;
  assignedAgentId?: string;
  handlingResult?: string;
  createdAt: string;
}

export interface AppData {
  projects: Project[];
  goals: Goal[];
  adrs: Adr[];
  agents: Agent[];
  runtimes: Runtime[];
  policies: Policy[];
  events: EventRecord[];
}

export type CollectionName = keyof AppData;

export interface RouteResult {
  status: EventStatus;
  matchedPolicyId?: string;
  assignedAgentId?: string;
  handlingResult: string;
}
