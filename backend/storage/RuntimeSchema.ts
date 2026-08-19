import { runtimeSchemaInvariants } from "./RuntimeSchemaInvariants.js";
import { runtimeSchemaSupportTables } from "./RuntimeSchemaSupportTables.js";
import { runtimeSchemaTables } from "./RuntimeSchemaTables.js";

export const localDatabaseSchemaVersion = 7;
export const localDatabaseTableNames = [
  "control_flow_events", "execution_events", "execution_tasks", "loop_invocations",
  "loop_schedule_state", "metadata", "node_runs", "orchestration_frames", "orchestration_requests",
  "orchestrator_routes", "repair_requests", "repair_results", "root_runs", "state_revisions",
  "work_loop_node_runs"
] as const;
export const runtimeSchema = `${runtimeSchemaTables}${runtimeSchemaSupportTables}${runtimeSchemaInvariants}`;
