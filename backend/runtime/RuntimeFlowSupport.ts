import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { ProjectGraphNode, ProjectActionNode } from "../../shared/domain/automation.js";
import type {
  DecisionStateV3,
  PolicyCostMeasureV1,
  PolicyDecisionRecordV3,
  PolicyOptionObservationV4
} from "../../shared/domain/decisionModel.js";
import type {
  NodeRun,
  RootExecutionSnapshot,
  ValidationNodeOutcome
} from "../../shared/domain/runtime.js";
import type { resolveAdmissibleActions } from "../policy/AdmissibleActionResolver.js";
import type { RuntimeInvocationStore } from "./RuntimeInvocationStore.js";
import type { RuntimeStateStore } from "./RuntimeStateStore.js";

type Row = Record<string, unknown>;

export interface DecisionInput {
  epochKind: "start" | "continuation";
  previousActionId?: string;
  previousActionResult?: "PASS" | "FAIL";
  previousOutcomeId?: string;
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

export function rootExecutionSnapshot(connection: Database.Database, rootRunId: string): RootExecutionSnapshot {
  const row = connection.prepare("SELECT execution_snapshot_json FROM root_runs WHERE root_run_id = ?")
    .get(rootRunId) as Row | undefined;
  if (!row) throw new Error(`Root Run ${rootRunId} was not found.`);
  return JSON.parse(String(row.execution_snapshot_json)) as RootExecutionSnapshot;
}

export function policyDecisionRecord(
  connection: Database.Database,
  snapshot: RootExecutionSnapshot,
  rootRunId: string,
  previous: DecisionInput,
  state: DecisionStateV3,
  admissible: ReturnType<typeof resolveAdmissibleActions>,
  compiled: RootExecutionSnapshot["compiledPolicy"]["states"][number] | undefined
): PolicyDecisionRecordV3 {
  const epoch = Number((connection.prepare(
    "SELECT COUNT(*) AS count FROM policy_decisions WHERE root_run_id = ?"
  ).get(rootRunId) as Row).count) + 1;
  const deniedValues = admissible.excludedActions.filter(({ reasonCode }) => reasonCode === "authorization_denied")
    .map(({ actionId }) => ({ actionId, qMicros: 0 }));
  return {
    version: 3, policyDecisionId: randomUUID(), rootRunId, epoch, epochKind: previous.epochKind,
    previousActionInvocationId: previous.previousActionInvocationId, state,
    admissibleActionIds: admissible.actionIds, excludedActions: admissible.excludedActions,
    selectedActionId: compiled?.selectedActionId,
    actionValues: [...(compiled?.actionValues ?? []), ...deniedValues].sort((a, b) => a.actionId.localeCompare(b.actionId)),
    stateValueMicros: compiled?.valueMicros, solverStatus: compiled ? "compiled" : "policy_model_invalid",
    modelSha256: snapshot.decisionModel.modelSha256, policySha256: snapshot.compiledPolicy.policySha256,
    snapshotSha256: snapshot.project.snapshotHash,
    message: compiled ? undefined : "Compiled policy has no row for the projected state.", createdAt: now()
  };
}

export function actionDefinition(invocations: RuntimeInvocationStore, node: NodeRun): ProjectActionNode {
  const graph = invocations.graphNode(node.graphNodeInvocationId!).snapshot;
  const action = graph.actionNodes.find(({ id }) => id === node.actionNodeId);
  if (!action) throw new Error(`Action Node ${node.actionNodeId} is outside its immutable Graph Node snapshot.`);
  return action;
}

export function latestValidation(connection: Database.Database, rootRunId: string): ValidationNodeOutcome | undefined {
  const row = connection.prepare(`
    SELECT outcome_json FROM node_runs WHERE root_run_id = ? AND role = 'validation' AND outcome_json IS NOT NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(rootRunId) as Row | undefined;
  return row ? JSON.parse(String(row.outcome_json)) as ValidationNodeOutcome : undefined;
}

export function requireGraphNode(snapshot: RootExecutionSnapshot, id: string): ProjectGraphNode {
  const graphNode = snapshot.graph.graphNodes.find((candidate) => candidate.id === id);
  if (!graphNode) throw new Error(`Graph Node ${id} is outside the immutable snapshot.`);
  return graphNode;
}

export function nextAction(graphNode: ProjectGraphNode, currentId: string): ProjectActionNode | undefined {
  const index = graphNode.actionNodes.findIndex(({ id }) => id === currentId);
  return index < 0 ? undefined : graphNode.actionNodes[index + 1];
}

export function assertValidationOutcome(
  graph: ProjectGraphNode,
  action: ProjectActionNode,
  outcome: ValidationNodeOutcome
): void {
  const intrinsic = action.outcomes.find(({ outcomeId }) => outcomeId === outcome.outcomeId);
  if (!intrinsic || intrinsic.result !== outcome.decision) throw new Error("Validation outcome violates the Action Node semantic enum.");
  const terminalForOption = outcome.decision === "FAIL" || nextAction(graph, action.id) === undefined;
  if (terminalForOption && !graph.outcomes.some(({ outcomeId, result }) =>
    outcomeId === outcome.outcomeId && result === outcome.decision)) {
    throw new Error("Graph Node completion outcome violates its semantic enum.");
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

export function observationRecord(
  snapshot: RootExecutionSnapshot,
  decision: PolicyDecisionRecordV3,
  invocation: ReturnType<RuntimeInvocationStore["graphNode"]>,
  outcome: ValidationNodeOutcome,
  distribution: PolicyOptionObservationV4["expectedOutcomeDistribution"],
  actualState: DecisionStateV3,
  realizedRewardMicros: number,
  modelMatch: PolicyOptionObservationV4["modelMatch"],
  acceptanceLedgerAfter: PolicyOptionObservationV4["acceptanceLedgerAfter"]
): PolicyOptionObservationV4 {
  const unknown = (reason: "provider_not_reported" | "project_not_configured"): PolicyCostMeasureV1 =>
    ({ status: "unknown", reason, sourceRefs: [] });
  return {
    version: 4, policyObservationId: randomUUID(), rootRunId: decision.rootRunId,
    policyDecisionId: decision.policyDecisionId, actionInvocationId: invocation.graphNodeInvocationId,
    graphNodeInvocationId: invocation.graphNodeInvocationId, stateBefore: decision.state!, actionId: invocation.graphNodeId,
    expectedOutcomeDistribution: distribution, observedCost: {
      version: 1, attribution: { mode: "inclusive_v1", nodeRunIds: [], executionTaskIds: [] },
      dimensions: {
        durationMillis: unknown("provider_not_reported"), inputTokens: unknown("provider_not_reported"),
        outputTokens: unknown("provider_not_reported"), cachedInputTokens: unknown("provider_not_reported"),
        workRetryCount: unknown("project_not_configured"), monetaryMicros: unknown("project_not_configured")
      }
    }, observedOutcomeId: outcome.outcomeId, verifiedResult: outcome.decision, actualState,
    acceptanceLedgerAfter, realizedRewardMicros, modelMatch,
    modelSha256: snapshot.decisionModel.modelSha256, snapshotSha256: snapshot.project.snapshotHash, createdAt: now()
  };
}

export const now = () => new Date().toISOString();
