import type Database from "better-sqlite3";
import type { ProjectActionNode, ProjectGraphNode } from "../../shared/domain/automation.js";
import type { PolicyDecisionRecordV5 } from "../../shared/domain/decisionModel.js";
import { maxControlFlowTransitions, type RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import { resolveAdmissibleActions } from "../policy/AdmissibleActionResolver.js";
import { decisionState } from "../policy/DecisionStateProjector.js";
import { describePolicyScope, policyGuardContext } from "../policy/PolicyScope.js";
import {
  type DecisionInput,
  now,
  policyDecisionRecord,
  requireGraphNode,
  rootExecutionSnapshot
} from "./RuntimeFlowSupport.js";
import type { RuntimeEventStore } from "./RuntimeEventStore.js";
import type { RuntimeInvocationStore } from "./RuntimeInvocationStore.js";
import type { RuntimePolicyStore } from "./RuntimePolicyStore.js";
import type { RuntimeStateStore } from "./RuntimeStateStore.js";

export class RuntimeDecisionDispatcher {
  constructor(
    private readonly connection: () => Database.Database,
    private readonly invocations: RuntimeInvocationStore,
    private readonly policies: RuntimePolicyStore,
    private readonly states: RuntimeStateStore,
    private readonly events: RuntimeEventStore,
    private readonly terminalize: (rootRunId: string, status: string, message: string) => void
  ) {}

  decideGlobal(
    rootRunId: string,
    stateId: string,
    epochKind: "start" | "continuation",
    previousActionInvocationId?: string
  ): void {
    const snapshot = this.snapshot(rootRunId);
    const state = decisionState({
      scope: "graph",
      stateId,
      graph: snapshot.graph,
      sourceStateRevision: this.states.revision(rootRunId),
      evidenceRefs: [snapshot.authorization.sha256, this.policies.ledger(rootRunId).sha256]
    });
    const decision = this.decide(rootRunId, { epochKind, state, previousActionInvocationId });
    if (!decision?.selectedActionId) return;
    this.createGraphNode(
      rootRunId,
      requireGraphNode(snapshot, decision.selectedActionId),
      "policy",
      decision.policyDecisionId
    );
  }

  decideLocal(
    rootRunId: string,
    graphNodeInvocationId: string,
    stateId: string,
    epochKind: "start" | "continuation",
    previousActionInvocationId?: string
  ): void {
    const snapshot = this.snapshot(rootRunId);
    const graphNode = this.invocations.graphNode(graphNodeInvocationId).snapshot;
    const state = decisionState({
      scope: "graph_node",
      graphNodeId: graphNode.id,
      stateId,
      graph: snapshot.graph,
      sourceStateRevision: this.states.revision(rootRunId),
      evidenceRefs: [snapshot.authorization.sha256, this.policies.ledger(rootRunId).sha256]
    });
    const decision = this.decide(rootRunId, {
      epochKind,
      state,
      graphNodeInvocationId,
      previousActionInvocationId
    });
    if (!decision?.selectedActionId) return;
    const action = graphNode.actionNodes.find(({ id }) => id === decision.selectedActionId);
    if (!action) throw new Error(`Action Node ${decision.selectedActionId} is outside Graph Node ${graphNode.id}.`);
    this.dispatchAction(rootRunId, graphNodeInvocationId, graphNode, action, decision.policyDecisionId);
  }

  createGraphNode(
    rootRunId: string,
    graphNode: ProjectGraphNode,
    source: "policy" | "root",
    policyDecisionId?: string
  ) {
    const invocation = this.invocations.createGraphNode(rootRunId, graphNode, source, policyDecisionId);
    this.events.append(rootRunId, "graph_node_dispatched", {
      stateRevision: this.states.revision(rootRunId),
      graphNodeInvocationId: invocation.graphNodeInvocationId,
      policyDecisionId
    });
    if (source === "policy") {
      this.decideLocal(
        rootRunId,
        invocation.graphNodeInvocationId,
        graphNode.strategy.model.initialStateId,
        "start"
      );
    }
    return invocation;
  }

  private decide(rootRunId: string, input: DecisionInput): PolicyDecisionRecordV5 | undefined {
    if (!this.incrementTransition(rootRunId)) {
      this.terminalize(
        rootRunId,
        "blocked",
        `Root Run reached the ${maxControlFlowTransitions} combined policy decision limit.`
      );
      return undefined;
    }
    const snapshot = this.snapshot(rootRunId);
    const descriptor = describePolicyScope(snapshot.graph, input.state.scope, input.state.graphNodeId);
    const guardContext = policyGuardContext({
      graphState: this.states.current(rootRunId),
      stateRevision: this.states.revision(rootRunId),
      authorization: snapshot.authorization,
      acceptanceLedger: this.policies.ledger(rootRunId)
    });
    const admissible = resolveAdmissibleActions(
      descriptor.strategy,
      input.state.stateId,
      descriptor.actionIds,
      guardContext
    );
    const compiledPolicy = input.state.scope === "graph"
      ? snapshot.compiledPolicies.global
      : snapshot.compiledPolicies.graphNodes[input.state.graphNodeId!];
    const compiled = compiledPolicy?.states.find(({ stateId }) => stateId === input.state.stateId);
    const selectedActionId = compiled?.selectedActionId;
    const valid = Boolean(selectedActionId && admissible.actionIds.includes(selectedActionId));
    const decision = policyDecisionRecord({
      connection: this.connection(),
      snapshot,
      rootRunId,
      decision: input,
      admissible,
      compiled: valid ? compiled : undefined
    });
    this.policies.insertDecision(decision);
    if (!valid || !selectedActionId) {
      this.events.append(rootRunId, "policy_invalid", {
        stateRevision: this.states.revision(rootRunId),
        graphNodeInvocationId: input.graphNodeInvocationId,
        policyDecisionId: decision.policyDecisionId
      });
      this.terminalize(rootRunId, "blocked", "Compiled policy selected no admissible action.");
      return undefined;
    }
    this.events.append(rootRunId, "policy_decided", {
      stateRevision: this.states.revision(rootRunId),
      graphNodeInvocationId: input.graphNodeInvocationId,
      policyDecisionId: decision.policyDecisionId
    });
    return decision;
  }

  private dispatchAction(
    rootRunId: string,
    graphInvocationId: string,
    graph: ProjectGraphNode,
    action: ProjectActionNode,
    policyDecisionId: string
  ): void {
    const invocation = this.invocations.createAction(
      rootRunId,
      graphInvocationId,
      graph,
      action,
      policyDecisionId
    );
    const work = this.invocations.createNode({
      rootRunId,
      graphNodeInvocationId: graphInvocationId,
      actionNodeInvocationId: invocation.actionNodeInvocationId,
      graphNodeId: graph.id,
      actionNodeId: action.id,
      role: "work",
      nodeDefinitionId: action.workNode.id,
      attempt: 1
    });
    this.events.append(rootRunId, "action_node_dispatched", {
      stateRevision: this.states.revision(rootRunId),
      graphNodeInvocationId: graphInvocationId,
      actionNodeInvocationId: invocation.actionNodeInvocationId,
      targetNodeRunId: work.nodeRunId,
      policyDecisionId
    });
  }

  private incrementTransition(rootRunId: string): boolean {
    const result = this.connection().prepare(`
      UPDATE root_runs SET transition_count = transition_count + 1, updated_at = ?
      WHERE root_run_id = ? AND transition_count < ?
    `).run(now(), rootRunId, maxControlFlowTransitions);
    return result.changes === 1;
  }

  private snapshot(rootRunId: string): RootExecutionSnapshot {
    return rootExecutionSnapshot(this.connection(), rootRunId);
  }
}
