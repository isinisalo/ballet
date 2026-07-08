import type { MarkdownBackedEntity } from "./documents.js";
import type { EventRoutingSummary } from "./automation.js";
import type { AgentOutputEventStatus, AgentOutcomeStatus } from "./runtime.js";

export type EventStatus = "received" | "routed" | "unassigned" | "handled";

export interface RoutedEvent {
  id: string;
  source: string;
  timestamp: string;
  payload: {
    agent?: string;
    action: string;
    status: AgentOutputEventStatus;
    outcome?: AgentOutcomeStatus;
    summary?: string;
    agents?: Array<{
      agent: string;
      run_id: string;
      status: string;
      outcome?: AgentOutcomeStatus;
      summary?: string;
    }>;
    run_id?: string;
    input_event_id?: string;
    policy_id?: string;
    policy_version?: number;
    payload?: Record<string, unknown>;
  };
}

export interface EventProducerRequirements {
  gitCommitExists?: boolean;
  requiredChecksPassed?: boolean;
}

export interface EventProducerDefinition {
  agentRole: string;
  outcomes: AgentOutcomeStatus[];
  requires?: EventProducerRequirements;
}

export interface EventDefinition extends MarkdownBackedEntity {
  id: string;
  name: string;
  description: string;
  active: boolean;
  eventType: string;
  source: string;
  tags: string[];
  producers: EventProducerDefinition[];
  payloadExample: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EventRecord extends MarkdownBackedEntity {
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
