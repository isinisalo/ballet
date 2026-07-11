import type Database from "better-sqlite3";
import type { AgentRun, ExecutionTask, LoopRunDetails, RootFinalizationReport } from "../../shared/domain/runtime.js";
import { toAgentRun, toExecutionTask, type AgentRunRow, type ExecutionTaskRow } from "../control-plane/ExecutionMappers.js";
import { LoopRunStore } from "../runtime/LoopRunStore.js";

export interface StoredRootFinalization {
  rootRunId: string;
  projectId: string;
  status: "pending" | "reported";
  success: boolean;
  report?: RootFinalizationReport;
  authorizedAt: string;
  finalizedAt?: string;
}

export interface StoredRootRun {
  rootRunId: string;
  projectId: string;
  loopRuns: LoopRunDetails[];
  agentRun?: AgentRun;
  tasks: ExecutionTask[];
  finalization?: StoredRootFinalization;
}

export interface RunReadModelStoreOptions {
  runtimeConnection: () => Database.Database;
  controlPlaneConnection: () => Database.Database;
  projectId: string | (() => string);
}

interface FinalizationRow {
  root_run_id: string;
  project_id: string;
  expected_success: 0 | 1;
  status: "pending" | "reported";
  report_json: string | null;
  authorized_at: string;
  finalized_at: string | null;
}

export class RunReadModelStore {
  constructor(private readonly options: RunReadModelStoreOptions) {}

  list(scanLimit = 2_000): StoredRootRun[] {
    const projectId = this.projectId();
    const loopStore = new LoopRunStore(this.options.runtimeConnection, projectId);
    const loopRootIds = this.listLoopRootIds(projectId, scanLimit);
    const recentAgentRuns = this.listAgentRuns(projectId, scanLimit);
    const activeAgentRuns = this.listActiveAgentRuns(projectId);
    const pendingRootIds = this.listPendingFinalizationRootIds(projectId);
    const rootIds = unique([
      ...loopRootIds,
      ...activeAgentRuns.map((run) => run.rootRunId),
      ...recentAgentRuns.map((run) => run.rootRunId),
      ...pendingRootIds
    ]);
    const loopRuns = rootIds.flatMap((rootRunId) => loopStore.listByRoot(rootRunId));
    const agentRunsByRoot = new Map([...recentAgentRuns, ...activeAgentRuns].map((run) => [run.rootRunId, run]));
    for (const rootRunId of pendingRootIds) {
      if (!agentRunsByRoot.has(rootRunId)) {
        const run = this.getAgentRun(projectId, rootRunId);
        if (run) agentRunsByRoot.set(rootRunId, run);
      }
    }
    return this.assemble(rootIds, loopRuns, [...agentRunsByRoot.values()]);
  }

  get(rootRunId: string): StoredRootRun | undefined {
    const projectId = this.projectId();
    const loopRuns = new LoopRunStore(this.options.runtimeConnection, projectId).listByRoot(rootRunId);
    const agentRun = this.getAgentRun(projectId, rootRunId);
    if (loopRuns.length === 0 && !agentRun) return undefined;
    return this.assemble([rootRunId], loopRuns, agentRun ? [agentRun] : [])[0];
  }

  private assemble(rootIds: string[], loopRuns: LoopRunDetails[], agentRuns: AgentRun[]): StoredRootRun[] {
    if (rootIds.length === 0) return [];
    const tasks = this.listTasks(this.projectId(), rootIds);
    const finalizations = this.listFinalizations(this.projectId(), rootIds);
    const loopsByRoot = groupBy(loopRuns, (run) => run.rootRunId);
    const agentsByRoot = new Map(agentRuns.map((run) => [run.rootRunId, run]));
    const tasksByRoot = groupBy(tasks, (task) => task.rootRunId);
    const finalizationByRoot = new Map(finalizations.map((entry) => [entry.rootRunId, entry]));
    return rootIds.map((rootRunId) => ({
      rootRunId,
      projectId: this.projectId(),
      loopRuns: loopsByRoot.get(rootRunId) ?? [],
      agentRun: agentsByRoot.get(rootRunId),
      tasks: tasksByRoot.get(rootRunId) ?? [],
      finalization: finalizationByRoot.get(rootRunId)
    }));
  }

