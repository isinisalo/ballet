import type Database from "better-sqlite3";
import type {
  DecisionPolicyScope,
  PolicyCostMeasureV1,
  PolicyOptionCostObservationV1
} from "../../shared/domain/decisionModel.js";

type Row = Record<string, unknown>;
type UsageDimension = "inputTokens" | "outputTokens" | "cachedInputTokens" | "monetaryMicros" | "utilityMicros";

export class OptionCostEvidence {
  constructor(private readonly connection: () => Database.Database) {}

  observe(input: {
    scope: DecisionPolicyScope;
    graphNodeInvocationId: string;
    jobNodeInvocationId?: string;
    durationMillis: number;
  }): PolicyOptionCostObservationV1 {
    const nodes = this.nodeRuns(input);
    const tasks = this.executionTasks(nodes.map(({ nodeRunId }) => nodeRunId));
    const usage = this.latestUsageByTask(tasks.map(({ taskId }) => taskId));
    const invocationRef = `${input.scope === "graph" ? "graph-node" : "job-node"}-invocation:${
      input.scope === "graph" ? input.graphNodeInvocationId : input.jobNodeInvocationId
    }`;
    return {
      version: 1,
      attribution: {
        mode: "inclusive_v1",
        scope: input.scope,
        nodeRunIds: nodes.map(({ nodeRunId }) => nodeRunId),
        executionTaskIds: tasks.map(({ taskId }) => taskId),
        childPolicyObservationIds: input.scope === "graph"
          ? this.childPolicyObservationIds(input.graphNodeInvocationId) : []
      },
      dimensions: {
        durationMillis: known(input.durationMillis, [invocationRef]),
        inputTokens: aggregateUsage("inputTokens", tasks, usage),
        outputTokens: aggregateUsage("outputTokens", tasks, usage),
        cachedInputTokens: aggregateUsage("cachedInputTokens", tasks, usage),
        workRetryCount: known(this.workRetryCount(input), nodes.map(({ nodeRunId }) => `node-run:${nodeRunId}`)),
        repairAttemptCount: known(this.repairAttemptCount(input), [invocationRef]),
        monetaryMicros: aggregateUsage("monetaryMicros", tasks, usage),
        utilityMicros: aggregateUsage("utilityMicros", tasks, usage, "project_not_configured")
      }
    };
  }

  private nodeRuns(input: {
    scope: DecisionPolicyScope; graphNodeInvocationId: string; jobNodeInvocationId?: string;
  }): Array<{ nodeRunId: string }> {
    const rows = input.scope === "graph"
      ? this.connection().prepare(`
          SELECT node_run_id FROM node_runs WHERE graph_node_invocation_id = ? ORDER BY created_at, rowid
        `).all(input.graphNodeInvocationId)
      : this.connection().prepare(`
          SELECT node_run_id FROM node_runs WHERE job_node_invocation_id = ? ORDER BY created_at, rowid
        `).all(input.jobNodeInvocationId);
    return (rows as Row[]).map((row) => ({ nodeRunId: String(row.node_run_id) }));
  }

  private executionTasks(nodeRunIds: string[]): Array<{ taskId: string }> {
    if (nodeRunIds.length === 0) return [];
    const placeholders = nodeRunIds.map(() => "?").join(",");
    return (this.connection().prepare(`
      SELECT task_id FROM execution_tasks WHERE node_run_id IN (${placeholders}) ORDER BY created_at, rowid
    `).all(...nodeRunIds) as Row[]).map((row) => ({ taskId: String(row.task_id) }));
  }

  private latestUsageByTask(taskIds: string[]): Map<string, { eventRef: string; data: Record<string, unknown> }> {
    if (taskIds.length === 0) return new Map();
    const placeholders = taskIds.map(() => "?").join(",");
    const rows = this.connection().prepare(`
      SELECT id, task_id, data_json FROM execution_events
      WHERE task_id IN (${placeholders}) AND metric_kind = 'usage_v1'
      ORDER BY task_id, sequence DESC, id DESC
    `).all(...taskIds) as Row[];
    const result = new Map<string, { eventRef: string; data: Record<string, unknown> }>();
    for (const row of rows) {
      const taskId = String(row.task_id);
      if (result.has(taskId)) continue;
      result.set(taskId, { eventRef: `execution-event:${String(row.id)}`, data: parseRecord(row.data_json) });
    }
    return result;
  }

