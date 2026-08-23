import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalDatabase } from "../storage/LocalDatabase.js";
import { OptionCostEvidence } from "./OptionCostEvidence.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("provider-neutral option cost evidence", () => {
  it("aggregates latest task usage, retries, repairs, and explicit unknown dimensions", async () => {
    const database = await fixture();
    const evidence = new OptionCostEvidence(() => database.connection()).observe({
      scope: "graph_node", graphNodeInvocationId: "graph-invocation", jobNodeInvocationId: "job-invocation",
      durationMillis: 2_500
    });

    expect(evidence).toMatchObject({
      version: 1,
      attribution: {
        mode: "inclusive_v1", scope: "graph_node",
        nodeRunIds: ["work-run", "validation-run"], executionTaskIds: ["work-task", "validation-task"],
        childPolicyObservationIds: []
      },
      dimensions: {
        durationMillis: { status: "known", value: 2_500 },
        inputTokens: { status: "known", value: 13 },
        outputTokens: { status: "known", value: 24 },
        cachedInputTokens: { status: "unknown", reason: "provider_not_reported" },
        workRetryCount: { status: "known", value: 2 },
        repairAttemptCount: { status: "known", value: 1 },
        monetaryMicros: { status: "unknown", reason: "provider_not_reported" },
        utilityMicros: { status: "unknown", reason: "project_not_configured" }
      }
    });
    expect(evidence.dimensions.inputTokens.sourceRefs).toEqual(["execution-event:2", "execution-event:3"]);
    database.close();
  });

  it("links an inclusive GraphNode observation to local children instead of summing scope totals", async () => {
    const database = await fixture();
    insertChildObservation(database, "local-observation");
    const evidence = new OptionCostEvidence(() => database.connection()).observe({
      scope: "graph", graphNodeInvocationId: "graph-invocation", durationMillis: 4_000
    });

    expect(evidence.attribution).toMatchObject({
      mode: "inclusive_v1", scope: "graph", childPolicyObservationIds: ["local-observation"]
    });
    expect(evidence.dimensions.inputTokens).toMatchObject({ status: "known", value: 13 });
    expect(evidence.dimensions.workRetryCount).toMatchObject({ status: "known", value: 2 });
    expect(evidence.dimensions.repairAttemptCount).toMatchObject({ status: "known", value: 1 });
    database.close();
  });
});

const fixture = async (): Promise<LocalDatabase> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-option-cost-")); roots.push(root);
  const database = new LocalDatabase(path.join(root, "state.sqlite"));
  const connection = database.connection();
  connection.prepare(`
    INSERT INTO root_runs (
      root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha, config_hash,
      snapshot_hash, execution_snapshot_json, created_at, updated_at
    ) VALUES ('root', 'graph', 'graph', 'manual', 'running', '/tmp', 'codex/test', 'head', 'config', 'snapshot', '{}', 't0', 't0')
  `).run();
  connection.prepare(`
    INSERT INTO graph_node_invocations (
      graph_node_invocation_id, root_run_id, graph_node_id, source, status, snapshot_json,
      entry_state_revision, nesting_depth, created_at, updated_at
    ) VALUES ('graph-invocation', 'root', 'node', 'policy', 'completed', '{}', 0, 0, 't1', 't5')
  `).run();
  connection.prepare(`
    INSERT INTO job_node_invocations (
      job_node_invocation_id, root_run_id, graph_node_invocation_id, graph_node_id, job_node_id,
      work_attempt, status, state_revision_before, created_at, updated_at
    ) VALUES ('job-invocation', 'root', 'graph-invocation', 'node', 'job', 3, 'completed', 0, 't1', 't4')
  `).run();
  insertNode(connection, "work-run", "work", 1);
  insertNode(connection, "validation-run", "validation", 3);
  insertTask(connection, "work-task", "work-run", "t1");
  insertTask(connection, "validation-task", "validation-run", "t2");
  insertUsage(connection, "work-task", 1, { inputTokens: 2, outputTokens: 3, cachedInputTokens: 1, monetaryMicros: 2 });
  insertUsage(connection, "work-task", 2, { inputTokens: 10, outputTokens: 20, cachedInputTokens: 5, monetaryMicros: 7 });
  insertUsage(connection, "validation-task", 1, { inputTokens: 3, outputTokens: 4 });
  connection.prepare(`
    INSERT INTO repair_requests (
      repair_request_id, root_run_id, scope, graph_node_id, requester_node_run_id,
      requester_job_node_invocation_id, return_validation_node_id, attempt, depth, reason,
      evidence_json, state_revision, candidate_keys_json, status, created_at, updated_at
    ) VALUES ('repair', 'root', 'graph_node', 'node', 'validation-run', 'job-invocation',
      'validation', 1, 1, 'verify', '{}', 0, '[]', 'repaired', 't3', 't4')
  `).run();
  connection.prepare(`
    INSERT INTO repair_frames (
      repair_frame_id, root_run_id, repair_request_id, return_graph_node_invocation_id,
      return_job_node_invocation_id, return_validation_node_id, state_revision_at_call,
      depth, status, created_at, updated_at
    ) VALUES ('frame', 'root', 'repair', 'graph-invocation', 'job-invocation', 'validation', 0, 1, 'returned', 't3', 't4')
  `).run();
  return database;
};

