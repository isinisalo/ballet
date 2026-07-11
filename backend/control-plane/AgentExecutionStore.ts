import type Database from "better-sqlite3";
import type { AgentExecutionState } from "../../shared/domain/agents.js";
import type {
  AgentRuntimeAttachment,
  AgentOutcome,
  AgentRun,
  ExecutionProjectSnapshot,
  ExecutionRuntimeSnapshot,
  ExecutionTask,
  ResolvedAgentExecution,
  RootFinalizationReport,
} from "../../shared/domain/runtime.js";
import { ControlPlaneNotFoundError } from "./errors.js";
import { toAgentRun, type AgentRunRow } from "./ExecutionMappers.js";

interface AttachmentRow {
  project_id: string;
  agent_id: string;
  runtime_backend_id: string;
  read_only_roots_json: string;
  created_at: string;
  updated_at: string;
}

export class AgentExecutionStore {
  constructor(private readonly connection: () => Database.Database, private readonly now: () => Date) {}

  getAttachment(projectId: string, agentId: string): AgentRuntimeAttachment | undefined {
    const row = this.connection().prepare(`
      SELECT * FROM agent_runtime_attachments WHERE project_id = ? AND agent_id = ?
    `).get(projectId, agentId) as AttachmentRow | undefined;
    return row ? toAttachment(row) : undefined;
  }

  putAttachment(input: {
    projectId: string;
    agentId: string;
    runtimeBackendId: string;
    readOnlyRoots: string[];
  }): AgentRuntimeAttachment {
    const existing = this.getAttachment(input.projectId, input.agentId);
    const timestamp = this.now().toISOString();
    this.connection().prepare(`
      INSERT INTO agent_runtime_attachments (
        project_id, agent_id, runtime_backend_id, read_only_roots_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, agent_id) DO UPDATE SET runtime_backend_id = excluded.runtime_backend_id,
        read_only_roots_json = excluded.read_only_roots_json, updated_at = excluded.updated_at
    `).run(input.projectId, input.agentId, input.runtimeBackendId, JSON.stringify(input.readOnlyRoots),
      existing?.createdAt ?? timestamp, timestamp);
    return this.getAttachment(input.projectId, input.agentId)!;
  }

  removeAttachment(projectId: string, agentId: string): void {
    this.connection().prepare("DELETE FROM agent_runtime_attachments WHERE project_id = ? AND agent_id = ?")
      .run(projectId, agentId);
  }

  createRun(input: {
    id: string;
    projectId: string;
    agentId: string;
    rootRunId: string;
    source?: "manual" | "schedule";
    taskId: string;
    runInput?: string;
    runtime: ExecutionRuntimeSnapshot;
    project: ExecutionProjectSnapshot;
    createdAt: string;
  }): AgentRun {
    this.connection().prepare(`
      INSERT INTO agent_runs (
        run_id, project_id, agent_id, root_run_id, task_id, source, status, input,
        runtime_snapshot_json, project_snapshot_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?)
    `).run(input.id, input.projectId, input.agentId, input.rootRunId, input.taskId, input.source ?? "manual",
      input.runInput ?? null, JSON.stringify(input.runtime), JSON.stringify(input.project), input.createdAt, input.createdAt);
    return this.requireRun(input.id);
  }

  getRun(runId: string): AgentRun | undefined {
    const row = this.connection().prepare("SELECT * FROM agent_runs WHERE run_id = ?").get(runId) as AgentRunRow | undefined;
    return row ? toAgentRun(row) : undefined;
  }

  requireRun(runId: string): AgentRun {
    const run = this.getRun(runId);
    if (!run) throw new ControlPlaneNotFoundError(`Agent run ${runId} was not found.`);
    return run;
  }

