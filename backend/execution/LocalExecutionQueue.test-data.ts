import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { nodeOutcomeJsonSchema } from "../../shared/api/runtime-schemas.js";
import type { ExecutionSpec, RootExecutionSnapshot, RuntimeProvider } from "../../shared/domain/runtime.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";
import { testExecutionProfile, testLoop, testOrchestrator } from "../tests/v10TestConfig.js";

export const specification = (
  taskId: string,
  rootRunId: string,
  provider: RuntimeProvider = "codex",
  createdAt = "2026-01-01T00:00:00.000Z"
): ExecutionSpec => ({
  version: 3,
  taskId,
  kind: "node_execution",
  rootRunId,
  loopRunId: `loop-${rootRunId}`,
  workLoopNodeRunId: `work-loop-${taskId}`,
  nodeRunId: `node-${taskId}`,
  evidence: {
    compositionVersion: 2,
    loopId: "delivery",
    workLoopNodeId: taskId,
    nodeRole: "work",
    nodeDefinitionId: `delivery:${taskId}:work`,
    executionProfile: {
      id: `${provider}-test-medium`, name: `${provider} test · Medium`, provider,
      model: "provider-default", reasoningEffort: "provider-default", networkAccess: false
    },
    resources: [{
      kind: "system", origin: "system", id: "system:execution-contract-v2", sourceSha256: "b".repeat(64)
    }, {
      kind: "primary", origin: "project", id: "project:test-instruction",
      relativePath: ".ballet/instructions/test-instruction.md", sourceSha256: "c".repeat(64)
    }],
    prompt: `Run ${taskId}`,
    promptSha256: sha256(`Run ${taskId}`),
    outputSchemaVersion: 2,
    outputSchema: nodeOutcomeJsonSchema,
    outputSchemaSha256: sha256(canonicalJson(nodeOutcomeJsonSchema))
  },
  runtime: {
    hostname: "localhost", provider, cliVersion: "1.2.3", model: "provider-default",
    reasoning: "provider-default", policy: { network: false, readOnlyRoots: [] }, capabilityHash: "e".repeat(64)
  },
  project: {
    checkoutRoot: "/checkout", headSha: "a".repeat(40),
    configHash: "b".repeat(64), snapshotHash: "c".repeat(64)
  },
  createdAt
});

export const insertRuntimeRoot = (
  connection: Database.Database,
  worktreePath: string,
  rootRunId: string,
  taskIds: string[]
): void => {
  const timestamp = "2026-01-01T00:00:00.000Z";
  connection.transaction(() => {
    connection.prepare(`
      INSERT INTO root_runs (
        root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
        config_hash, snapshot_hash, execution_snapshot_json, current_state_revision,
        transition_count, created_at, updated_at
      ) VALUES (?, 'loop', 'delivery', 'manual', 'queued', ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `).run(rootRunId, worktreePath, `ballet/run/${rootRunId}`, "a".repeat(40),
      "b".repeat(64), "c".repeat(64), JSON.stringify(rootExecutionSnapshot()), timestamp, timestamp);
    connection.prepare(`
      INSERT INTO state_revisions (root_run_id, revision, state_json, state_hash, created_at)
      VALUES (?, 0, '{}', ?, ?)
    `).run(rootRunId, sha256("{}"), timestamp);
    connection.prepare(`
      INSERT INTO loop_invocations (
        loop_run_id, root_run_id, loop_id, source, status, entry_state_revision,
        nesting_depth, created_at, updated_at
      ) VALUES (?, ?, ?, 'manual', 'running', 0, 0, ?, ?)
    `).run(`loop-${rootRunId}`, rootRunId, "delivery", timestamp, timestamp);
    for (const taskId of taskIds) insertRunnableNode(connection, rootRunId, taskId, timestamp);
  })();
};

const insertRunnableNode = (
  connection: Database.Database, rootRunId: string, taskId: string, timestamp: string
): void => {
  connection.prepare(`
    INSERT INTO work_loop_node_runs (
      work_loop_node_run_id, root_run_id, loop_run_id, loop_id, work_loop_node_id,
      attempt, status, state_revision_before, created_at, updated_at
    ) VALUES (?, ?, ?, 'delivery', ?, 1, 'running', 0, ?, ?)
  `).run(`work-loop-${taskId}`, rootRunId, `loop-${rootRunId}`, taskId, timestamp, timestamp);
  connection.prepare(`
    INSERT INTO node_runs (
      node_run_id, root_run_id, loop_run_id, work_loop_node_run_id, role, loop_id,
      work_loop_node_id, node_definition_id, status, attempt, state_revision_before,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'work', 'delivery', ?, ?, 'queued', 1, 0, ?, ?)
  `).run(`node-${taskId}`, rootRunId, `loop-${rootRunId}`, `work-loop-${taskId}`,
    taskId, `delivery:${taskId}:work`, timestamp, timestamp);
};

const rootExecutionSnapshot = (): RootExecutionSnapshot => ({
  version: 2,
  rootLoopId: "delivery",
  project: {
    checkoutRoot: "/checkout", headSha: "a".repeat(40),
    configHash: "b".repeat(64), snapshotHash: "c".repeat(64)
  },
  orchestrator: testOrchestrator(),
  loops: [testLoop("delivery")],
  loopEdges: [],
  theme: defaultLoopTheme,
  executionProfiles: [testExecutionProfile],
  runtimes: [],
  resources: [],
  createdAt: "2026-01-01T00:00:00.000Z"
});

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
