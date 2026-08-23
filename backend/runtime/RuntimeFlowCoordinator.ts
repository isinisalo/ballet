import type Database from "better-sqlite3";
import type { ProjectGraphNode, ProjectActionNode } from "../../shared/domain/automation.js";
import type {
  DecisionProjectionContextV3,
  DecisionStateV3
} from "../../shared/domain/decisionModel.js";
import type {
  CanonicalNodeOutcome,
  NodeRun,
  RootExecutionSnapshot,
  ValidationNodeOutcome,
  WorkNodeOutcome
} from "../../shared/domain/runtime.js";
import { maxControlFlowTransitions } from "../../shared/domain/runtime.js";
import type { TaskEnvelopeV9 } from "../../shared/domain/taskEnvelope.js";
import { resolveAdmissibleActions } from "../policy/AdmissibleActionResolver.js";
import { projectDecisionState } from "../policy/DecisionStateProjector.js";
import { rewardBreakdown } from "../policy/RewardMdpCompiler.js";
import { RuntimeEventStore } from "./RuntimeEventStore.js";
import {
  assertValidationOutcome,
  type DecisionInput,
  eventDetail,
  actionDefinition,
  latestValidation,
  nextAction,
  now,
  observationRecord,
  policyDecisionRecord,
  requireGraphNode,
  rootExecutionSnapshot,
  setRootRunStatus,
  terminalStatus
} from "./RuntimeFlowSupport.js";
import { RuntimeInvocationStore } from "./RuntimeInvocationStore.js";
import { RuntimePolicyStore } from "./RuntimePolicyStore.js";
import { RuntimeStateStore } from "./RuntimeStateStore.js";
import { RuntimeTaskEnvelopeBuilder } from "./RuntimeTaskEnvelopeBuilder.js";

type Row = Record<string, unknown>;

export class RuntimeFlowCoordinator {
  private readonly envelopes: RuntimeTaskEnvelopeBuilder;

  constructor(
    private readonly connection: () => Database.Database,
    private readonly invocations: RuntimeInvocationStore,
    private readonly policies: RuntimePolicyStore,
    private readonly states: RuntimeStateStore,
    private readonly events: RuntimeEventStore
  ) {
    this.envelopes = new RuntimeTaskEnvelopeBuilder(connection, invocations, policies, states);
  }

  initialize(rootRunId: string): void {
    const snapshot = this.snapshot(rootRunId);
    this.policies.initializeLedger(rootRunId, snapshot.acceptanceLedger);
    this.setRootStatus(rootRunId, "running");
    if (snapshot.rootKind === "graph_node") {
      this.dispatchGraphNode(rootRunId, requireGraphNode(snapshot, snapshot.rootGraphNodeId!), "root");
    } else this.decide(rootRunId, { epochKind: "start" });
  }

  applyOutcome(rootRunId: string, nodeRunId: string, outcome: CanonicalNodeOutcome): void {
    const node = this.invocations.requireNode(nodeRunId);
    if (node.rootRunId !== rootRunId || node.role !== outcome.role) throw new Error("Node outcome is outside its execution contract.");
    if (node.status !== "running" && node.status !== "queued") throw new Error(`Node Run ${nodeRunId} cannot accept an outcome.`);
    if (outcome.role === "work") this.afterWork(node, outcome);
    else this.afterValidation(node, outcome);
  }

  buildTaskEnvelope(nodeRunId: string): TaskEnvelopeV9 { return this.envelopes.build(nodeRunId); }