const insertNode = (connection: ReturnType<LocalDatabase["connection"]>, id: string, role: "work" | "validation", attempt: number) => {
  connection.prepare(`
    INSERT INTO node_runs (
      node_run_id, root_run_id, graph_node_invocation_id, job_node_invocation_id, role,
      graph_node_id, job_node_id, node_definition_id, status, attempt, state_revision_before,
      created_at, updated_at, completed_at
    ) VALUES (?, 'root', 'graph-invocation', 'job-invocation', ?, 'node', 'job', ?, 'completed', ?, 0, 't1', 't4', 't4')
  `).run(id, role, id, attempt);
};
const insertTask = (connection: ReturnType<LocalDatabase["connection"]>, id: string, nodeRunId: string, createdAt: string) => {
  connection.prepare(`
    INSERT INTO execution_tasks (
      task_id, provider, kind, root_run_id, node_run_id, status, spec_json, spec_hash,
      completed_at, created_at, updated_at
    ) VALUES (?, 'codex', 'node_execution', 'root', ?, 'succeeded', '{}', 'hash', 't4', ?, 't4')
  `).run(id, nodeRunId, createdAt);
};
const insertUsage = (
  connection: ReturnType<LocalDatabase["connection"]>, taskId: string, sequence: number, data: Record<string, number>
) => {
  connection.prepare(`
    INSERT INTO execution_events (
      task_id, sequence, source, kind, level, phase, metric_kind, message, data_json,
      content_bytes, terminal, created_at
    ) VALUES (?, ?, 'codex', 'info', 'info', 'completed', 'usage_v1', 'Usage updated.', ?, 1, 0, 't3')
  `).run(taskId, sequence, JSON.stringify(data));
};
const insertChildObservation = (database: LocalDatabase, id: string) => {
  const connection = database.connection();
  connection.prepare(`
    INSERT INTO policy_decisions (
      policy_decision_id, root_run_id, scope, scope_key, graph_node_invocation_id, epoch, epoch_kind,
      state_json, admissible_action_ids_json, excluded_actions_json, action_values_json, tied_action_ids_json,
      solver_status, solver_algorithm, iterations, residual, epsilon, model_version, model_sha256,
      snapshot_sha256, created_at
    ) VALUES ('local-decision', 'root', 'graph_node', 'graph-invocation', 'graph-invocation', 1, 'start',
      '{}', '[]', '[]', '[]', '[]', 'converged', 'ssp_value_iteration_v2', 1, 0, 0.1, 2, 'model', 'snapshot', 't1')
  `).run();
  connection.prepare(`
    INSERT INTO policy_option_observations (
      policy_observation_id, root_run_id, policy_decision_id, scope, scope_key, action_invocation_id,
      graph_node_invocation_id, job_node_invocation_id, state_before_json, action_id,
      configured_expected_cost_micros, expected_outcome_distribution_json, observation_version,
      observed_cost_json, observed_outcome_id, verified_result, model_match, model_sha256, snapshot_sha256, created_at
    ) VALUES (?, 'root', 'local-decision', 'graph_node', 'graph-invocation', 'job-invocation',
      'graph-invocation', 'job-invocation', '{}', 'job', 1, '[]', 3, '{}', 'passed', 'PASS', 'match', 'model', 'snapshot', 't4')
  `).run(id);
};
