import type Database from "better-sqlite3";
import type { NodeResult } from "../../shared/domain/automation.js";
import type { PolicyDecisionRecordV1, PolicyOptionObservationV1 } from "../../shared/domain/decisionModel.js";

type Row = Record<string, unknown>;

export class PolicyEvidenceStore {
  constructor(private readonly connection: () => Database.Database) {}

  listDecisions(rootRunId: string): PolicyDecisionRecordV1[] {
    return (this.connection().prepare(
      "SELECT * FROM policy_decisions WHERE root_run_id = ? ORDER BY epoch"
    ).all(rootRunId) as Row[]).map(mapPolicyDecision);
  }

  listObservations(rootRunId: string): PolicyOptionObservationV1[] {
    return (this.connection().prepare(
      "SELECT * FROM policy_option_observations WHERE root_run_id = ? ORDER BY created_at, rowid"
    ).all(rootRunId) as Row[]).map(mapPolicyObservation);
  }

  requireDecision(policyDecisionId: string): PolicyDecisionRecordV1 {
    const row = this.connection().prepare(
      "SELECT * FROM policy_decisions WHERE policy_decision_id = ?"
    ).get(policyDecisionId) as Row | undefined;
    if (!row) throw new Error(`Policy decision ${policyDecisionId} was not found.`);
    return mapPolicyDecision(row);
  }

  insertDecision(decision: PolicyDecisionRecordV1): void {
    this.connection().prepare(`
      INSERT INTO policy_decisions (
        policy_decision_id, root_run_id, epoch, epoch_kind, previous_graph_node_invocation_id,
        state_json, admissible_action_ids_json, excluded_actions_json, selected_graph_node_id,
        action_values_json, state_value_micros, tied_action_ids_json, solver_status, solver_algorithm,
        iterations, residual, epsilon, model_version, model_sha256, policy_sha256, snapshot_sha256, message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(decision.policyDecisionId, decision.rootRunId, decision.epoch, decision.epochKind,
      decision.previousGraphNodeInvocationId ?? null, decision.state ? JSON.stringify(decision.state) : null,
      JSON.stringify(decision.admissibleActionIds), JSON.stringify(decision.excludedActions),
      decision.selectedGraphNodeId ?? null, JSON.stringify(decision.actionValues),
      decision.stateValueMicros ?? null, JSON.stringify(decision.tiedActionIds), decision.solverStatus,
      decision.solverAlgorithm, decision.iterations, decision.residual, decision.epsilon, decision.modelVersion,
      decision.modelSha256, decision.policySha256 ?? null, decision.snapshotSha256,
      decision.message ?? null, decision.createdAt);
  }

  insertObservation(observation: PolicyOptionObservationV1): void {
    this.connection().prepare(`
      INSERT INTO policy_option_observations (
        policy_observation_id, root_run_id, policy_decision_id, graph_node_invocation_id,
        state_before_json, action, configured_expected_cost_micros, actual_cost_micros,
        verified_outcome, state_after_json, duration_millis, model_sha256, snapshot_sha256, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(observation.policyObservationId, observation.rootRunId, observation.policyDecisionId,
      observation.graphNodeInvocationId, JSON.stringify(observation.stateBefore), observation.action,
      observation.configuredExpectedCostMicros, observation.actualCostMicros ?? null,
      observation.verifiedOutcome, observation.stateAfter ? JSON.stringify(observation.stateAfter) : null,
      observation.durationMillis, observation.modelSha256, observation.snapshotSha256, observation.createdAt);
  }
}

const mapPolicyDecision = (row: Row): PolicyDecisionRecordV1 => ({
  policyDecisionId: String(row.policy_decision_id), rootRunId: String(row.root_run_id),
  epoch: Number(row.epoch), epochKind: row.epoch_kind as PolicyDecisionRecordV1["epochKind"],
  previousGraphNodeInvocationId: optional(row.previous_graph_node_invocation_id),
  state: row.state_json ? JSON.parse(String(row.state_json)) as PolicyDecisionRecordV1["state"] : undefined,
  admissibleActionIds: JSON.parse(String(row.admissible_action_ids_json)) as string[],
  excludedActions: JSON.parse(String(row.excluded_actions_json)) as PolicyDecisionRecordV1["excludedActions"],
  selectedGraphNodeId: optional(row.selected_graph_node_id),
  actionValues: JSON.parse(String(row.action_values_json)) as PolicyDecisionRecordV1["actionValues"],
  stateValueMicros: row.state_value_micros == null ? undefined : Number(row.state_value_micros),
  tiedActionIds: JSON.parse(String(row.tied_action_ids_json)) as string[],
  solverStatus: row.solver_status as PolicyDecisionRecordV1["solverStatus"],
  solverAlgorithm: "ssp_value_iteration_v1", iterations: Number(row.iterations),
  residual: Number(row.residual), epsilon: Number(row.epsilon), modelVersion: 1, modelSha256: String(row.model_sha256),
  policySha256: optional(row.policy_sha256), snapshotSha256: String(row.snapshot_sha256),
  message: optional(row.message), createdAt: String(row.created_at)
});

const mapPolicyObservation = (row: Row): PolicyOptionObservationV1 => ({
  policyObservationId: String(row.policy_observation_id), rootRunId: String(row.root_run_id),
  policyDecisionId: String(row.policy_decision_id), graphNodeInvocationId: String(row.graph_node_invocation_id),
  stateBefore: JSON.parse(String(row.state_before_json)) as PolicyOptionObservationV1["stateBefore"],
  action: String(row.action), configuredExpectedCostMicros: Number(row.configured_expected_cost_micros),
  actualCostMicros: row.actual_cost_micros == null ? undefined : Number(row.actual_cost_micros),
  verifiedOutcome: row.verified_outcome as NodeResult,
  stateAfter: row.state_after_json ? JSON.parse(String(row.state_after_json)) as PolicyOptionObservationV1["stateAfter"] : undefined,
  durationMillis: Number(row.duration_millis), modelSha256: String(row.model_sha256),
  snapshotSha256: String(row.snapshot_sha256), createdAt: String(row.created_at)
});

const optional = (value: unknown): string | undefined => value == null ? undefined : String(value);
