import type { ProjectGraph, ProjectGraphNode } from "../../shared/domain/automation.js";
import type {
  AuthorizationSnapshotV1,
  DecisionGuardContextV4,
  DecisionPolicyScope,
  ProjectScopedRewardDecisionStrategyV4
} from "../../shared/domain/decisionModel.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";
import { resolveAllAdmissibleActions } from "./AdmissibleActionResolver.js";
import { canonicalDecisionModel } from "./DecisionModelCanonical.js";
import { acceptanceProgressCatalog } from "./DecisionStateProjector.js";
import { compileRewardPolicy } from "./RewardMdpCompiler.js";

export interface PolicyScopeDescriptor {
  scope: DecisionPolicyScope;
  graphNodeId?: string;
  strategy: ProjectScopedRewardDecisionStrategyV4;
  stateIds: string[];
  actionIds: string[];
  outcomeIdsByAction: Record<string, string[]>;
  terminalOutcomeIds: string[];
  acceptanceProgressPpmByState: Record<string, number>;
}

export function describePolicyScope(
  graph: ProjectGraph,
  scope: DecisionPolicyScope,
  graphNodeId?: string
): PolicyScopeDescriptor {
  if (scope === "graph") {
    const ids = graph.graphNodes.map(({ id }) => id);
    return {
      scope,
      strategy: graph.strategy,
      stateIds: ids,
      actionIds: [...ids],
      outcomeIdsByAction: Object.fromEntries(graph.graphNodes.map((node) => [
        node.id, node.outcomes.map(({ outcomeId }) => outcomeId)
      ])),
      terminalOutcomeIds: [],
      acceptanceProgressPpmByState: acceptanceProgressCatalog(graph)
    };
  }
  const graphNode = requireGraphNode(graph, graphNodeId);
  const ids = graphNode.actionNodes.map(({ id }) => id);
  return {
    scope,
    graphNodeId: graphNode.id,
    strategy: graphNode.strategy,
    stateIds: ids,
    actionIds: [...ids],
    outcomeIdsByAction: Object.fromEntries(graphNode.actionNodes.map((node) => [
      node.id, node.outcomes.map(({ outcomeId }) => outcomeId)
    ])),
    terminalOutcomeIds: graphNode.outcomes.map(({ outcomeId }) => outcomeId),
    acceptanceProgressPpmByState: Object.fromEntries(ids.map((id) => [id, 0]))
  };
}

export function scopedDecisionModelSha256(descriptor: PolicyScopeDescriptor): string {
  return jsonSha256({
    scope: descriptor.scope,
    ...(descriptor.graphNodeId ? { graphNodeId: descriptor.graphNodeId } : {}),
    ownedNodeIds: descriptor.stateIds,
    model: canonicalDecisionModel(descriptor.strategy.model),
    acceptanceProgressPpmByState: descriptor.acceptanceProgressPpmByState
  } as unknown as import("../../shared/domain/automation.js").JsonValue);
}

export function compilePolicyScope(
  graph: ProjectGraph,
  scope: DecisionPolicyScope,
  context: DecisionGuardContextV4,
  graphNodeId?: string
) {
  const descriptor = describePolicyScope(graph, scope, graphNodeId);
  const modelSha256 = scopedDecisionModelSha256(descriptor);
  return compileRewardPolicy({
    ...descriptor,
    model: descriptor.strategy.model,
    admissibleActionsByState: resolveAllAdmissibleActions(
      descriptor.strategy, descriptor.actionIds, context
    ),
    modelSha256
  });
}

export function initialPolicyStateId(graph: ProjectGraph, scope: DecisionPolicyScope, graphNodeId?: string): string {
  return describePolicyScope(graph, scope, graphNodeId).strategy.model.initialStateId;
}

export function policyGuardContext(input: {
  graphState: import("../../shared/domain/automation.js").JsonValue;
  stateRevision: number;
  authorization: AuthorizationSnapshotV1;
  acceptanceLedger: import("../../shared/domain/decisionModel.js").AcceptanceLedgerSnapshotV1;
}): DecisionGuardContextV4 {
  return {
    projectState: input.graphState,
    stateRevision: input.stateRevision,
    authorization: input.authorization,
    acceptanceLedger: input.acceptanceLedger,
    evidenceRefs: [input.authorization.sha256, input.acceptanceLedger.sha256]
  };
}

export function requireGraphNode(graph: ProjectGraph, graphNodeId?: string): ProjectGraphNode {
  const graphNode = graph.graphNodes.find(({ id }) => id === graphNodeId);
  if (!graphNode) throw new Error(`Graph Node ${graphNodeId ?? "<missing>"} is outside the decision scope.`);
  return graphNode;
}