  cancel(rootRunId: string): void {
    const at = now();
    this.connection().prepare(`
      UPDATE node_runs SET status = 'cancelled', updated_at = ?, completed_at = ?
      WHERE root_run_id = ? AND status IN ('queued','running','waiting_for_input')
    `).run(at, at, rootRunId);
    this.connection().prepare(`
      UPDATE action_node_invocations SET status = 'cancelled', updated_at = ?, completed_at = ?
      WHERE root_run_id = ? AND status IN ('queued','running','waiting_for_input')
    `).run(at, at, rootRunId);
    this.connection().prepare(`
      UPDATE graph_node_invocations SET status = 'cancelled', updated_at = ?, completed_at = ?
      WHERE root_run_id = ? AND status IN ('queued','running','waiting_for_input')
    `).run(at, at, rootRunId);
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
      rootRunId: node.rootRunId, graphNodeInvocationId: node.graphNodeInvocationId!,
      actionNodeInvocationId: node.actionNodeInvocationId!, graphNodeId: node.graphNodeId!, actionNodeId: node.actionNodeId!,
      role: "validation", nodeDefinitionId: action.validationNode.id, attempt: node.attempt
    });
    this.events.append(node.rootRunId, "work_completed", {
      ...eventDetail(this.states, node), targetNodeRunId: validation.nodeRunId
    });
  }

  private afterValidation(node: NodeRun, outcome: ValidationNodeOutcome): void {
    const graph = this.invocations.graphNode(node.graphNodeInvocationId!).snapshot;
    const action = actionDefinition(this.invocations, node);
    assertValidationOutcome(graph, action, outcome);
    if (outcome.statePatch) this.states.apply(node.rootRunId, node.nodeRunId, outcome.statePatch, outcome);
    this.policies.applyAcceptance(node.rootRunId, node.nodeRunId, outcome.acceptance);
    this.invocations.setNodeOutcome(node.nodeRunId, outcome, "completed");
    const retryAllowed = outcome.decision === "FAIL" && outcome.disposition === "retry" && node.attempt <= action.maxRetries;
    if (retryAllowed) {
      const work = this.invocations.createNode({
        rootRunId: node.rootRunId, graphNodeInvocationId: node.graphNodeInvocationId!,
        actionNodeInvocationId: node.actionNodeInvocationId!, graphNodeId: node.graphNodeId!, actionNodeId: node.actionNodeId!,
        role: "work", nodeDefinitionId: action.workNode.id, attempt: node.attempt + 1
      });
      this.events.append(node.rootRunId, "validation_fail_retry", {
        ...eventDetail(this.states, node), targetNodeRunId: work.nodeRunId
      });
      return;
    }
    this.invocations.completeAction(node.actionNodeInvocationId!);
    if (outcome.decision === "PASS") {
      this.events.append(node.rootRunId, "validation_pass", eventDetail(this.states, node));
      const next = nextAction(graph, action.id);
      if (next) { this.dispatchAction(node.rootRunId, node.graphNodeInvocationId!, graph, next); return; }
    } else this.events.append(node.rootRunId, "validation_fail_escalate", eventDetail(this.states, node));
    this.completeGraphNode(node, outcome);
  }

  private completeGraphNode(node: NodeRun, outcome: ValidationNodeOutcome): void {
    const invocation = this.invocations.graphNode(node.graphNodeInvocationId!);
    this.invocations.completeGraphNode(invocation.graphNodeInvocationId,
      outcome.decision === "PASS" ? "completed" : "failed");
    const snapshot = this.snapshot(node.rootRunId);
    if (snapshot.rootKind === "graph_node") {
      this.terminalize(node.rootRunId, outcome.decision === "PASS" ? "completed" : "failed", outcome, outcome.summary);
      return;
    }
    this.observe(node.rootRunId, invocation.graphNodeInvocationId, outcome);
    this.decide(node.rootRunId, {
      epochKind: "continuation", previousActionId: invocation.graphNodeId,
      previousActionResult: outcome.decision, previousOutcomeId: outcome.outcomeId,
      previousActionInvocationId: invocation.graphNodeInvocationId
    });
  }

  private decide(rootRunId: string, previous: DecisionInput): void {
    const snapshot = this.snapshot(rootRunId);
    const state = this.projectState(rootRunId, previous);
    const definition = snapshot.graph.strategy.model.states.find(({ id }) => id === state.stateId)!;
    if (definition.terminal) {
      const latest = latestValidation(this.connection(), rootRunId);
      this.terminalize(rootRunId, terminalStatus(definition.terminal), latest, latest?.summary);
      return;
    }
    const graphNodeIds = snapshot.graph.graphNodes.map(({ id }) => id);
    const admissible = resolveAdmissibleActions(snapshot.graph.strategy, state, graphNodeIds);
    const compiled = snapshot.compiledPolicy.states.find(({ stateId }) => stateId === state.stateId);
    const selectedActionId = compiled?.selectedActionId;
    const valid = Boolean(selectedActionId && admissible.actionIds.includes(selectedActionId));
    const decision = policyDecisionRecord(
      this.connection(), snapshot, rootRunId, previous, state, admissible, valid ? compiled : undefined
    );
    this.policies.insertDecision(decision);
    if (!valid || !selectedActionId) {
      this.events.append(rootRunId, "policy_invalid", {
        stateRevision: this.states.revision(rootRunId), policyDecisionId: decision.policyDecisionId
      });
      this.terminalize(rootRunId, "blocked", undefined, "Compiled policy selected no admissible action.");
      return;
    }
    this.events.append(rootRunId, "policy_decided", {
      stateRevision: this.states.revision(rootRunId), policyDecisionId: decision.policyDecisionId
    });
    this.dispatchGraphNode(rootRunId, requireGraphNode(snapshot, selectedActionId), "policy", decision.policyDecisionId);
  }

  private dispatchGraphNode(
    rootRunId: string, graphNode: ProjectGraphNode, source: "policy" | "root", policyDecisionId?: string
  ): void {
    if (!this.incrementTransition(rootRunId)) {
      this.terminalize(rootRunId, "blocked", undefined,
        `Root Run reached the ${maxControlFlowTransitions} Graph Node transition limit.`);
      return;
    }
    const invocation = this.invocations.createGraphNode(rootRunId, graphNode, source, policyDecisionId);
    this.events.append(rootRunId, "graph_node_dispatched", {
      stateRevision: this.states.revision(rootRunId), graphNodeInvocationId: invocation.graphNodeInvocationId,
      policyDecisionId
    });
    this.dispatchAction(rootRunId, invocation.graphNodeInvocationId, graphNode, graphNode.actionNodes[0]!);
  }

  private dispatchAction(rootRunId: string, graphInvocationId: string, graph: ProjectGraphNode, action: ProjectActionNode): void {
    const invocation = this.invocations.createAction(rootRunId, graphInvocationId, graph, action);
    const work = this.invocations.createNode({
      rootRunId, graphNodeInvocationId: graphInvocationId, actionNodeInvocationId: invocation.actionNodeInvocationId,
      graphNodeId: graph.id, actionNodeId: action.id, role: "work", nodeDefinitionId: action.workNode.id, attempt: 1
    });
    this.events.append(rootRunId, "action_node_dispatched", {
      stateRevision: this.states.revision(rootRunId), graphNodeInvocationId: graphInvocationId,
      actionNodeInvocationId: invocation.actionNodeInvocationId, targetNodeRunId: work.nodeRunId
    });
  }

  private observe(rootRunId: string, graphInvocationId: string, outcome: ValidationNodeOutcome): void {
    const invocation = this.invocations.graphNode(graphInvocationId);
    const decision = this.policies.latestDecision(rootRunId);
    if (!decision?.state || decision.policyDecisionId !== invocation.policyDecisionId) throw new Error("Policy observation lacks its decision.");
    const snapshot = this.snapshot(rootRunId);
    const row = snapshot.graph.strategy.model.stateActions.find(({ stateId, actionId }) =>
      stateId === decision.state!.stateId && actionId === invocation.graphNodeId)!;
    const branch = row.successors.find(({ outcomeId }) => outcomeId === outcome.outcomeId);
    if (!branch) throw new Error(`Outcome ${outcome.outcomeId} is outside the selected MDP action.`);
    const actual = this.projectState(rootRunId, {
      epochKind: "continuation", previousActionId: invocation.graphNodeId,
      previousActionResult: outcome.decision, previousOutcomeId: outcome.outcomeId,
      previousActionInvocationId: graphInvocationId
    });
    const currentDefinition = snapshot.graph.strategy.model.states.find(({ id }) => id === decision.state!.stateId)!;
    const actualDefinition = snapshot.graph.strategy.model.states.find(({ id }) => id === actual.stateId)!;
    const realizedRewardMicros = rewardBreakdown(
      snapshot.graph.strategy.model, snapshot.graph.strategy.capabilityModel,
      currentDefinition, actualDefinition, outcome.outcomeId
    ).netRewardMicros;
    this.policies.insertObservation(observationRecord(
      snapshot, decision, invocation, outcome, row.successors, actual, realizedRewardMicros,
      actual.stateId === branch.nextStateId ? "match" : "state_miss", this.policies.ledger(rootRunId)
    ));
    this.events.append(rootRunId, "policy_observed", {
      stateRevision: this.states.revision(rootRunId), graphNodeInvocationId: graphInvocationId,
      policyDecisionId: decision.policyDecisionId
    });
  }

  private projectState(rootRunId: string, previous: DecisionInput): DecisionStateV3 {
    const snapshot = this.snapshot(rootRunId);
    const context: DecisionProjectionContextV3 = {
      epochKind: previous.epochKind,
      previousActionId: previous.previousActionId,
      previousActionResult: previous.previousActionResult,
      previousOutcomeId: previous.previousOutcomeId,
      actionInvocationCount: Number((this.connection().prepare(
        "SELECT COUNT(*) AS count FROM graph_node_invocations WHERE root_run_id = ?"
      ).get(rootRunId) as Row).count),
      stateRevision: this.states.revision(rootRunId), projectState: this.states.current(rootRunId),
      authorization: snapshot.authorization, acceptanceLedger: this.policies.ledger(rootRunId),
      evidenceRefs: [snapshot.authorization.sha256, snapshot.acceptanceLedger.sha256]
    };
    return projectDecisionState(snapshot.graph.strategy.model, context);
  }

  private terminalize(rootRunId: string, status: string, outcome?: CanonicalNodeOutcome, message?: string): void {
    const at = now();
    this.connection().prepare(`
      UPDATE root_runs SET status = ?, outcome_json = ?, error_code = ?, error_message = ?,
        active_graph_node_invocation_id = NULL, active_node_run_id = NULL,
        updated_at = ?, completed_at = ? WHERE root_run_id = ?
    `).run(status, outcome ? JSON.stringify(outcome) : null, status === "failed" || status === "blocked" ? status : null,
      status === "failed" || status === "blocked" ? message ?? null : null, at, at, rootRunId);
    this.events.append(rootRunId, "root_terminal", { stateRevision: this.states.revision(rootRunId) });
  }

  private incrementTransition(rootRunId: string): boolean {
    const result = this.connection().prepare(`
      UPDATE root_runs SET transition_count = transition_count + 1, updated_at = ?
      WHERE root_run_id = ? AND transition_count < ?
    `).run(now(), rootRunId, maxControlFlowTransitions);
    return result.changes === 1;
  }
}
