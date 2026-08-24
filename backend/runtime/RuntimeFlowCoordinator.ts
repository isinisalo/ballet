import type Database from "better-sqlite3";
import type { ProjectGraphNode } from "../../shared/domain/automation.js";
import type {
  AcceptanceLedgerSnapshotV1,
  DecisionActionModelRowV4,
  DecisionTransitionV4,
  PolicyDecisionRecordV5
} from "../../shared/domain/decisionModel.js";
import type {
  CanonicalNodeOutcome,
  NodeRun,
  RootExecutionSnapshot,
  ValidationNodeOutcome,
  WorkNodeOutcome
} from "../../shared/domain/runtime.js";
import type { TaskEnvelopeV9 } from "../../shared/domain/taskEnvelope.js";
import { RuntimeDecisionDispatcher } from "./RuntimeDecisionDispatcher.js";
import { RuntimeEventStore } from "./RuntimeEventStore.js";
import {
  assertValidationOutcome,
  cancelRuntimeInvocations,
  eventDetail,
  actionDefinition,
  now,
  requireGraphNode,
  rootExecutionSnapshot,
  setRootRunStatus,
  terminalStatus,
  writeRootTerminal
} from "./RuntimeFlowSupport.js";
import { RuntimeInvocationStore } from "./RuntimeInvocationStore.js";
import { RuntimePolicyStore } from "./RuntimePolicyStore.js";
import {
  acceptanceEffectsMatch,
  buildGlobalObservation,
  buildLocalObservation,
  expectedAcceptanceEffects,
  requirePolicyBranch,
  requirePolicyRow
} from "./RuntimePolicyTransition.js";
import { RuntimeStateStore } from "./RuntimeStateStore.js";
import { RuntimeTaskEnvelopeBuilder } from "./RuntimeTaskEnvelopeBuilder.js";

export class RuntimeFlowCoordinator {
  private readonly envelopes: RuntimeTaskEnvelopeBuilder;
  private readonly decisions: RuntimeDecisionDispatcher;

  constructor(
    private readonly connection: () => Database.Database,
    private readonly invocations: RuntimeInvocationStore,
    private readonly policies: RuntimePolicyStore,
    private readonly states: RuntimeStateStore,
    private readonly events: RuntimeEventStore
  ) {
    this.envelopes = new RuntimeTaskEnvelopeBuilder(connection, invocations, policies, states);
    this.decisions = new RuntimeDecisionDispatcher(
      connection,
      invocations,
      policies,
      states,
      events,
      (rootRunId, status, message) => this.terminalize(rootRunId, status, undefined, message)
    );
  }

  initialize(rootRunId: string): void {
    const snapshot = this.snapshot(rootRunId);
    this.policies.initializeLedger(rootRunId, snapshot.acceptanceLedger);
    this.setRootStatus(rootRunId, "running");
    if (snapshot.rootKind === "graph_node") {
      const graphNode = requireGraphNode(snapshot, snapshot.rootGraphNodeId!);
      const invocation = this.decisions.createGraphNode(rootRunId, graphNode, "root");
      this.decisions.decideLocal(
        rootRunId,
        invocation.graphNodeInvocationId,
        graphNode.strategy.model.initialStateId,
        "start"
      );
    } else this.decisions.decideGlobal(rootRunId, snapshot.graph.strategy.model.initialStateId, "start");
  }

  applyOutcome(rootRunId: string, nodeRunId: string, outcome: CanonicalNodeOutcome): void {
    const node = this.invocations.requireNode(nodeRunId);
    if (node.rootRunId !== rootRunId || node.role !== outcome.role) throw new Error("Node outcome is outside its execution contract.");
    const correctableMismatch = node.status === "waiting_for_input" && node.role === "validation";
    if (!correctableMismatch && node.status !== "running" && node.status !== "queued") {
      throw new Error(`Node Run ${nodeRunId} cannot accept an outcome.`);
    }
    if (correctableMismatch) this.setRootStatus(rootRunId, "running");
    if (outcome.role === "work") this.afterWork(node, outcome);
    else this.afterValidation(node, outcome);
  }

  buildTaskEnvelope(nodeRunId: string): TaskEnvelopeV9 { return this.envelopes.build(nodeRunId); }

  cancel(rootRunId: string): void {
    cancelRuntimeInvocations(this.connection(), rootRunId);
    this.setRootStatus(rootRunId, "cancelled");
    this.events.append(rootRunId, "root_cancelled", { stateRevision: this.states.revision(rootRunId) });
  }

