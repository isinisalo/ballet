import type Database from "better-sqlite3";
import type { WorkNodeOutcome } from "../../shared/domain/runtime.js";
import type { TaskEnvelopeHistoryEntry, TaskEnvelopeV9 } from "../../shared/domain/taskEnvelope.js";
import { RuntimeInvocationStore } from "./RuntimeInvocationStore.js";
import { RuntimePolicyStore } from "./RuntimePolicyStore.js";
import { RuntimeStateStore } from "./RuntimeStateStore.js";
import { jsonSha256 } from "./state/CanonicalJson.js";

type Row = Record<string, unknown>;

export class RuntimeTaskEnvelopeBuilder {
  constructor(
    private readonly connection: () => Database.Database,
    private readonly invocations: RuntimeInvocationStore,
    private readonly policies: RuntimePolicyStore,
    private readonly states: RuntimeStateStore
  ) {}

  build(nodeRunId: string): TaskEnvelopeV9 {
    const node = this.invocations.requireNode(nodeRunId);
    const graphInvocation = this.invocations.graphNode(node.graphNodeInvocationId!);
    const jobInvocation = this.invocations.action(node.actionNodeInvocationId!);
    const graphNode = graphInvocation.snapshot;
    const action = graphNode.actionNodes.find(({ id }) => id === jobInvocation.actionNodeId);
    if (!action) throw new Error(`Action Node ${jobInvocation.actionNodeId} is outside its Graph Node snapshot.`);
    const state = this.states.current(node.rootRunId);
    const base = {
      version: 9 as const,
      run: {
        rootRunId: node.rootRunId,
        graphNodeInvocationId: graphInvocation.graphNodeInvocationId,
        actionNodeInvocationId: jobInvocation.actionNodeInvocationId,
        nodeRunId
      },
      state: { revision: this.states.revision(node.rootRunId), value: state, sha256: jsonSha256(state) },
      acceptanceLedger: this.policies.ledger(node.rootRunId),
      resume: resumeContext(node.context),
      relevantHistory: this.history(node.rootRunId, nodeRunId)
    };
    if (node.role === "work") return {
      ...base,
      role: "work",
      task: action.workNode.task,
      graphNode: identity(graphNode),
      actionNode: identity(action),
      workNode: identity(action.workNode),
      workAttempt: node.attempt,
      previousValidationFeedback: this.previousFeedback(jobInvocation.actionNodeInvocationId)
    };
    return {
      ...base,
      role: "validation",
      task: action.validationNode.task,
      graphNode: identity(graphNode),
      actionNode: identity(action),
      validationNode: identity(action.validationNode),
      workAttempt: node.attempt,
      workOutcome: this.latestWorkOutcome(jobInvocation.actionNodeInvocationId),
      allowedOutcomes: action.outcomes,
      retriesRemaining: Math.max(0, action.maxRetries - (node.attempt - 1))
    };
  }

  private latestWorkOutcome(actionNodeInvocationId: string): WorkNodeOutcome {
    const row = this.connection().prepare(`
      SELECT outcome_json FROM node_runs
      WHERE action_node_invocation_id = ? AND role = 'work' AND outcome_json IS NOT NULL
      ORDER BY attempt DESC, created_at DESC LIMIT 1
    `).get(actionNodeInvocationId) as Row | undefined;
    if (!row) throw new Error(`Action Node Invocation ${actionNodeInvocationId} has no Work outcome.`);
    return JSON.parse(String(row.outcome_json)) as WorkNodeOutcome;
  }

  private previousFeedback(actionNodeInvocationId: string) {
    const row = this.connection().prepare(`
      SELECT outcome_json FROM node_runs
      WHERE action_node_invocation_id = ? AND role = 'validation' AND outcome_json IS NOT NULL
      ORDER BY attempt DESC, created_at DESC LIMIT 1
    `).get(actionNodeInvocationId) as Row | undefined;
    if (!row) return undefined;
    const outcome = JSON.parse(String(row.outcome_json)) as Record<string, unknown>;
    return typeof outcome.feedback === "string" && typeof outcome.expectedCorrection === "string"
      ? { feedback: outcome.feedback, expectedCorrection: outcome.expectedCorrection } : undefined;
  }

  private history(rootRunId: string, exclude: string): TaskEnvelopeHistoryEntry[] {
    return (this.connection().prepare(`
      SELECT node_run_id, role, outcome_json, state_revision_after, status, rowid
      FROM node_runs WHERE root_run_id = ? AND node_run_id <> ? AND outcome_json IS NOT NULL
      ORDER BY rowid DESC LIMIT 8
    `).all(rootRunId, exclude) as Row[]).reverse().map((row, index) => {
      const outcome = JSON.parse(String(row.outcome_json)) as { state: string; summary: string };
      return {
        sequence: index,
        nodeRunId: String(row.node_run_id),
        role: String(row.role) as "work" | "validation",
        state: outcome.state as TaskEnvelopeHistoryEntry["state"],
        summary: outcome.summary,
        stateRevision: Number(row.state_revision_after ?? 0)
      };
    });
  }

}

const identity = (node: { id: string; description: string }) => ({ id: node.id, description: node.description });
function resumeContext(value: unknown) {
  if (!value || typeof value !== "object" || !("resume" in value)) return undefined;
  const resume = Reflect.get(value, "resume");
  if (!resume || typeof resume !== "object") return undefined;
  const question = Reflect.get(resume, "question");
  const context = Reflect.get(resume, "context");
  const response = Reflect.get(resume, "response");
  return typeof question === "string" && typeof context === "string" && typeof response === "string"
    ? { question, context, response } : undefined;
}
