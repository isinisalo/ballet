/** Bounded list projection, distinct from the full immutable proposal detail. */
export interface CriticProposalSummary {
  critic_proposal_id: string;
  critic_run_id: string;
  content_hash: string;
  target_type: string;
  target_id: string;
  category: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
  title: string;
  finding: string;
  severity: string;
}
