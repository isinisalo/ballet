import { coreSchema } from "./schema/CoreSchema.js";
import { executionSchema } from "./schema/ExecutionSchema.js";
import { reviewSchema } from "./schema/ReviewSchema.js";

export const DATABASE_SCHEMA_VERSION = 16 as const;

export const RuntimeTableNames = [
  "metadata", "environment_runs", "state_executions", "action_executions", "agent_runs",
  "control_flow_events", "product_snapshots", "feedback_entries", "feedback_status_events", "critic_schedules",
  "critic_runs", "critic_proposals", "critic_proposal_decisions", "refinement_runs",
  "refinement_run_feedback", "refinement_proposals", "refinement_proposal_files",
  "refinement_proposal_decisions", "refinement_applies", "continuation_links",
  "execution_tasks", "execution_events"
] as const;

export const runtimeSchema = `${coreSchema}\n${reviewSchema}\n${executionSchema}`;
