import type Database from "better-sqlite3";
import type { PolicyDecisionRecordV2, PolicyOptionObservationV3 } from "../../shared/domain/decisionModel.js";
import { policyOptionObservationSchema } from "../../shared/api/runtime-schemas.js";

type Row = Record<string, unknown>;

export class PolicyEvidenceStore {
  constructor(private readonly connection: () => Database.Database) {}

  listDecisions(rootRunId: string): PolicyDecisionRecordV2[] {
    return (this.connection().prepare(
      "SELECT * FROM policy_decisions WHERE root_run_id = ? ORDER BY created_at, rowid"
    ).all(rootRunId) as Row[]).map(mapPolicyDecision);
  }

  listObservations(rootRunId: string): PolicyOptionObservationV3[] {
    return (this.connection().prepare(
      "SELECT * FROM policy_option_observations WHERE root_run_id = ? ORDER BY created_at, rowid"
    ).all(rootRunId) as Row[]).map(mapPolicyObservation);
  }

  requireDecision(policyDecisionId: string): PolicyDecisionRecordV2 {
    const row = this.connection().prepare(
      "SELECT * FROM policy_decisions WHERE policy_decision_id = ?"
    ).get(policyDecisionId) as Row | undefined;
    if (!row) throw new Error(`Policy decision ${policyDecisionId} was not found.`);
    return mapPolicyDecision(row);
  }

  insertDecision(decision: PolicyDecisionRecordV2): void {
    this.connection().prepare(`
      INSERT INTO policy_decisions (
        policy_decision_id, root_run_id, scope, scope_key, graph_node_invocation_id, epoch, epoch_kind,
        previous_action_invocation_id, state_json, admissible_action_ids_json, excluded_actions_json,
        selected_action_id, action_values_json, state_value_micros, tied_action_ids_json, solver_status,
        solver_algorithm, iterations, residual, epsilon, model_version, model_sha256, policy_sha256,
        snapshot_sha256, message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      decision.policyDecisionId, decision.rootRunId, decision.scope, decision.scopeKey,
      decision.graphNodeInvocationId ?? null, decision.epoch, decision.epochKind,
      decision.previousActionInvocationId ?? null, decision.state ? JSON.stringify(decision.state) : null,
      JSON.stringify(decision.admissibleActionIds), JSON.stringify(decision.excludedActions),
      decision.selectedActionId ?? null, JSON.stringify(decision.actionValues), decision.stateValueMicros ?? null,
      JSON.stringify(decision.tiedActionIds), decision.solverStatus, decision.solverAlgorithm, decision.iterations,
      decision.residual, decision.epsilon, decision.modelVersion, decision.modelSha256,
      decision.policySha256 ?? null, decision.snapshotSha256, decision.message ?? null, decision.createdAt
    );
  }

  insertObservation(observation: PolicyOptionObservationV3): void {
    this.connection().prepare(`
      INSERT INTO policy_option_observations (
        policy_observation_id, root_run_id, policy_decision_id, scope, scope_key, action_invocation_id,
        graph_node_invocation_id, job_node_invocation_id, state_before_json, action_id,
        configured_expected_cost_micros, expected_outcome_distribution_json, observation_version,
        observed_cost_json, observed_outcome_id, verified_result, actual_state_json, model_match,
        model_sha256, snapshot_sha256, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      observation.policyObservationId, observation.rootRunId, observation.policyDecisionId,
      observation.scope, observation.scopeKey, observation.actionInvocationId,
      observation.graphNodeInvocationId ?? null, observation.jobNodeInvocationId ?? null,
      JSON.stringify(observation.stateBefore), observation.actionId, observation.configuredExpectedCostMicros,
      JSON.stringify(observation.expectedOutcomeDistribution), observation.version,
      JSON.stringify(observation.observedCost), observation.observedOutcomeId, observation.verifiedResult,
      observation.actualState ? JSON.stringify(observation.actualState) : null, observation.modelMatch,
      observation.modelSha256, observation.snapshotSha256, observation.createdAt
    );
  }
}

const mapPolicyDecision = (row: Row): PolicyDecisionRecordV2 => ({
  policyDecisionId: String(row.policy_decision_id), rootRunId: String(row.root_run_id),
  scope: row.scope as PolicyDecisionRecordV2["scope"], scopeKey: String(row.scope_key),
  graphNodeInvocationId: optional(row.graph_node_invocation_id), epoch: Number(row.epoch),
  epochKind: row.epoch_kind as PolicyDecisionRecordV2["epochKind"],
  previousActionInvocationId: optional(row.previous_action_invocation_id),
  state: row.state_json ? JSON.parse(String(row.state_json)) as PolicyDecisionRecordV2["state"] : undefined,
  admissibleActionIds: JSON.parse(String(row.admissible_action_ids_json)) as string[],
  excludedActions: JSON.parse(String(row.excluded_actions_json)) as PolicyDecisionRecordV2["excludedActions"],
  selectedActionId: optional(row.selected_action_id),
  actionValues: JSON.parse(String(row.action_values_json)) as PolicyDecisionRecordV2["actionValues"],
  stateValueMicros: row.state_value_micros == null ? undefined : Number(row.state_value_micros),
  tiedActionIds: JSON.parse(String(row.tied_action_ids_json)) as string[],
  solverStatus: row.solver_status as PolicyDecisionRecordV2["solverStatus"],
  solverAlgorithm: "ssp_value_iteration_v2", iterations: Number(row.iterations), residual: Number(row.residual),
  epsilon: Number(row.epsilon), modelVersion: 2, modelSha256: String(row.model_sha256),
  policySha256: optional(row.policy_sha256), snapshotSha256: String(row.snapshot_sha256),
  message: optional(row.message), createdAt: String(row.created_at)
});

const mapPolicyObservation = (row: Row): PolicyOptionObservationV3 => policyOptionObservationSchema.parse({
  version: Number(row.observation_version), policyObservationId: String(row.policy_observation_id), rootRunId: String(row.root_run_id),
  policyDecisionId: String(row.policy_decision_id), scope: row.scope as PolicyOptionObservationV3["scope"],
  scopeKey: String(row.scope_key), actionInvocationId: String(row.action_invocation_id),
  graphNodeInvocationId: optional(row.graph_node_invocation_id), jobNodeInvocationId: optional(row.job_node_invocation_id),
  stateBefore: JSON.parse(String(row.state_before_json)) as PolicyOptionObservationV3["stateBefore"],
  actionId: String(row.action_id), configuredExpectedCostMicros: Number(row.configured_expected_cost_micros),
  expectedOutcomeDistribution: JSON.parse(String(row.expected_outcome_distribution_json)) as PolicyOptionObservationV3["expectedOutcomeDistribution"],
  observedCost: JSON.parse(String(row.observed_cost_json)) as PolicyOptionObservationV3["observedCost"],
  observedOutcomeId: String(row.observed_outcome_id), verifiedResult: row.verified_result as PolicyOptionObservationV3["verifiedResult"],
  actualState: row.actual_state_json ? JSON.parse(String(row.actual_state_json)) as PolicyOptionObservationV3["actualState"] : undefined,
  modelMatch: row.model_match as PolicyOptionObservationV3["modelMatch"],
  modelSha256: String(row.model_sha256), snapshotSha256: String(row.snapshot_sha256), createdAt: String(row.created_at)
});

const optional = (value: unknown): string | undefined => value == null ? undefined : String(value);