  private listAgentRuns(projectId: string, limit: number): AgentRun[] {
    const rows = this.options.controlPlaneConnection().prepare(`
      SELECT * FROM agent_runs WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?
    `).all(projectId, limit) as AgentRunRow[];
    return rows.map(toAgentRun);
  }

  private listActiveAgentRuns(projectId: string): AgentRun[] {
    const rows = this.options.controlPlaneConnection().prepare(`
      SELECT * FROM agent_runs WHERE project_id = ?
        AND status IN ('queued','claimed','preparing','running')
      ORDER BY created_at DESC, rowid DESC
    `).all(projectId) as AgentRunRow[];
    return rows.map(toAgentRun);
  }

  private listLoopRootIds(projectId: string, limit: number): string[] {
    const recent = this.options.runtimeConnection().prepare(`
      SELECT root_run_id, MAX(updated_at) AS last_updated_at FROM loop_runs
      WHERE project_id = ? GROUP BY root_run_id ORDER BY last_updated_at DESC, root_run_id DESC LIMIT ?
    `).all(projectId, limit) as Array<{ root_run_id: string }>;
    const active = this.options.runtimeConnection().prepare(`
      SELECT DISTINCT root_run_id FROM loop_runs WHERE project_id = ?
        AND status IN ('running','waiting_for_human')
    `).all(projectId) as Array<{ root_run_id: string }>;
    return unique([...active, ...recent].map((row) => row.root_run_id));
  }

  private listPendingFinalizationRootIds(projectId: string): string[] {
    const rows = this.options.controlPlaneConnection().prepare(`
      SELECT root_run_id FROM root_run_finalizations WHERE project_id = ? AND status = 'pending'
    `).all(projectId) as Array<{ root_run_id: string }>;
    return rows.map((row) => row.root_run_id);
  }

  private getAgentRun(projectId: string, rootRunId: string): AgentRun | undefined {
    const row = this.options.controlPlaneConnection().prepare(`
      SELECT * FROM agent_runs WHERE project_id = ? AND root_run_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get(projectId, rootRunId) as AgentRunRow | undefined;
    return row ? toAgentRun(row) : undefined;
  }

  private listTasks(projectId: string, rootIds: string[]): ExecutionTask[] {
    return chunks(rootIds, 500).flatMap((ids) => {
      const placeholders = ids.map(() => "?").join(",");
      const rows = this.options.controlPlaneConnection().prepare(`
        SELECT * FROM execution_tasks WHERE project_id = ? AND root_run_id IN (${placeholders})
        ORDER BY created_at ASC, rowid ASC
      `).all(projectId, ...ids) as ExecutionTaskRow[];
      return rows.map(toExecutionTask);
    });
  }

  private listFinalizations(projectId: string, rootIds: string[]): StoredRootFinalization[] {
    return chunks(rootIds, 500).flatMap((ids) => {
      const placeholders = ids.map(() => "?").join(",");
      const rows = this.options.controlPlaneConnection().prepare(`
        SELECT root_run_id, project_id, expected_success, status, report_json, authorized_at, finalized_at
        FROM root_run_finalizations WHERE project_id = ? AND root_run_id IN (${placeholders})
      `).all(projectId, ...ids) as FinalizationRow[];
      return rows.map(toFinalization);
    });
  }

  private projectId(): string {
    return typeof this.options.projectId === "function" ? this.options.projectId() : this.options.projectId;
  }
}

const toFinalization = (row: FinalizationRow): StoredRootFinalization => ({
  rootRunId: row.root_run_id,
  projectId: row.project_id,
  status: row.status,
  success: Boolean(row.expected_success),
  report: row.report_json ? JSON.parse(row.report_json) as RootFinalizationReport : undefined,
  authorizedAt: row.authorized_at,
  finalizedAt: row.finalized_at ?? undefined
});

const unique = (values: string[]): string[] => [...new Set(values)];

const groupBy = <T>(values: T[], key: (value: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const value of values) groups.set(key(value), [...(groups.get(key(value)) ?? []), value]);
  return groups;
};

const chunks = <T>(values: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
};
