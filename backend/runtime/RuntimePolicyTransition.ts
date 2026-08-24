import type {
  ProjectAcceptanceEffect,
  ProjectGraph,
  ProjectGraphNode,
  ProjectIntrinsicOutcome
} from "../../shared/domain/automation.js";
import type {
  AcceptanceLedgerSnapshotV1,
  DecisionActionModelRowV4,
  DecisionTransitionV4,
  PolicyDecisionRecordV5,
  PolicyOptionObservationV5
} from "../../shared/domain/decisionModel.js";
import type {
  NodeRun,
  RootExecutionSnapshot,
  ValidationNodeOutcome
} from "../../shared/domain/runtime.js";
import { decisionState } from "../policy/DecisionStateProjector.js";
import { rewardBreakdown } from "../policy/RewardMdpCompiler.js";
import { observationRecord } from "./RuntimeFlowSupport.js";

export function buildLocalObservation(input: {
  snapshot: RootExecutionSnapshot;
  node: NodeRun;
  outcome: ValidationNodeOutcome;
  graphNode: ProjectGraphNode;
  decision: PolicyDecisionRecordV5;
  row: DecisionActionModelRowV4;
  branch: DecisionTransitionV4;
  ledgerAfter: AcceptanceLedgerSnapshotV1;
  stateRevision: number;
}): PolicyOptionObservationV5 {
  const actualState = input.branch.target.kind === "state" ? decisionState({
    scope: "graph_node",
    graphNodeId: input.graphNode.id,
    stateId: input.branch.target.stateId,
    graph: input.snapshot.graph,
    sourceStateRevision: input.stateRevision,
    evidenceRefs: [input.snapshot.authorization.sha256, input.ledgerAfter.sha256]
  }) : undefined;
  const realizedRewardMicros = rewardBreakdown(
    input.graphNode.strategy.model,
    0,
    0,
    input.branch
  ).netRewardMicros;
  return observationRecord({
    snapshot: input.snapshot,
    decision: input.decision,
    actionInvocationId: input.node.actionNodeInvocationId!,
    graphNodeInvocationId: input.node.graphNodeInvocationId,
    outcome: input.outcome,
    distribution: input.row.successors,
    actualState,
    terminal: input.branch.target.kind === "terminal" ? input.branch.target.terminal : undefined,
    emittedOutcomeId: input.branch.target.kind === "terminal" ? input.branch.target.emitOutcomeId : undefined,
    realizedRewardMicros,
    modelMatch: "match",
    acceptanceLedgerAfter: input.ledgerAfter
  });
}

export function buildGlobalObservation(input: {
  snapshot: RootExecutionSnapshot;
  graphNodeInvocationId: string;
  decision: PolicyDecisionRecordV5;
  row: DecisionActionModelRowV4;
  branch: DecisionTransitionV4;
  result: ProjectIntrinsicOutcome["result"];
  emittedOutcomeId: string;
  validationOutcome: ValidationNodeOutcome;
  ledgerBefore: AcceptanceLedgerSnapshotV1;
  ledgerAfter: AcceptanceLedgerSnapshotV1;
  stateRevision: number;
}): PolicyOptionObservationV5 {
  const actualState = input.branch.target.kind === "state" ? decisionState({
    scope: "graph",
    stateId: input.branch.target.stateId,
    graph: input.snapshot.graph,
    sourceStateRevision: input.stateRevision,
    evidenceRefs: [input.snapshot.authorization.sha256, input.ledgerAfter.sha256]
  }) : undefined;
  const observedOutcome: ValidationNodeOutcome = {
    ...input.validationOutcome,
    outcomeId: input.emittedOutcomeId,
    decision: input.result,
    ...(input.result === "PASS" ? { disposition: undefined } : {})
  };
  const realizedRewardMicros = rewardBreakdown(
    input.snapshot.graph.strategy.model,
    boundLedgerProgressPpm(input.snapshot.graph, input.ledgerBefore),
    boundLedgerProgressPpm(input.snapshot.graph, input.ledgerAfter),
    input.branch
  ).netRewardMicros;
  return observationRecord({
    snapshot: input.snapshot,
    decision: input.decision,
    actionInvocationId: input.graphNodeInvocationId,
    graphNodeInvocationId: input.graphNodeInvocationId,
    outcome: observedOutcome,
    distribution: input.row.successors,
    actualState,
    terminal: input.branch.target.kind === "terminal" ? input.branch.target.terminal : undefined,
    realizedRewardMicros,
    modelMatch: "match",
    acceptanceLedgerAfter: input.ledgerAfter
  });
}

export function requirePolicyRow(
  rows: DecisionActionModelRowV4[],
  stateId: string,
  actionId: string
): DecisionActionModelRowV4 {
  const row = rows.find((candidate) => candidate.stateId === stateId && candidate.actionId === actionId);
  if (!row) throw new Error(`Policy cell ${stateId}/${actionId} is outside the immutable decision model.`);
  return row;
}

export function requirePolicyBranch(
  row: DecisionActionModelRowV4,
  outcomeId: string
): DecisionTransitionV4 {
  const branch = row.successors.find((candidate) => candidate.outcomeId === outcomeId);
  if (!branch) throw new Error(`Outcome ${outcomeId} is outside policy cell ${row.stateId}/${row.actionId}.`);
  return branch;
}

export function expectedAcceptanceEffects(
  graphNode: ProjectGraphNode,
  branch: DecisionTransitionV4
): ProjectAcceptanceEffect[] {
  if (branch.target.kind !== "terminal" || !branch.target.emitOutcomeId) return [];
  const emittedOutcomeId = branch.target.emitOutcomeId;
  return graphNode.outcomes.find(({ outcomeId }) =>
    outcomeId === emittedOutcomeId)?.acceptanceEffects ?? [];
}

export function acceptanceEffectsMatch(
  outcome: ValidationNodeOutcome,
  expected: ProjectAcceptanceEffect[]
): boolean {
  const expectedVerify = obligationIds(expected, "verified");
  const expectedInvalidate = obligationIds(expected, "invalidated");
  const actualVerify = [...outcome.acceptance.verifyObligationIds].sort();
  const actualInvalidate = [...outcome.acceptance.invalidateObligationIds].sort();
  return JSON.stringify(expectedVerify) === JSON.stringify(actualVerify)
    && JSON.stringify(expectedInvalidate) === JSON.stringify(actualInvalidate)
    && (expected.length === 0 || outcome.acceptance.evidenceRefs.length > 0);
}

function obligationIds(
  effects: ProjectAcceptanceEffect[],
  status: ProjectAcceptanceEffect["status"]
): string[] {
  return effects.filter((effect) => effect.status === status).map(({ obligationId }) => obligationId).sort();
}

function boundLedgerProgressPpm(graph: ProjectGraph, ledger: AcceptanceLedgerSnapshotV1): number {
  const bound = new Set(graph.graphNodes.flatMap(({ acceptanceObligationId }) =>
    acceptanceObligationId ? [acceptanceObligationId] : []));
  const entries = ledger.entries.filter(({ obligationId }) => bound.has(obligationId));
  const total = entries.reduce((sum, { weight }) => sum + weight, 0);
  const verified = entries.reduce(
    (sum, entry) => sum + (entry.status === "verified" ? entry.weight : 0),
    0
  );
  return total === 0 ? 0 : Math.round(verified * 1_000_000 / total);
}
