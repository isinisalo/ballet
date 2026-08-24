import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { ProjectGraphNode, ProjectActionNode } from "../../shared/domain/automation.js";
import type {
  AdmissibleActionSetV4,
  CompiledPolicyStateV4,
  DecisionEpochKind,
  DecisionStateV4,
  DecisionTransitionV4,
  PolicyCostMeasureV1,
  PolicyDecisionRecordV5,
  PolicyModelMatchV4,
  PolicyOptionObservationV5
} from "../../shared/domain/decisionModel.js";
import type {
  CanonicalNodeOutcome,
  NodeRun,
  RootExecutionSnapshot,
  ValidationNodeOutcome
} from "../../shared/domain/runtime.js";
import type { RuntimeInvocationStore } from "./RuntimeInvocationStore.js";
import type { RuntimeStateStore } from "./RuntimeStateStore.js";

type Row = Record<string, unknown>;

export interface DecisionInput {
  epochKind: DecisionEpochKind;
  state: DecisionStateV4;
  graphNodeInvocationId?: string;
  previousActionInvocationId?: string;
}

export function setRootRunStatus(connection: Database.Database, rootRunId: string, status: string): void {
  const terminal = ["completed", "blocked", "failed", "cancelled"].includes(status);
  const at = now();
  connection.prepare(`
    UPDATE root_runs SET status = ?, updated_at = ?, completed_at = CASE WHEN ? THEN ? ELSE NULL END
    WHERE root_run_id = ?
  `).run(status, at, terminal ? 1 : 0, terminal ? at : null, rootRunId);
}

export function cancelRuntimeInvocations(connection: Database.Database, rootRunId: string): void {
  const at = now();
  for (const table of ["node_runs", "action_node_invocations", "graph_node_invocations"]) {
    connection.prepare(`
      UPDATE ${table} SET status = 'cancelled', updated_at = ?, completed_at = ?
      WHERE root_run_id = ? AND status IN ('queued','running','waiting_for_input')
    `).run(at, at, rootRunId);
  }
}

export function writeRootTerminal(
  connection: Database.Database,
  rootRunId: string,
  status: string,
  outcome?: CanonicalNodeOutcome,
  message?: string
): void {
  const at = now();
  const failed = status === "failed" || status === "blocked";
  connection.prepare(`
    UPDATE root_runs SET status = ?, outcome_json = ?, error_code = ?, error_message = ?,
      active_graph_node_invocation_id = NULL, active_node_run_id = NULL,
      updated_at = ?, completed_at = ? WHERE root_run_id = ?
  `).run(
    status,
    outcome ? JSON.stringify(outcome) : null,
    failed ? status : null,
    failed ? message ?? null : null,
    at,
    at,
    rootRunId
  );
}

export function rootExecutionSnapshot(connection: Database.Database, rootRunId: string): RootExecutionSnapshot {
  const row = connection.prepare("SELECT execution_snapshot_json FROM root_runs WHERE root_run_id = ?")
    .get(rootRunId) as Row | undefined;
  if (!row) throw new Error(`Root Run ${rootRunId} was not found.`);
  return JSON.parse(String(row.execution_snapshot_json)) as RootExecutionSnapshot;
}

export function policyDecisionRecord(input: {
  connection: Database.Database;
  snapshot: RootExecutionSnapshot;
  rootRunId: string;
  decision: DecisionInput;
  admissible: AdmissibleActionSetV4;
  compiled?: CompiledPolicyStateV4;
}): PolicyDecisionRecordV5 {
  const epoch = Number((input.connection.prepare(
    "SELECT COUNT(*) AS count FROM policy_decisions WHERE root_run_id = ?"
  ).get(input.rootRunId) as Row).count) + 1;
  const deniedValues = input.admissible.excludedActions
    .filter(({ reasonCode }) => reasonCode === "authorization_denied")
    .map(({ actionId }) => ({ actionId, qMicros: 0 }));
  const compiledPolicy = input.decision.state.scope === "graph"
    ? input.snapshot.compiledPolicies.global
    : input.snapshot.compiledPolicies.graphNodes[input.decision.state.graphNodeId!];
  return {
    version: 5,
    policyDecisionId: randomUUID(),
    rootRunId: input.rootRunId,
    epoch,
    epochKind: input.decision.epochKind,
    scope: input.decision.state.scope,
    ...(input.decision.state.graphNodeId ? { graphNodeId: input.decision.state.graphNodeId } : {}),
    ...(input.decision.graphNodeInvocationId ? { graphNodeInvocationId: input.decision.graphNodeInvocationId } : {}),
    ...(input.decision.previousActionInvocationId
      ? { previousActionInvocationId: input.decision.previousActionInvocationId } : {}),
    state: input.decision.state,
    admissibleActionIds: input.admissible.actionIds,
    excludedActions: input.admissible.excludedActions,
    selectedActionId: input.compiled?.selectedActionId,
    actionValues: [...(input.compiled?.actionValues ?? []), ...deniedValues]
      .sort((left, right) => left.actionId.localeCompare(right.actionId)),
    stateValueMicros: input.compiled?.valueMicros,
    solverStatus: input.compiled ? "compiled" : "policy_model_invalid",
    modelSha256: compiledPolicy?.modelSha256 ?? "missing",
    policySha256: compiledPolicy?.policySha256,
    snapshotSha256: input.snapshot.project.snapshotHash,
    message: input.compiled ? undefined : "Compiled policy has no row for the current scope state.",
    createdAt: now()
  };
}

