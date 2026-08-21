import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { jobNodeOutcomeJsonSchema } from "../../shared/api/runtime-schemas.js";
import type { ExecutionSpec, RootExecutionSnapshot, RuntimeProvider } from "../../shared/domain/runtime.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";
import { serializeTaskEnvelopeV6 } from "../integration/TaskEnvelopeV6.js";
import { testExecutionProfile, testLoop, testOrchestrator } from "../tests/v13TestConfig.js";

export const specification = (
  taskId: string,
  rootRunId: string,
  provider: RuntimeProvider = "codex",
  createdAt = "2026-01-01T00:00:00.000Z"
): ExecutionSpec => ({
  version: 8,
  taskId,
  kind: "node_execution",
  rootRunId,
  loopRunId: `loop-${rootRunId}`,
  jobRunId: `job-run-${taskId}`,
  nodeRunId: `node-${taskId}`,
  evidence: {
    compositionVersion: 7,
    loopId: "delivery",
    jobNodeId: taskId,
    workflowNodeId: taskId,
    nodeRole: "job",
    nodeDefinitionId: `delivery:${taskId}:job`,
    executionProfile: {
      id: `${provider}-test-medium`, name: `${provider} test · Medium`, provider,
      model: "provider-default", reasoningEffort: "provider-default", networkAccess: false
    },
    resources: [{
      kind: "system", origin: "system", id: "system:execution-contract-v4", sourceSha256: "b".repeat(64)
    }, {
      kind: "primary", origin: "project", id: "project:test-instruction",
      relativePath: ".ballet/instructions/test-instruction.md", sourceSha256: "c".repeat(64)
    }],
    ...jobPromptEvidence(taskId, rootRunId),
    outputSchemaVersion: 6,
    outputSchemaId: "job-node-outcome-v6",
    outputSchema: jobNodeOutcomeJsonSchema,
    outputSchemaSha256: sha256(canonicalJson(jobNodeOutcomeJsonSchema))
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
    const activeTaskId = taskIds[0];
    if (activeTaskId) connection.prepare(`
      UPDATE root_runs SET active_loop_run_id = ?, active_node_run_id = ? WHERE root_run_id = ?
    `).run(`loop-${rootRunId}`, `node-${activeTaskId}`, rootRunId);
  })();
};

const insertRunnableNode = (
  connection: Database.Database, rootRunId: string, taskId: string, timestamp: string
): void => {
  connection.prepare(`
    INSERT INTO job_runs (
      job_run_id, root_run_id, loop_run_id, loop_id, job_node_id,
      job_attempt, status, state_revision_before, created_at, updated_at
    ) VALUES (?, ?, ?, 'delivery', ?, 1, 'running', 0, ?, ?)
  `).run(`job-run-${taskId}`, rootRunId, `loop-${rootRunId}`, taskId, timestamp, timestamp);
  connection.prepare(`
    INSERT INTO node_runs (
      node_run_id, root_run_id, loop_run_id, job_run_id, role, loop_id,
      job_node_id, workflow_node_id, node_definition_id, status, attempt, state_revision_before,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'job', 'delivery', ?, ?, ?, 'queued', 1, 0, ?, ?)
  `).run(`node-${taskId}`, rootRunId, `loop-${rootRunId}`, `job-run-${taskId}`,
    taskId, taskId, `delivery:${taskId}:job`, timestamp, timestamp);
};

const rootExecutionSnapshot = (): RootExecutionSnapshot => ({
  version: 6,
  rootKind: "loop",
  rootLoopId: "delivery",
  project: {
    checkoutRoot: "/checkout", headSha: "a".repeat(40),
    configHash: "b".repeat(64), snapshotHash: "c".repeat(64)
  },
  orchestrator: testOrchestrator(),
  issueTracker: {
    kind: "tk",
    testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
    orchestrationDirectory: ".tickets/orchestration",
    workDirectory: ".tickets/work"
  },
  graph: {
    id: "test-graph", name: "Test Graph", startLoopId: "delivery", transitions: [],
    repairEdges: [{
      id: "delivery-self-repair", source: "delivery", target: "delivery",
      capability: "test:loop.transfer", description: "Allow a bounded self repair."
    }]
  },
  loops: [testLoop("delivery")],
  theme: defaultLoopTheme,
  executionProfiles: [testExecutionProfile],
  runtimes: [],
  resources: [],
  createdAt: "2026-01-01T00:00:00.000Z"
});

const jobPromptEvidence = (taskId: string, rootRunId: string) => {
  const envelope = serializeTaskEnvelopeV6({
    version: 6, role: "job",
    run: {
      rootRunId, loopRunId: `loop-${rootRunId}`, nodeRunId: `node-${taskId}`,
      jobRunId: `job-run-${taskId}`
    },
    loop: { id: "delivery", description: "Test Loop delivery." },
    jobNode: { id: taskId, description: `Test Node ${taskId}.` },
    task: `Run ${taskId}.`,
    state: { revision: 0, value: {}, sha256: sha256("{}") },
    jobAttempt: 1,
    relevantHistory: []
  });
  const schema = canonicalJson(jobNodeOutcomeJsonSchema);
  const prompt = [
    section("TASK-ENVELOPE", "v6", envelope.serialized),
    section("OUTPUT-SCHEMA", "v6", schema)
  ].join("\n\n");
  return {
    prompt,
    promptSha256: sha256(prompt),
    taskEnvelopeVersion: 6 as const,
    taskEnvelopeSha256: envelope.sha256
  };
};

const section = (kind: string, id: string, content: string): string =>
  `<<< BALLET EXECUTION COMPOSITION V7 · ${kind} · ${id} >>>\n${content}\n<<< END BALLET ${kind} >>>`;

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
