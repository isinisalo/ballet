import { vNextCoreSchema } from "./schema/CoreSchema.js";
import { vNextExecutionSchema } from "./schema/ExecutionSchema.js";
import { vNextReviewSchema } from "./schema/ReviewSchema.js";

export const VNEXT_DATABASE_SCHEMA_VERSION = 16 as const;

export const VNextTableNames = [
  "metadata", "environment_runs", "state_executions", "action_executions", "agent_runs",
  "control_flow_events", "product_snapshots", "feedback_entries", "critic_schedules",
  "critic_runs", "critic_proposals", "critic_proposal_decisions", "refinement_runs",
  "refinement_run_feedback", "refinement_proposals", "refinement_proposal_files",
  "refinement_proposal_decisions", "refinement_applies", "continuation_links",
  "execution_tasks", "execution_events"
] as const;

export const vNextSchema = `${vNextCoreSchema}\n${vNextReviewSchema}\n${vNextExecutionSchema}`;
