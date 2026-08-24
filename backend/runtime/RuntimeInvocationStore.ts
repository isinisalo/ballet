import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { canonicalNodeOutcomeSchema } from "../../shared/api/runtime-schemas.js";
import type { ProjectGraphNode, ProjectActionNode } from "../../shared/domain/automation.js";
import type {
  CanonicalNodeOutcome,
  GraphNodeInvocation,
  GraphNodeInvocationDetails,
  ActionNodeInvocation,
  NodeRun,
  NodeRunRole
} from "../../shared/domain/runtime.js";
import { parseJsonValue } from "./state/CanonicalJson.js";

type Row = Record<string, unknown>;

export class RuntimeInvocationStore {
  constructor(private readonly connection: () => Database.Database) {}

  createGraphNode(rootRunId: string, graphNode: ProjectGraphNode, source: "policy" | "root", policyDecisionId?: string) {
    const id = randomUUID();
    const at = now();
    const revision = this.rootRevision(rootRunId);
    this.connection().prepare(`
      INSERT INTO graph_node_invocations (
        graph_node_invocation_id, root_run_id, graph_node_id, policy_decision_id, source, status,
        snapshot_json, entry_state_revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?, ?)
    `).run(id, rootRunId, graphNode.id, policyDecisionId ?? null, source, JSON.stringify(graphNode), revision, at, at);
    this.connection().prepare(`
      UPDATE root_runs SET active_graph_node_invocation_id = ?, updated_at = ? WHERE root_run_id = ?
    `).run(id, at, rootRunId);
    return this.graphNode(id);
  }

  completeGraphNode(id: string, status: "completed" | "failed" | "blocked" = "completed"): void {
    const invocation = this.graphNode(id);
    const at = now();
    this.connection().prepare(`
      UPDATE graph_node_invocations SET status = ?, completion_state_revision = ?, updated_at = ?, completed_at = ?
      WHERE graph_node_invocation_id = ?
    `).run(status, this.rootRevision(invocation.rootRunId), at, at, id);
  }

  createAction(
    rootRunId: string,
    graphInvocationId: string,
    graphNode: ProjectGraphNode,
    action: ProjectActionNode,
    policyDecisionId: string
  ) {
    const id = randomUUID();
    const at = now();
    const revision = this.rootRevision(rootRunId);
    this.connection().prepare(`
      INSERT INTO action_node_invocations (
        action_node_invocation_id, root_run_id, graph_node_invocation_id, graph_node_id, action_node_id,
        policy_decision_id, work_attempt, status, state_revision_before, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 'running', ?, ?, ?)
    `).run(id, rootRunId, graphInvocationId, graphNode.id, action.id, policyDecisionId, revision, at, at);
    return this.action(id);
  }

  completeAction(id: string): void {
    const action = this.action(id);
    const at = now();
    this.connection().prepare(`
      UPDATE action_node_invocations SET status = 'completed', state_revision_after = ?, active_node_run_id = NULL,
        updated_at = ?, completed_at = ? WHERE action_node_invocation_id = ?
    `).run(this.rootRevision(action.rootRunId), at, at, id);
  }

  createNode(input: {
    rootRunId: string;
    graphNodeInvocationId: string;
    actionNodeInvocationId: string;
    graphNodeId: string;
    actionNodeId: string;
    role: NodeRunRole;
    nodeDefinitionId: string;
    attempt: number;
    input?: unknown;
    context?: unknown;
  }): NodeRun {
    const id = randomUUID();
    const at = now();
    const revision = this.rootRevision(input.rootRunId);
    this.connection().prepare(`
      INSERT INTO node_runs (
        node_run_id, root_run_id, graph_node_invocation_id, action_node_invocation_id, role,
        graph_node_id, action_node_id, node_definition_id, input_json, context_json, status, attempt,
        state_revision_before, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)
    `).run(id, input.rootRunId, input.graphNodeInvocationId, input.actionNodeInvocationId, input.role,
      input.graphNodeId, input.actionNodeId, input.nodeDefinitionId, json(input.input), json(input.context),
      input.attempt, revision, at, at);
    this.connection().prepare(`
      UPDATE action_node_invocations SET active_node_run_id = ?, work_attempt = MAX(work_attempt, ?), updated_at = ?
      WHERE action_node_invocation_id = ?
    `).run(id, input.role === "work" ? input.attempt : input.attempt, at, input.actionNodeInvocationId);
    this.connection().prepare(`UPDATE root_runs SET active_node_run_id = ?, updated_at = ? WHERE root_run_id = ?`)
      .run(id, at, input.rootRunId);
    return this.requireNode(id);
  }

