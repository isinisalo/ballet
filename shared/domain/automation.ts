import type { ProjectRuntime } from "./runtime.js";

export type PolicyPredicateOperator = "equals" | "in" | "exists";
export type PolicyPredicateScalar = string | number | boolean | null;

export type JsonSchemaObject = Record<string, unknown>;

export interface ProjectTrigger {
  id: string;
  description: string;
}

export interface ProjectAction {
  id: string;
  description: string;
}

export interface ProjectOutput {
  id: string;
  description: string;
}

export interface ProjectPolicy {
  id: string;
  source: "event" | "trigger";
  event?: string;
  trigger?: string;
  agent: string;
  action: string;
  enabled: boolean;
}

export interface ProjectWorkflow {
  id: string;
  title: string;
  steps: string[];
}

export interface ProjectAutomationConfig {
  version: 1;
  triggers: ProjectTrigger[];
  actions: ProjectAction[];
  outputs: ProjectOutput[];
  policies: ProjectPolicy[];
  workflows: ProjectWorkflow[];
  runtimes: ProjectRuntime[];
}

export const defaultProjectAutomationConfig = (): ProjectAutomationConfig => ({
  version: 1,
  triggers: [],
  actions: [],
  outputs: [],
  policies: [],
  workflows: [],
  runtimes: []
});

export interface ProjectAutomationIssue {
  path: string;
  message: string;
}

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

export interface RouteDecision {
  policyId: string;
  policyName: string;
  policyVersion: number;
  targetAgentId: string;
  status: "routed" | "skipped";
  runId?: string;
  reason: string;
}