export function actionDefinition(invocations: RuntimeInvocationStore, node: NodeRun): ProjectActionNode {
  const graph = invocations.graphNode(node.graphNodeInvocationId!).snapshot;
  const action = graph.actionNodes.find(({ id }) => id === node.actionNodeId);
  if (!action) throw new Error(`Action Node ${node.actionNodeId} is outside its immutable Graph Node snapshot.`);
  return action;
}

export function requireGraphNode(snapshot: RootExecutionSnapshot, id: string): ProjectGraphNode {
  const graphNode = snapshot.graph.graphNodes.find((candidate) => candidate.id === id);
  if (!graphNode) throw new Error(`Graph Node ${id} is outside the immutable snapshot.`);
  return graphNode;
}

export function assertValidationOutcome(action: ProjectActionNode, outcome: ValidationNodeOutcome): void {
  const intrinsic = action.outcomes.find(({ outcomeId }) => outcomeId === outcome.outcomeId);
  if (!intrinsic || intrinsic.result !== outcome.decision) {
    throw new Error("Validation outcome violates the Action Node semantic enum.");
  }
}

export function eventDetail(states: RuntimeStateStore, node: NodeRun) {
  return {
    stateRevision: states.revision(node.rootRunId), graphNodeInvocationId: node.graphNodeInvocationId,
    actionNodeInvocationId: node.actionNodeInvocationId, sourceNodeRunId: node.nodeRunId
  };
}

export function terminalStatus(terminal: "success" | "failure" | "blocked") {
  return terminal === "success" ? "completed" : terminal === "failure" ? "failed" : "blocked";
}

export function observationRecord(input: {
  snapshot: RootExecutionSnapshot;
  decision: PolicyDecisionRecordV5;
  actionInvocationId: string;
  graphNodeInvocationId?: string;
  outcome: ValidationNodeOutcome;
  distribution: DecisionTransitionV4[];
  actualState?: DecisionStateV4;
  terminal?: "success" | "failure" | "blocked";
  emittedOutcomeId?: string;
  realizedRewardMicros: number;
  modelMatch: PolicyModelMatchV4;
  acceptanceLedgerAfter: PolicyOptionObservationV5["acceptanceLedgerAfter"];
}): PolicyOptionObservationV5 {
  const unknown = (reason: "provider_not_reported" | "project_not_configured"): PolicyCostMeasureV1 =>
    ({ status: "unknown", reason, sourceRefs: [] });
  return {
    version: 5,
    policyObservationId: randomUUID(),
    rootRunId: input.decision.rootRunId,
    policyDecisionId: input.decision.policyDecisionId,
    scope: input.decision.scope,
    ...(input.decision.graphNodeId ? { graphNodeId: input.decision.graphNodeId } : {}),
    ...(input.graphNodeInvocationId ? { graphNodeInvocationId: input.graphNodeInvocationId } : {}),
    actionInvocationId: input.actionInvocationId,
    stateBefore: input.decision.state,
    actionId: input.decision.selectedActionId!,
    expectedOutcomeDistribution: input.distribution,
    observedCost: {
      version: 1,
      attribution: { mode: "inclusive_v1", nodeRunIds: [], executionTaskIds: [] },
      dimensions: {
        durationMillis: unknown("provider_not_reported"),
        inputTokens: unknown("provider_not_reported"),
        outputTokens: unknown("provider_not_reported"),
        cachedInputTokens: unknown("provider_not_reported"),
        workRetryCount: unknown("project_not_configured"),
        monetaryMicros: unknown("project_not_configured")
      }
    },
    observedOutcomeId: input.outcome.outcomeId,
    ...(input.emittedOutcomeId ? { emittedOutcomeId: input.emittedOutcomeId } : {}),
    verifiedResult: input.outcome.decision,
    ...(input.actualState ? { actualState: input.actualState } : {}),
    ...(input.terminal ? { terminal: input.terminal } : {}),
    acceptanceLedgerAfter: input.acceptanceLedgerAfter,
    realizedRewardMicros: input.realizedRewardMicros,
    modelMatch: input.modelMatch,
    modelSha256: input.decision.modelSha256,
    snapshotSha256: input.snapshot.project.snapshotHash,
    createdAt: now()
  };
}

export const now = () => new Date().toISOString();