  private childPolicyObservationIds(graphNodeInvocationId: string): string[] {
    return (this.connection().prepare(`
      SELECT policy_observation_id FROM policy_option_observations
      WHERE scope = 'graph_node' AND graph_node_invocation_id = ? ORDER BY created_at, rowid
    `).all(graphNodeInvocationId) as Row[]).map((row) => String(row.policy_observation_id));
  }

  private workRetryCount(input: {
    scope: DecisionPolicyScope; graphNodeInvocationId: string; jobNodeInvocationId?: string;
  }): number {
    const row = input.scope === "graph"
      ? this.connection().prepare(`
          SELECT COALESCE(SUM(MAX(work_attempt - 1, 0)), 0) value
          FROM job_node_invocations WHERE graph_node_invocation_id = ?
        `).get(input.graphNodeInvocationId)
      : this.connection().prepare(`
          SELECT MAX(work_attempt - 1, 0) value FROM job_node_invocations WHERE job_node_invocation_id = ?
        `).get(input.jobNodeInvocationId);
    return nonnegativeInteger(Reflect.get(row as object, "value"), "work retry count");
  }

  private repairAttemptCount(input: {
    scope: DecisionPolicyScope; graphNodeInvocationId: string; jobNodeInvocationId?: string;
  }): number {
    const row = input.scope === "graph"
      ? this.connection().prepare(`
          SELECT COUNT(DISTINCT repair_request_id) value FROM repair_frames
          WHERE return_graph_node_invocation_id = ?
        `).get(input.graphNodeInvocationId)
      : this.connection().prepare(`
          SELECT COUNT(*) value FROM repair_requests WHERE requester_job_node_invocation_id = ?
        `).get(input.jobNodeInvocationId);
    return nonnegativeInteger(Reflect.get(row as object, "value"), "repair attempt count");
  }
}

const aggregateUsage = (
  dimension: UsageDimension,
  tasks: Array<{ taskId: string }>,
  usage: Map<string, { eventRef: string; data: Record<string, unknown> }>,
  absentReason: "provider_not_reported" | "project_not_configured" = "provider_not_reported"
): PolicyCostMeasureV1 => {
  if (tasks.length === 0) return dimension === "utilityMicros"
    ? unknown(absentReason, []) : known(0, []);
  const refs: string[] = [];
  let total = 0;
  for (const { taskId } of tasks) {
    const entry = usage.get(taskId);
    const value = entry?.data[dimension];
    if (!entry || !isNonnegativeInteger(value)) {
      return unknown(absentReason, [...refs, `execution-task:${taskId}`]);
    }
    refs.push(entry.eventRef);
    total += value;
    if (!Number.isSafeInteger(total)) throw new Error(`Observed ${dimension} exceeds the safe integer range.`);
  }
  return known(total, refs);
};

const known = (value: number, sourceRefs: string[]): PolicyCostMeasureV1 => ({
  status: "known", value: nonnegativeInteger(value, "observed cost dimension"), sourceRefs: [...sourceRefs]
});
const unknown = (
  reason: "provider_not_reported" | "project_not_configured", sourceRefs: string[]
): PolicyCostMeasureV1 => ({ status: "unknown", reason, sourceRefs: [...sourceRefs] });
const isNonnegativeInteger = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const nonnegativeInteger = (value: unknown, label: string): number => {
  if (!isNonnegativeInteger(value)) throw new Error(`${label} must be a non-negative safe integer.`);
  return value;
};
const parseRecord = (source: unknown): Record<string, unknown> => {
  if (typeof source !== "string") return {};
  const value: unknown = JSON.parse(source);
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
};
