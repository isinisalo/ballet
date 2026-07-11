export type OutputId = "approved" | "rejected";
export type StepEndStatus = "completed" | "blocked" | "failed";

export type StepTransitionTarget =
  | string
  | { loop: string }
  | { end: StepEndStatus };

export interface ProjectStepTransitions {
  approved: StepTransitionTarget;
  rejected: StepTransitionTarget;
}

interface ProjectStepBase {
  id: string;
  description: string;
  on: ProjectStepTransitions;
}

export interface ProjectAgentStep extends ProjectStepBase {
  type: "agent";
  agentId: string;
}

export interface ProjectHumanStep extends ProjectStepBase {
  type: "human";
  agentId?: never;
}

export type ProjectStep = ProjectAgentStep | ProjectHumanStep;

export interface ProjectLoop {
  id: string;
  start: string;
  steps: ProjectStep[];
}

export interface ProjectAutomationConfig {
  version: 3;
  loops: ProjectLoop[];
}

export const defaultProjectAutomationConfig = (): ProjectAutomationConfig => ({
  version: 3,
  loops: []
});

export interface ProjectAutomationIssue {
  path: string;
  message: string;
}

// Policies remain a Markdown document model. They are not part of automation v3
// execution or project.json routing.
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