  latest(projectId: string, agentId: string): AgentRun | undefined {
    const row = this.connection().prepare(`
      SELECT * FROM agent_runs WHERE project_id = ? AND agent_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get(projectId, agentId) as AgentRunRow | undefined;
    return row ? toAgentRun(row) : undefined;
  }

  syncTask(task: ExecutionTask, detail?: {
    outcome?: AgentOutcome;
    branch?: string;
    worktreePath?: string;
    errorCode?: string;
    errorMessage?: string;
  }): void {
    const runStatus = task.kind === "agent_run" && task.status === "succeeded" && detail?.outcome
      && !isSuccessfulDirectOutcome(detail.outcome)
      ? "failed"
      : task.status;
    this.connection().prepare(`
      UPDATE agent_runs SET status = ?, outcome_json = COALESCE(?, outcome_json),
        branch = COALESCE(?, branch), worktree_path = COALESCE(?, worktree_path),
        error_code = COALESCE(?, error_code), error_message = COALESCE(?, error_message),
        completed_at = ?, updated_at = ? WHERE task_id = ?
    `).run(runStatus, detail?.outcome ? JSON.stringify(detail.outcome) : null,
      detail?.branch ?? null, detail?.worktreePath ?? null, detail?.errorCode ?? null,
      detail?.errorMessage ?? null, task.completedAt ?? null, task.updatedAt, task.id);
  }

  applyRootFinalization(task: ExecutionTask, report: RootFinalizationReport): void {
    if (!task.spec.agentRunId) return;
    const row = this.connection().prepare("SELECT outcome_json FROM agent_runs WHERE run_id = ?")
      .get(task.spec.agentRunId) as { outcome_json: string | null } | undefined;
    if (!row) return;
    const outcome = row.outcome_json ? JSON.parse(row.outcome_json) as AgentOutcome : undefined;
    const finalizedOutcome = outcome ? {
      ...outcome,
      artifacts: {
        ...outcome.artifacts,
        branch: report.branch,
        changed_files: report.changedFiles,
        ...(report.commitSha ? { git_sha: report.commitSha } : {})
      }
    } : undefined;
    this.connection().prepare(`
      UPDATE agent_runs SET branch = ?, worktree_path = ?, outcome_json = COALESCE(?, outcome_json), updated_at = ?
      WHERE run_id = ?
    `).run(report.branch, report.worktreePath, finalizedOutcome ? JSON.stringify(finalizedOutcome) : null,
      this.now().toISOString(), task.spec.agentRunId);
  }

  attachedAgentIds(projectId: string): string[] {
    const rows = this.connection().prepare("SELECT agent_id FROM agent_runtime_attachments WHERE project_id = ? ORDER BY agent_id")
      .all(projectId) as Array<{ agent_id: string }>;
    return rows.map((row) => row.agent_id);
  }

  executionState(agentId: string, execution?: ResolvedAgentExecution, reason?: string): AgentExecutionState {
    if (!execution) return { agentId, status: "unbound", reason: reason ?? "No execution runtime is configured." };
    const backend = this.connection().prepare(`
      SELECT b.health, b.auth_status, d.status AS device_status,
        (SELECT task_id FROM execution_tasks t WHERE t.runtime_backend_id = b.backend_id
          AND t.status IN ('claimed','preparing','running') ORDER BY t.created_at LIMIT 1) AS active_task_id,
        (SELECT json_extract(spec_json, '$.agent.id') FROM execution_tasks t WHERE t.runtime_backend_id = b.backend_id
          AND t.status IN ('claimed','preparing','running') ORDER BY t.created_at LIMIT 1) AS active_agent_id
      FROM runtime_backends b JOIN runtime_devices d ON d.device_id = b.device_id
      WHERE b.backend_id = ? AND d.revoked_at IS NULL
    `).get(execution.runtimeBackendId) as {
      health: string; auth_status: string; device_status: string;
      active_task_id: string | null; active_agent_id: string | null;
    } | undefined;
    const base = {
      agentId,
      deviceId: execution.deviceId,
      runtimeBackendId: execution.runtimeBackendId,
      provider: execution.provider,
      reasoning: execution.reasoning
    };
    if (!backend || backend.device_status !== "online" || backend.health === "offline") return { ...base, status: "offline", reason: "Runtime device is offline." };
    if (backend.auth_status !== "ready" || backend.health !== "ready") return { ...base, status: "attention", reason: `Runtime backend is ${backend.health}.` };
    if (backend.active_task_id) {
      return backend.active_agent_id === agentId
        ? { ...base, status: "running", activeTaskId: backend.active_task_id }
        : { ...base, status: "busy", activeTaskId: backend.active_task_id, reason: "Runtime backend is executing another task." };
    }
    return { ...base, status: "idle" };
  }
}

const isSuccessfulDirectOutcome = (outcome: AgentOutcome): boolean =>
  outcome.outcome === "ready" || outcome.outcome === "approved";

const toAttachment = (row: AttachmentRow): AgentRuntimeAttachment => ({
  projectId: row.project_id,
  agentId: row.agent_id,
  runtimeBackendId: row.runtime_backend_id,
  readOnlyRoots: JSON.parse(row.read_only_roots_json) as string[],
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
