import type { CriticProposalSummary } from "@shared/orchestration/httpResponses";
export type JsonRow = Record<string, unknown>;

export interface RunSummary {
  environmentRunId: string; environmentDefinitionId: string; source: "manual" | "continuation";
  previousRunId?: string; status: string; revision: number; baseCommit: string; resultCommit?: string;
  branch: string; transitionCount: number; transitionLimit: number; createdAt: string; updatedAt: string; completedAt?: string;
}

export interface ActionProjection {
  actionExecutionId: string; actionDefinitionId: string; priority: number; status: string; revision: number;
  workAttempt: number; maxRetries: number; activeAgentRunId?: string; createdAt: string; updatedAt: string;
  completedAt?: string; done: boolean; blocked: boolean;
}
export interface StateProjection {
  stateExecutionId: string; stateDefinitionId: string; order: number; status: string; revision: number;
  createdAt: string; updatedAt: string; completedAt?: string; done: boolean; blocked: boolean; actions: ActionProjection[];
}
export interface RunDetail extends RunSummary {
  executionSnapshotHash?: string; activeAgent?: JsonRow; states: StateProjection[]; events: Array<JsonRow>; evidence?: JsonRow;
}

export interface GovernanceData {
  runs: RunSummary[]; feedback: JsonRow[]; criticRuns: JsonRow[]; criticProposals: CriticProposalSummary[];
  refinementRuns: JsonRow[]; refinementProposals: JsonRow[];
  selectedRun?: RunDetail; selectedFeedback?: JsonRow; selectedCritic?: JsonRow; selectedRefinement?: JsonRow;
  applyStatus?: JsonRow; continuation?: JsonRow;
}
