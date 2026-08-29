import type { TimestampedApproval } from "./primitives.js";

export type FeedbackSource = "validation_blocked" | "retry_exhaustion" | "approved_critic_proposal";

export interface FeedbackEntry {
  id: string;
  environmentRunId: string;
  actionExecutionId?: string;
  source: FeedbackSource;
  sourceId: string;
  status: "open" | "resolved";
  message: string;
  evidenceRefs: string[];
  createdAt: string;
  resolvedAt?: string;
}

export interface CriticSchedule {
  id: string;
  intervalMinutes: number;
  enabled: boolean;
  nextDueAt: string;
  updatedAt: string;
}

export interface CriticRun {
  id: string;
  scheduleId: string;
  dueAt: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface CriticReviewProposal {
  id: string;
  criticRunId: string;
  status: "pending_approval" | "approved" | "rejected";
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
  status: "pending_approval" | "approved" | "rejected" | "stale" | "applied";
  proposalHash: string;
  files: Array<{ relativePath: string; preimageSha256: string; proposedContentSha256: string }>;
  sharedSkillImpact: Array<{ resourceId: string; actionIds: string[] }>;
  approval?: TimestampedApproval;
  createdAt: string;
  updatedAt: string;
}