  failNode(rootRunId: string, nodeRunId: string, status: "failed" | "cancelled", message: string): void {
    const node = this.invocations.requireNode(nodeRunId);
    if (node.rootRunId !== rootRunId) throw new Error(`Node Run ${nodeRunId} is outside Root Run ${rootRunId}.`);
    const at = now();
    this.connection().prepare(`
      UPDATE node_runs SET status = ?, error_code = 'execution_failed', error_message = ?, updated_at = ?, completed_at = ?
      WHERE node_run_id = ?
    `).run(status, message, at, at, nodeRunId);
    this.terminalize(rootRunId, status === "cancelled" ? "cancelled" : "failed", undefined, message);
    this.events.append(rootRunId, "execution_interrupted", {
      stateRevision: this.states.revision(rootRunId), graphNodeInvocationId: node.graphNodeInvocationId,
      actionNodeInvocationId: node.actionNodeInvocationId, sourceNodeRunId: nodeRunId
    });
  }

  setRootStatus(rootRunId: string, status: string): void { setRootRunStatus(this.connection(), rootRunId, status); }

  snapshot(rootRunId: string): RootExecutionSnapshot { return rootExecutionSnapshot(this.connection(), rootRunId); }

  private afterWork(node: NodeRun, outcome: WorkNodeOutcome): void {
    if (outcome.state === "needs_input") {
      this.invocations.setNodeOutcome(node.nodeRunId, outcome, "waiting_for_input");
      this.setRootStatus(node.rootRunId, "waiting_for_input");
      this.events.append(node.rootRunId, "root_needs_input", eventDetail(this.states, node));
      return;
    }
    if (outcome.state !== "completed") {
      this.invocations.setNodeOutcome(node.nodeRunId, outcome, outcome.state);
      this.terminalize(node.rootRunId, outcome.state, outcome, outcome.summary);
      return;
    }
    if (outcome.statePatch) this.states.apply(node.rootRunId, node.nodeRunId, outcome.statePatch, outcome);
    this.invocations.setNodeOutcome(node.nodeRunId, outcome, "completed");
    const action = actionDefinition(this.invocations, node);
    const validation = this.invocations.createNode({
      rootRunId: node.rootRunId,
      graphNodeInvocationId: node.graphNodeInvocationId!,
      actionNodeInvocationId: node.actionNodeInvocationId!,
      graphNodeId: node.graphNodeId!,
      actionNodeId: node.actionNodeId!,
      role: "validation",
      nodeDefinitionId: action.validationNode.id,
      attempt: node.attempt
    });
    this.events.append(node.rootRunId, "work_completed", {
      ...eventDetail(this.states, node), targetNodeRunId: validation.nodeRunId
    });
  }

  private afterValidation(node: NodeRun, outcome: ValidationNodeOutcome): void {
    const graphNodeInvocation = this.invocations.graphNode(node.graphNodeInvocationId!);
    const graphNode = graphNodeInvocation.snapshot;
    const action = actionDefinition(this.invocations, node);
    assertValidationOutcome(action, outcome);
    const actionInvocation = this.invocations.action(node.actionNodeInvocationId!);
    const decision = this.requireDecision(actionInvocation.policyDecisionId, "graph_node");
    const row = requirePolicyRow(graphNode.strategy.model.stateActions, decision.state.stateId, action.id);
    const branch = requirePolicyBranch(row, outcome.outcomeId);
    const retryAllowed = outcome.decision === "FAIL" && outcome.disposition === "retry" && node.attempt <= action.maxRetries;
    const expectedEffects = retryAllowed ? [] : expectedAcceptanceEffects(graphNode, branch);
    if (!acceptanceEffectsMatch(outcome, expectedEffects)) {
      this.invocations.setNodeOutcome(node.nodeRunId, outcome, "waiting_for_input");
      this.setRootStatus(node.rootRunId, "waiting_for_input");
      this.events.append(node.rootRunId, "acceptance_mismatch", {
        ...eventDetail(this.states, node), policyDecisionId: decision.policyDecisionId
      });
      return;
    }
    if (retryAllowed) {
      this.invocations.setNodeOutcome(node.nodeRunId, outcome, "completed");
      const work = this.invocations.createNode({
        rootRunId: node.rootRunId,
        graphNodeInvocationId: node.graphNodeInvocationId!,
        actionNodeInvocationId: node.actionNodeInvocationId!,
        graphNodeId: node.graphNodeId!,
        actionNodeId: node.actionNodeId!,
        role: "work",
        nodeDefinitionId: action.workNode.id,
        attempt: node.attempt + 1
      });
      this.events.append(node.rootRunId, "validation_fail_retry", {
        ...eventDetail(this.states, node), targetNodeRunId: work.nodeRunId
      });
      return;
    }
    const ledgerBefore = this.policies.ledger(node.rootRunId);
    if (outcome.statePatch) this.states.apply(node.rootRunId, node.nodeRunId, outcome.statePatch, outcome);
    const ledgerAfter = this.policies.applyAcceptance(node.rootRunId, node.nodeRunId, outcome.acceptance);
    this.invocations.setNodeOutcome(node.nodeRunId, outcome, "completed");
    this.invocations.completeAction(node.actionNodeInvocationId!);
    this.events.append(node.rootRunId, outcome.decision === "PASS" ? "validation_pass" : "validation_fail_escalate",
      eventDetail(this.states, node));
    const localResult = this.observeLocal(
      node, outcome, graphNode, decision, row, branch, ledgerAfter
    );
    if (branch.target.kind === "state") {
      this.decisions.decideLocal(
        node.rootRunId,
        node.graphNodeInvocationId!,
        branch.target.stateId,
        "continuation",
        node.actionNodeInvocationId
      );
      return;
    }
    this.invocations.completeGraphNode(
      graphNodeInvocation.graphNodeInvocationId,
      branch.target.terminal === "success" ? "completed" : branch.target.terminal === "failure" ? "failed" : "blocked"
    );
    const snapshot = this.snapshot(node.rootRunId);
    if (snapshot.rootKind === "graph_node") {
      this.events.append(node.rootRunId, "policy_terminal", {
        ...eventDetail(this.states, node), policyDecisionId: decision.policyDecisionId
      });
      this.terminalize(node.rootRunId, terminalStatus(branch.target.terminal), outcome, outcome.summary);
      return;
    }
    this.observeGlobal(
      node.rootRunId,
      graphNodeInvocation.graphNodeInvocationId,
      localResult.emittedOutcomeId!,
      outcome,
      ledgerBefore,
      ledgerAfter
    );
  }