  setNodeOutcome(nodeRunId: string, outcome: CanonicalNodeOutcome, status: NodeRun["status"]): void {
    const at = now();
    this.connection().prepare(`
      UPDATE node_runs SET outcome_json = ?, status = ?, state_revision_after = ?, updated_at = ?, completed_at = ?
      WHERE node_run_id = ?
    `).run(JSON.stringify(outcome), status, this.rootRevision(this.requireNode(nodeRunId).rootRunId), at,
      status === "waiting_for_input" ? null : at, nodeRunId);
  }

  markRunning(nodeRunId: string): NodeRun {
    const at = now();
    this.connection().prepare(`UPDATE node_runs SET status = 'running', started_at = ?, updated_at = ? WHERE node_run_id = ?`)
      .run(at, at, nodeRunId);
    return this.requireNode(nodeRunId);
  }

  attachTask(nodeRunId: string, taskId: string): void {
    this.connection().prepare(`UPDATE node_runs SET execution_task_id = ?, updated_at = ? WHERE node_run_id = ?`)
      .run(taskId, now(), nodeRunId);
  }

  resume(nodeRunId: string, response: string): void {
    const node = this.requireNode(nodeRunId);
    const outcome = node.outcome;
    if (node.status !== "waiting_for_input" || outcome?.role !== "work" || outcome.state !== "needs_input") {
      throw new Error(`Node Run ${nodeRunId} is not waiting for input.`);
    }
    const context = { resume: { question: outcome.question, context: outcome.context, response } };
    this.connection().prepare(`
      UPDATE node_runs SET status = 'queued', context_json = ?, outcome_json = NULL, execution_task_id = NULL,
        updated_at = ?, completed_at = NULL WHERE node_run_id = ?
    `).run(JSON.stringify(context), now(), nodeRunId);
  }

  pending(rootRunId: string): NodeRun[] {
    return (this.connection().prepare(`
      SELECT * FROM node_runs WHERE root_run_id = ? AND status = 'queued' ORDER BY created_at
    `).all(rootRunId) as Row[]).map(mapNode);
  }

  getNode(id: string): NodeRun | undefined {
    const row = this.connection().prepare("SELECT * FROM node_runs WHERE node_run_id = ?").get(id) as Row | undefined;
    return row ? mapNode(row) : undefined;
  }

  requireNode(id: string): NodeRun {
    const node = this.getNode(id);
    if (!node) throw new Error(`Node Run ${id} was not found.`);
    return node;
  }

  graphNode(id: string): GraphNodeInvocation {
    const row = this.connection().prepare(
      "SELECT * FROM graph_node_invocations WHERE graph_node_invocation_id = ?"
    ).get(id) as Row | undefined;
    if (!row) throw new Error(`Graph Node Invocation ${id} was not found.`);
    return mapGraphNode(row);
  }

  action(id: string): ActionNodeInvocation {
    const row = this.connection().prepare("SELECT * FROM action_node_invocations WHERE action_node_invocation_id = ?")
      .get(id) as Row | undefined;
    if (!row) throw new Error(`Action Node Invocation ${id} was not found.`);
    return mapJob(row);
  }

  listRoot(rootRunId: string): GraphNodeInvocationDetails[] {
    const graphs = (this.connection().prepare(`
      SELECT * FROM graph_node_invocations WHERE root_run_id = ? ORDER BY created_at
    `).all(rootRunId) as Row[]).map(mapGraphNode);
    const actions = (this.connection().prepare(`
      SELECT * FROM action_node_invocations WHERE root_run_id = ? ORDER BY created_at
    `).all(rootRunId) as Row[]).map(mapJob);
    const nodes = (this.connection().prepare(`
      SELECT * FROM node_runs WHERE root_run_id = ? ORDER BY created_at
    `).all(rootRunId) as Row[]).map(mapNode);
    return graphs.map((graph) => ({
      ...graph,
      actionNodeInvocations: actions.filter(({ graphNodeInvocationId }) => graphNodeInvocationId === graph.graphNodeInvocationId),
      nodeRuns: nodes.filter(({ graphNodeInvocationId }) => graphNodeInvocationId === graph.graphNodeInvocationId)
    }));
  }

