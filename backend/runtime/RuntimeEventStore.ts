import type Database from "better-sqlite3";
import type { ControlFlowEvent } from "../../shared/domain/runtime.js";

type Row = Record<string, unknown>;

export class RuntimeEventStore {
  constructor(private readonly connection: () => Database.Database) {}

  append(rootRunId: string, kind: ControlFlowEvent["kind"], detail: {
    stateRevision: number;
    graphNodeInvocationId?: string;
    actionNodeInvocationId?: string;
    sourceNodeRunId?: string;
    targetNodeRunId?: string;
    policyDecisionId?: string;
  }): void {
    const sequence = Number((this.connection().prepare(`
      SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM control_flow_events WHERE root_run_id = ?
    `).get(rootRunId) as Row).sequence);
    this.connection().prepare(`
      INSERT INTO control_flow_events (
        root_run_id, sequence, kind, state_revision, graph_node_invocation_id, action_node_invocation_id,
        source_node_run_id, target_node_run_id, policy_decision_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(rootRunId, sequence, kind, detail.stateRevision, detail.graphNodeInvocationId ?? null,
      detail.actionNodeInvocationId ?? null, detail.sourceNodeRunId ?? null, detail.targetNodeRunId ?? null,
      detail.policyDecisionId ?? null, new Date().toISOString());
  }

  list(rootRunId: string): ControlFlowEvent[] {
    return (this.connection().prepare(`
      SELECT * FROM control_flow_events WHERE root_run_id = ? ORDER BY sequence
    `).all(rootRunId) as Row[]).map((row) => ({
      id: Number(row.id), rootRunId: String(row.root_run_id), sequence: Number(row.sequence),
      kind: String(row.kind) as ControlFlowEvent["kind"], stateRevision: Number(row.state_revision),
      graphNodeInvocationId: optional(row.graph_node_invocation_id),
      actionNodeInvocationId: optional(row.action_node_invocation_id), sourceNodeRunId: optional(row.source_node_run_id),
      targetNodeRunId: optional(row.target_node_run_id), policyDecisionId: optional(row.policy_decision_id),
      createdAt: String(row.created_at)
    }));
  }
}

const optional = (value: unknown): string | undefined => value === null || value === undefined ? undefined : String(value);