  private observeLocal(
    node: NodeRun,
    outcome: ValidationNodeOutcome,
    graphNode: ProjectGraphNode,
    decision: PolicyDecisionRecordV5,
    row: DecisionActionModelRowV4,
    branch: DecisionTransitionV4,
    ledgerAfter: AcceptanceLedgerSnapshotV1
  ): { emittedOutcomeId?: string } {
    const snapshot = this.snapshot(node.rootRunId);
    this.policies.insertObservation(buildLocalObservation({
      snapshot,
      node,
      graphNode,
      decision,
      outcome,
      row,
      branch,
      ledgerAfter,
      stateRevision: this.states.revision(node.rootRunId)
    }));
    this.events.append(node.rootRunId, "policy_observed", {
      ...eventDetail(this.states, node), policyDecisionId: decision.policyDecisionId
    });
    return { emittedOutcomeId: branch.target.kind === "terminal" ? branch.target.emitOutcomeId : undefined };
  }

  private observeGlobal(
    rootRunId: string,
    graphNodeInvocationId: string,
    emittedOutcomeId: string,
    validationOutcome: ValidationNodeOutcome,
    ledgerBefore: AcceptanceLedgerSnapshotV1,
    ledgerAfter: AcceptanceLedgerSnapshotV1
  ): void {
    const invocation = this.invocations.graphNode(graphNodeInvocationId);
    const decision = this.requireDecision(invocation.policyDecisionId!, "graph");
    const snapshot = this.snapshot(rootRunId);
    const row = requirePolicyRow(
      snapshot.graph.strategy.model.stateActions,
      decision.state.stateId,
      invocation.graphNodeId
    );
    const branch = requirePolicyBranch(row, emittedOutcomeId);
    const graphOutcome = invocation.snapshot.outcomes.find(({ outcomeId }) => outcomeId === emittedOutcomeId);
    if (!graphOutcome) throw new Error(`Emitted outcome ${emittedOutcomeId} is outside Graph Node ${invocation.graphNodeId}.`);
    this.policies.insertObservation(buildGlobalObservation({
      snapshot,
      graphNodeInvocationId,
      decision,
      row,
      branch,
      result: graphOutcome.result,
      emittedOutcomeId,
      validationOutcome,
      ledgerBefore,
      ledgerAfter,
      stateRevision: this.states.revision(rootRunId)
    }));
    this.events.append(rootRunId, "policy_observed", {
      stateRevision: this.states.revision(rootRunId),
      graphNodeInvocationId,
      policyDecisionId: decision.policyDecisionId
    });
    if (branch.target.kind === "state") {
      this.decisions.decideGlobal(rootRunId, branch.target.stateId, "continuation", graphNodeInvocationId);
      return;
    }
    this.events.append(rootRunId, "policy_terminal", {
      stateRevision: this.states.revision(rootRunId),
      graphNodeInvocationId,
      policyDecisionId: decision.policyDecisionId
    });
    this.terminalize(rootRunId, terminalStatus(branch.target.terminal), validationOutcome, validationOutcome.summary);
  }

  private requireDecision(policyDecisionId: string, scope: "graph" | "graph_node"): PolicyDecisionRecordV5 {
    const decision = this.policies.decision(policyDecisionId);
    if (!decision || decision.scope !== scope) throw new Error(`Policy decision ${policyDecisionId} is outside ${scope} scope.`);
    return decision;
  }

  private terminalize(rootRunId: string, status: string, outcome?: CanonicalNodeOutcome, message?: string): void {
    writeRootTerminal(this.connection(), rootRunId, status, outcome, message);
    this.events.append(rootRunId, "root_terminal", { stateRevision: this.states.revision(rootRunId) });
  }

}