  listAll(limit = 2_000): GraphNodeInvocationDetails[] {
    const rootIds = (this.connection().prepare(`
      SELECT DISTINCT root_run_id FROM graph_node_invocations ORDER BY created_at DESC LIMIT ?
    `).all(limit) as Row[]).map((row) => String(row.root_run_id));
    return rootIds.flatMap((id) => this.listRoot(id)).slice(0, limit);
  }

  activeGraphNodeIds(): Set<string> {
    return new Set((this.connection().prepare(`
      SELECT DISTINCT graph_node_id FROM graph_node_invocations WHERE status IN ('queued','running','waiting_for_input')
    `).all() as Row[]).map((row) => String(row.graph_node_id)));
  }

  private rootRevision(rootRunId: string): number {
    return Number((this.connection().prepare(
      "SELECT current_state_revision FROM root_runs WHERE root_run_id = ?"
    ).get(rootRunId) as Row).current_state_revision);
  }
}

function mapGraphNode(row: Row): GraphNodeInvocation {
  return {
    graphNodeInvocationId: String(row.graph_node_invocation_id), graphNodeId: String(row.graph_node_id),
    rootRunId: String(row.root_run_id), policyDecisionId: optional(row.policy_decision_id),
    source: String(row.source) as "policy" | "root", status: String(row.status) as GraphNodeInvocation["status"],
    input: row.input_json ? parseJsonValue(String(row.input_json), "Graph Node input") : undefined,
    snapshot: JSON.parse(String(row.snapshot_json)) as ProjectGraphNode,
    entryStateRevision: Number(row.entry_state_revision),
    completionStateRevision: nullableNumber(row.completion_state_revision), createdAt: String(row.created_at),
    updatedAt: String(row.updated_at), completedAt: optional(row.completed_at)
  };
}

function mapJob(row: Row): ActionNodeInvocation {
  return {
    actionNodeInvocationId: String(row.action_node_invocation_id), rootRunId: String(row.root_run_id),
    graphNodeInvocationId: String(row.graph_node_invocation_id), graphNodeId: String(row.graph_node_id),
    actionNodeId: String(row.action_node_id), policyDecisionId: String(row.policy_decision_id),
    workAttempt: Number(row.work_attempt),
    status: String(row.status) as ActionNodeInvocation["status"], stateRevisionBefore: Number(row.state_revision_before),
    stateRevisionAfter: nullableNumber(row.state_revision_after), activeNodeRunId: optional(row.active_node_run_id),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), completedAt: optional(row.completed_at)
  };
}

function mapNode(row: Row): NodeRun {
  const parsed = row.outcome_json ? canonicalNodeOutcomeSchema.parse(JSON.parse(String(row.outcome_json))) : undefined;
  return {
    nodeRunId: String(row.node_run_id), rootRunId: String(row.root_run_id),
    graphNodeInvocationId: String(row.graph_node_invocation_id), actionNodeInvocationId: String(row.action_node_invocation_id),
    role: String(row.role) as NodeRunRole, graphNodeId: String(row.graph_node_id), actionNodeId: String(row.action_node_id),
    nodeDefinitionId: String(row.node_definition_id), executionTaskId: optional(row.execution_task_id),
    input: row.input_json ? parseJsonValue(String(row.input_json), "Node input") : undefined,
    context: row.context_json ? parseJsonValue(String(row.context_json), "Node context") : undefined,
    outcome: parsed, status: String(row.status) as NodeRun["status"], attempt: Number(row.attempt),
    stateRevisionBefore: Number(row.state_revision_before), stateRevisionAfter: nullableNumber(row.state_revision_after),
    patch: row.patch_json ? { patch: JSON.parse(String(row.patch_json)), patchSha256: String(row.patch_hash) } : undefined,
    errorCode: optional(row.error_code), errorMessage: optional(row.error_message), createdAt: String(row.created_at),
    startedAt: optional(row.started_at), updatedAt: String(row.updated_at), completedAt: optional(row.completed_at)
  };
}

const json = (value: unknown) => value === undefined ? null : JSON.stringify(value);
const now = () => new Date().toISOString();
const optional = (value: unknown): string | undefined => value === null || value === undefined ? undefined : String(value);
const nullableNumber = (value: unknown): number | undefined => value === null || value === undefined ? undefined : Number(value);
