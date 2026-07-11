import type { AppData } from "../../shared/api/workspaceData.js";
import type { ExecutionTask } from "../../shared/domain/runtime.js";
import { toExecutionTask, type ExecutionTaskRow } from "../control-plane/ExecutionMappers.js";
import type { ControlPlaneDatabase } from "../control-plane/ControlPlaneDatabase.js";
import type { LoopExecutionCoordinator } from "./LoopExecutionCoordinator.js";
import type { RuntimeDatabase } from "../runtime-db.js";

export interface LoopExecutionReconcilerOptions {
  controlPlaneDatabase: ControlPlaneDatabase;
  runtimeDatabase: () => RuntimeDatabase;
  coordinator: LoopExecutionCoordinator;
  readData: () => Promise<AppData>;
  projectId: string;
}

export class LoopExecutionReconciler {
  constructor(private readonly options: LoopExecutionReconcilerOptions) {}

  async reconcile(): Promise<void> {
    const data = await this.options.readData();
    const database = this.options.runtimeDatabase();
    const activeRuns = database.listActiveLoopRuns();
    const roots = new Set(activeRuns.map((run) => run.rootRunId));
    const tasks = this.loopTasks();
    const tasksById = new Map(tasks.map((task) => [task.id, task]));

    for (const run of activeRuns) {
      for (const step of run.stepRuns) {
        if (!step.executionTaskId || tasksById.has(step.executionTaskId)
          || !["queued", "running"].includes(step.status)) continue;
        database.clearStepExecution(step.stepRunId, step.executionTaskId);
      }
    }

    for (const task of tasks) {
      roots.add(task.rootRunId);
      const stepRunId = task.spec.stepRunId;
      if (!stepRunId) continue;
      const stepRun = database.getStepRun(stepRunId);
      if (!stepRun || !["queued", "running"].includes(stepRun.status)) continue;
      if (stepRun.executionTaskId && stepRun.executionTaskId !== task.id) continue;
      if (isTerminal(task)) {
        await this.options.coordinator.handleTerminal(task);
      } else {
        if (!stepRun.executionTaskId) database.bindStepExecution(stepRunId, task.id, task.spec.runtime);
        if (task.status === "running") database.markStepRunRunning(stepRunId);
      }
    }

    for (const rootRunId of roots) {
      const runs = database.listRootLoopRuns(rootRunId);
      if (runs.length > 0 && runs.every((run) => !["running", "waiting_for_human"].includes(run.status))) {
        await this.options.coordinator.cancel(rootRunId);
      }
      if (runs.some((run) => run.status === "running")) {
        await this.options.coordinator.enqueuePending(data, rootRunId);
      }
      await this.options.coordinator.finalizeIfTerminal(rootRunId);
    }
  }

  private loopTasks(): ExecutionTask[] {
    const rows = this.options.controlPlaneDatabase.connection().prepare(`
      SELECT * FROM execution_tasks
      WHERE project_id = ? AND kind = 'loop_step'
      ORDER BY created_at, rowid
    `).all(this.options.projectId) as ExecutionTaskRow[];
    return rows.map(toExecutionTask);
  }
}

const isTerminal = (task: ExecutionTask): boolean =>
  task.status === "succeeded" || task.status === "failed" || task.status === "cancelled";
