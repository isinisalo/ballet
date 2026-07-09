import type { ProjectRuntime } from "./runtime.js";
import { defaultProjectOutputs } from "../policy-actions.js";

export type PolicyPredicateOperator = "equals" | "in" | "exists";
export type PolicyPredicateScalar = string | number | boolean | null;

export type JsonSchemaObject = Record<string, unknown>;

export interface ProjectAction {
  id: string;
  description: string;
  outputIds: string[];
  agentId?: string;
  humanGate?: boolean;
}

export type OutputId = string;

export interface ProjectOutput {
  id: OutputId;
}

export interface ProjectHumanGateResponse {
  id: string;
  loopId?: string;
  actionId: string;
  outputId: string;
  prompt: string;
  submittedAt: string;
}

export interface ProjectOutputRoute {
  sourceLoopId: string;
  sourceActionId: string;
  outputId: string;
  targetLoopId: string;
  targetActionId: string;
}

export interface ProjectLoop {
  id: string;
  steps: string[];
}

export interface ProjectAutomationConfig {
  version: 1;
  actions: ProjectAction[];
  outputs: ProjectOutput[];
  outputRoutes: ProjectOutputRoute[];
  humanGateResponses: ProjectHumanGateResponse[];
  loops: ProjectLoop[];
  runtimes: ProjectRuntime[];
}

export const defaultProjectAutomationConfig = (): ProjectAutomationConfig => ({
  version: 1,
  actions: [],
  outputs: defaultProjectOutputs(),
  outputRoutes: [],
  humanGateResponses: [],
  loops: [],
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

export interface EventRoutingActionDecision {
  actionId: string;
  loopId: string;
  routeId: string;
  actionVersion: number;
  targetAgentId: string;
  status: "routed" | "skipped";
  runId?: string;
  reason: string;
}

export interface EventRoutingSummary {
  matchedActions: number;
  routedRuns: number;
  skippedActions: number;
  decisions: EventRoutingActionDecision[];
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
  actionId: string;
  loopId: string;
  routeId: string;
  actionVersion: number;
  targetAgentId: string;
  status: "routed" | "skipped";
  runId?: string;
  reason: string;
}

export interface PolicyRouteDecision {
  policyId: string;
  policyName: string;
  policyVersion: number;
  targetAgentId: string;
  status: "routed" | "skipped";
  runId?: string;
  reason: string;
}
