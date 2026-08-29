import type { ActionDefinition, CriticScheduleDefinition, StateDefinition } from "./environment.js";
import type { ExecutionSpecV12 } from "./execution.js";
import type { JsonValue } from "./primitives.js";
import type { AgentRunPhase, AgentRunRole, RootSnapshotV13 } from "./runtime.js";
import type { TaskEnvelopeV10 } from "./taskEnvelopes.js";
import type { ValidationOutcome, WorkOutcome } from "./outcomes.js";
import type { FeedbackCategory, FeedbackTargetType } from "./reviews.js";

export interface ActionExecutionSeed {
  actionExecutionId: string;
  definition: ActionDefinition;
  definitionHash: string;
  originatingRunId?: string;
  priorActionExecutionId?: string;
  importedDoneEvidence?: JsonValue;
}

export interface StateExecutionSeed {
  stateExecutionId: string;
  definition: StateDefinition;
  definitionHash: string;
  actions: ActionExecutionSeed[];
}

export interface CreateEnvironmentRunInput {
  environmentRunId: string;
  environmentDefinitionId: string;
  source: "manual" | "continuation";
  previousRunId?: string;
  baseCommit: string;
  worktreePath: string;
  branch: string;
  executionSnapshot: RootSnapshotV13;
  executionSnapshotHash: string;
  transitionLimit: number;
  states: StateExecutionSeed[];
  createdAt: string;
}

export interface CreateAgentRunInput {
  agentRunId: string;
  environmentRunId: string;
  actionExecutionId?: string;
  criticRunId?: string;
  refinementRunId?: string;
  parentAgentRunId?: string;
  role: AgentRunRole;
  phase: AgentRunPhase;
  attempt: number;
  taskEnvelope: TaskEnvelopeV10;
  taskEnvelopeHash: string;
  input?: JsonValue;
  context?: JsonValue;
  createdAt: string;
}

export interface FeedbackSeed {
  feedbackEntryId: string;
  source: "validation_blocked" | "retry_exhaustion" | "system_invalid_output" | "approved_critic_proposal" | "human";
  category: FeedbackCategory;
  targetType: FeedbackTargetType;
  targetId: string;
  title: string;
  description: string;
  correctiveActions: string[];
  evidenceRefs?: string[];
  createdBy?: string;
  environmentRunId: string;
  stateExecutionId?: string;
  actionExecutionId?: string;
  agentRunId?: string;
  criticProposalId?: string;
  refinementProposalId?: string;
  continuationRunId?: string;
  approval?: JsonValue;
  provenance: JsonValue;
  createdAt: string;
}

export interface ProductSnapshotSeed {
  productSnapshotId: string;
  environmentRunId: string;
  branch: string;
  worktreePath: string;
  baseCommit: string;
  resultCommit: string;
  changedFiles: string[];
  artifactRefs: string[];
  resourceHashes: Record<string, string>;
  definitionHashes: Record<string, string>;
  validationSummary: JsonValue;
  createdAt: string;
}

export interface CriticScheduleSeed {
  criticScheduleId: string;
  configHash: string;
  config: CriticScheduleDefinition;
  nextDueAt: string;
  enabled: boolean;
  createdAt: string;
}

export interface CriticDueSeed {
  criticRunId: string;
  criticScheduleId: string;
  dueAt: string;
  dueKey: string;
  productSnapshotId?: string;
  skipReason?: "no_product_snapshot";
  createdAt: string;
}

export interface CriticProposalSeed {
  criticProposalId: string;
  criticRunId: string;
  content: JsonValue;
  contentHash: string;
  targetType: FeedbackTargetType;
  targetId: string;
  category: FeedbackCategory;
  createdAt: string;
}

export interface HumanDecision {
  decision: "approved" | "rejected";
  expectedContentHash: string;
  expectedVersion: 1;
  decidedAt: string;
  rationale?: string;
}

export interface TrustedHumanActor {
  id: string;
  source: "request_context" | "local_operator";
}

export interface RefinementDecision extends HumanDecision {
  expectedChangeHashes: string[];
  expectedImpactActionIds: string[];
  acknowledgeLocalCommitAndContinuation: boolean;
}

export interface RefinementRunSeed {
  refinementRunId: string;
  sourceEnvironmentRunId: string;
  feedbackEntryIds: string[];
  createdAt: string;
}

export interface RefinementProposalSeed {
  refinementProposalId: string;
  refinementRunId: string;
  targetActionId: string;
  expectedBaseCommit: string;
  impactScope: JsonValue;
  changeListHash: string;
  expectedBehavioralImprovement: string;
  risks: string[];
  validationPlan: Array<"instruction_contract" | "resource_contract" | "relevant_tests">;
  rollback: string;
  files: Array<{
    operation: "create" | "replace" | "delete";
    relativePath: string;
    expectedPreimageHash: string | "absent";
    proposedContentHash: string | "absent";
    proposedContent?: string;
    rationale: string;
    resourceId?: string;
  }>;
  createdAt: string;
}

export interface RefinementApplySeed {
  refinementApplyId: string;
  refinementProposalId: string;
  status: "applied" | "apply_failed";
  worktreePath: string;
  branch: string;
  commitSha?: string;
  errorMessage?: string;
  observedPreimageHashes: Record<string, string>;
  completedAt: string;
  continuation?: CreateEnvironmentRunInput & { continuationLinkId: string; continuationSnapshotHash: string };
}

export interface ExecutionTaskSeed {
  spec: ExecutionSpecV12;
  specHash: string;
}

export interface ExecutionEventSeed {
  sequence: number;
  source: "ballet" | "codex" | "copilot";
  kind: string;
  level: "info" | "warn" | "error";
  phase: "started" | "delta" | "completed";
  message: string;
  data?: JsonValue;
  terminal: boolean;
  createdAt: string;
}

export interface ApplyPrecheckInput {
  agentRunId: string;
  providerOutcomeKey: string;
  expectedActionRevision: number;
  outcome: ValidationOutcome;
  nextWork?: CreateAgentRunInput;
  feedback?: FeedbackSeed;
  completedAt: string;
}

export interface ApplyWorkInput {
  agentRunId: string;
  providerOutcomeKey: string;
  expectedActionRevision: number;
  outcome: WorkOutcome;
  nextValidation: CreateAgentRunInput;
  completedAt: string;
}

export interface ApplyPostworkInput {
  agentRunId: string;
  providerOutcomeKey: string;
  expectedActionRevision: number;
  outcome: ValidationOutcome;
  nextWork?: CreateAgentRunInput;
  feedback?: FeedbackSeed;
  completedAt: string;
}
