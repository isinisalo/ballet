import type Database from "better-sqlite3";

export class ExecutionTaskStateStore {
  constructor(private readonly connection: () => Database.Database) {}

  cancelActiveByRoot(rootRunId: string, timestamp: string): string[] {
    const rows = this.connection().prepare(`
      SELECT task_id FROM execution_tasks
      WHERE root_run_id = ? AND status IN ('queued', 'running')
      ORDER BY created_at, rowid
    `).all(rootRunId).map(readTaskId);
    this.connection().prepare(`
      UPDATE execution_tasks SET status = 'cancelled', outcome_json = NULL,
        error_code = NULL, error_message = NULL,
        cancel_requested_at = COALESCE(cancel_requested_at, ?), completed_at = ?, updated_at = ?
      WHERE root_run_id = ? AND status = 'queued'
    `).run(timestamp, timestamp, timestamp, rootRunId);
    this.connection().prepare(`
      UPDATE execution_tasks SET cancel_requested_at = COALESCE(cancel_requested_at, ?), updated_at = ?
      WHERE root_run_id = ? AND status = 'running'
    `).run(timestamp, timestamp, rootRunId);
    return rows;
  }

  rejectUnrunnableQueued(timestamp: string): string[] {
    const transaction = this.connection().transaction(() => {
      const rows = this.connection().prepare(`
        SELECT task_id FROM execution_tasks task
        WHERE task.status = 'queued' AND NOT (${runnableTaskSql})
        ORDER BY task.created_at, task.rowid
      `).all().map(readTaskId);
      for (const taskId of rows) this.cancel(taskId, timestamp);
      return rows;
    });
    return transaction();
  }

  claim(taskId: string, timestamp: string): boolean {
    const transaction = this.connection().transaction(() => {
      const result = this.connection().prepare(`
        UPDATE execution_tasks AS task SET status = 'running',
          started_at = COALESCE(started_at, ?), updated_at = ?
        WHERE task_id = ? AND status = 'queued' AND (${runnableTaskSql})
      `).run(timestamp, timestamp, taskId);
      if (result.changes === 1) return true;
      this.cancel(taskId, timestamp);
      return false;
    });
    return transaction();
  }

  private cancel(taskId: string, timestamp: string): void {
    this.connection().prepare(`
      UPDATE execution_tasks SET status = 'cancelled', outcome_json = NULL,
        error_code = NULL, error_message = NULL,
        cancel_requested_at = COALESCE(cancel_requested_at, ?), completed_at = ?, updated_at = ?
      WHERE task_id = ? AND status = 'queued'
    `).run(timestamp, timestamp, timestamp, taskId);
  }
}

const runnableTaskSql = `
  EXISTS (
    SELECT 1
    FROM root_runs root
    JOIN node_runs node ON node.root_run_id = root.root_run_id
    WHERE root.root_run_id = task.root_run_id
      AND root.status IN ('queued', 'running', 'waiting_for_input')
      AND node.node_run_id = task.node_run_id
      AND node.node_run_id = json_extract(task.spec_json, '$.nodeRunId')
      AND node.status = 'queued'
      AND node.execution_task_id = task.task_id
      AND root.active_node_run_id = node.node_run_id
  )
`;

const readTaskId = (value: unknown): string => {
  if (typeof value === "object" && value !== null && "task_id" in value) {
    const taskId = Reflect.get(value, "task_id");
    if (typeof taskId === "string") return taskId;
  }
  throw new Error("Execution database returned an invalid task id.");
};
