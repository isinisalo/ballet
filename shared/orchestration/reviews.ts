import type { TimestampedApproval } from "./primitives.js";

export type FeedbackSource = "validation_blocked" | "retry_exhaustion" | "provider_failure" | "system_invalid_output" | "approved_critic_proposal" | "human";
export type FeedbackCategory = "system" | "architecture" | "code" | "design" | "documentation";
export type FeedbackTargetType =
  | "run_evidence" | "environment_definition" | "environment_run"
  | "state_definition" | "state_execution" | "action_definition" | "action_execution" | "resource";

export interface FeedbackEntry {
  id: string;
  environmentRunId: string;
  actionExecutionId?: string;
  source: FeedbackSource;
  sourceId: string;
  status: "open" | "in_refinement" | "resolved" | "dismissed";
  message: string;
  evidenceRefs: string[];
  createdAt: string;
  resolvedAt?: string;
}

export interface CriticSchedule {
  id: string;
  enabled: boolean;
  configHash: string;
  nextDueAt: string;
  updatedAt: string;
}

export interface CriticRun {
  id: string;
  scheduleId: string;
  dueAt: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "skipped";
  createdAt: string;
  updatedAt: string;
}

export interface CriticReviewProposal {
  id: string;
  criticRunId: string;
  status: "pending_human_review" | "approved" | "rejected";
  version: 2;
  contentHash: string;
  proposedText: string;
  evidenceRefs: string[];
  approval?: TimestampedApproval;
  createdAt: string;
  updatedAt: string;
}

export interface RefinementRun {
  id: string;
  sourceEnvironmentRunId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface RefinementReviewProposal {
  id: string;
  refinementRunId: string;
  status: "pending_human_review" | "applying" | "rejected" | "stale" | "applied" | "apply_failed";
  proposalHash: string;
  files: Array<{ relativePath: string; preimageSha256: string; proposedContentSha256: string }>;
  sharedSkillImpact: Array<{ resourceId: string; actionIds: string[] }>;
  approval?: TimestampedApproval;
  createdAt: string;
  updatedAt: string;
}
