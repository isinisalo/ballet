import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import type { AppData } from "../../shared/api/workspaceData.js";
import type { ProjectLoop, ProjectStep } from "../../shared/domain/automation.js";
import type {
  ExecutionSpec,
  ExecutionTask,
  LoopExecutionPlan,
  RootRunDisposition,
  RuntimePreflightIssue
} from "../../shared/domain/runtime.js";
import type { ControlPlaneService } from "../control-plane/ControlPlaneService.js";
import { agentSnapshotFromAgent } from "../control-plane/ControlPlaneService.js";
import { ControlPlanePreflightError } from "../control-plane/errors.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import type { LoopExecutionGateway } from "../services/LoopExecutionGateway.js";

export interface LoopExecutionCoordinatorOptions {
  controlPlane: ControlPlaneService;
  database: () => RuntimeDatabase;
  readData: () => Promise<AppData>;
  now?: () => Date;
}

export class LoopExecutionCoordinator implements LoopExecutionGateway {
  private readonly now: () => Date;

  constructor(private readonly options: LoopExecutionCoordinatorOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async prepare(data: AppData, loopId: string): Promise<LoopExecutionPlan | undefined> {
    const steps = reachableAgentSteps(data, loopId);
    if (steps.length === 0) return undefined;
    await this.options.controlPlane.refreshExecutionSnapshots(steps.map((entry) => entry.step.agentId));
    const issues: RuntimePreflightIssue[] = [];
    const snapshots: LoopExecutionPlan["steps"] = [];
    const devices = new Set<string>();
    let project: LoopExecutionPlan["project"] | undefined;

    for (const entry of steps) {
      const agent = data.agents.find((candidate) => candidate.id === entry.step.agentId);
      if (!agent) {
        issues.push({ agentId: entry.step.agentId, stepId: `${entry.loopId}:${entry.step.id}`, code: "unbound", message: "Agent definition was not found." });
        continue;
      }
      const check = this.options.controlPlane.preflightAgent(agent.id);
      issues.push(...check.issues.map((issue) => ({ ...issue, stepId: `${entry.loopId}:${entry.step.id}` })));
      if (!check.runtime || !check.project) continue;
      devices.add(check.runtime.deviceId);
      project ??= check.project;
      snapshots.push({
        loopId: entry.loopId,
        stepId: entry.step.id,
        agentId: agent.id,
        agent: agentSnapshotFromAgent(agent, definitionHash(agent)),
        runtime: check.runtime
      });
    }
    if (devices.size > 1) {
      issues.push(...snapshots.map((snapshot) => ({
        agentId: snapshot.agentId,
        stepId: `${snapshot.loopId}:${snapshot.stepId}`,
        code: "mixed_device" as const,
        message: "Every agent step in one root Loop Run must use the same runtime device."
      })));
    }
    if (issues.length > 0 || !project || devices.size !== 1) {
      throw new ControlPlanePreflightError("Loop run preflight failed.", issues);
    }
    return {
      version: 1,
      rootLoopId: loopId,
      deviceId: [...devices][0]!,
      project,
      steps: snapshots,
      createdAt: this.now().toISOString()
    };
  }

  async enqueuePending(_data: AppData, rootRunId: string): Promise<void> {
    const database = this.options.database();
    const runs = database.listRootLoopRuns(rootRunId);
    const plan = runs.find((run) => run.executionPlan)?.executionPlan;
    if (!plan) return;
    const pending = runs.flatMap((run) => run.stepRuns.map((stepRun) => ({ run, stepRun })))
      .find(({ run, stepRun }) => run.status === "running" && stepRun.type === "agent" && stepRun.status === "queued" && !stepRun.executionTaskId);
    if (!pending?.stepRun.agentId) return;
    const snapshot = plan.steps.find((candidate) => candidate.loopId === pending.run.loopId
      && candidate.stepId === pending.stepRun.stepId && candidate.agentId === pending.stepRun.agentId);
    if (!snapshot) throw new Error(`Loop execution snapshot is missing ${pending.run.loopId}:${pending.stepRun.stepId}.`);
    const taskId = uuid();
    const spec: ExecutionSpec = {
      version: 1,
      projectId: database.projectId,
      taskId,
      kind: "loop_step",
      rootRunId,
      loopRunId: pending.run.runId,
      stepRunId: pending.stepRun.stepRunId,
      input: pending.stepRun.input,
      agent: snapshot.agent,
      runtime: snapshot.runtime,
      project: plan.project,
      createdAt: this.now().toISOString()
    };
    const task = this.options.controlPlane.createTask(spec);
    database.bindStepExecution(pending.stepRun.stepRunId, task.id, snapshot.runtime);
  }

  async cancel(rootRunId: string): Promise<void> {
    const taskIds = this.options.database().listRootLoopRuns(rootRunId)
      .flatMap((run) => run.stepRuns.map((stepRun) => stepRun.executionTaskId).filter(Boolean)) as string[];
    for (const taskId of taskIds) {
      const task = this.options.controlPlane.getTask(taskId);
      if (["queued", "claimed", "preparing", "running"].includes(task.status)) await this.options.controlPlane.cancelTask(taskId);
    }
  }

  async finalizeIfTerminal(rootRunId: string): Promise<void> {
    const runs = this.options.database().listRootLoopRuns(rootRunId);
    const disposition = this.rootDisposition(rootRunId);
    const plan = runs.find((run) => run.executionPlan)?.executionPlan;
    const taskIds = runs.flatMap((run) => run.stepRuns
      .map((stepRun) => stepRun.executionTaskId)
      .filter((taskId): taskId is string => Boolean(taskId)));
    if (!disposition.terminal || !plan || taskIds.length === 0) return;
    const hasActiveTask = taskIds.some((taskId) =>
      ["queued", "claimed", "preparing", "running"].includes(this.options.controlPlane.getTask(taskId).status));
    if (hasActiveTask) return;
    this.options.controlPlane.requestRootFinalization({
      projectId: this.options.database().projectId,
      deviceId: plan.deviceId,
      rootRunId,
      success: disposition.success,
      snapshotHash: plan.project.snapshotHash
    });
  }

  markTaskState(task: ExecutionTask): void {
    if (task.spec.kind === "loop_step" && task.spec.stepRunId && task.status === "running") {
      this.options.database().markStepRunRunning(task.spec.stepRunId);
    }
  }

  async handleTerminal(task: ExecutionTask): Promise<RootRunDisposition | undefined> {
    if (task.spec.kind !== "loop_step" || !task.spec.stepRunId) {
      return { terminal: true, success: task.status === "succeeded" };
    }
    const data = await this.options.readData();
    this.options.database().completeAgentStep(data.automation, {
      stepRunId: task.spec.stepRunId,
      outcome: task.outcome,
      error: task.status === "succeeded" ? undefined : task.errorMessage ?? task.errorCode ?? task.status
    });
    await this.enqueuePending(data, task.rootRunId);
    return this.rootDisposition(task.rootRunId);
  }

  rootDisposition(rootRunId: string): RootRunDisposition {
    const runs = this.options.database().listRootLoopRuns(rootRunId);
    const terminal = runs.length > 0 && runs.every((run) => !["running", "waiting_for_human"].includes(run.status));
    return { terminal, success: terminal && runs.every((run) => run.status === "completed") };
  }
}

export const reachableAgentSteps = (data: AppData, rootLoopId: string): Array<{ loopId: string; step: Extract<ProjectStep, { type: "agent" }> }> => {
  const loops = reachableLoops(data, rootLoopId);
  return loops.flatMap((loop) => loop.steps.flatMap((step) => step.type === "agent" ? [{ loopId: loop.id, step }] : []));
};

export const preflightLoopSnapshot = (data: AppData, rootLoopId: string): ProjectLoop | undefined => {
  const root = data.automation.loops.find((loop) => loop.id === rootLoopId);
  if (!root) return undefined;
  const steps = reachableAgentSteps(data, rootLoopId).map(({ loopId, step }) => ({ ...step, id: `${loopId}:${step.id}` }));
  return { id: root.id, start: steps[0]?.id ?? root.start, steps };
};

const reachableLoops = (data: AppData, rootLoopId: string): ProjectLoop[] => {
  const result: ProjectLoop[] = [];
  const visited = new Set<string>();
  const pending = [rootLoopId];
  while (pending.length > 0) {
    const loopId = pending.shift();
    if (!loopId || visited.has(loopId)) continue;
    visited.add(loopId);
    const loop = data.automation.loops.find((candidate) => candidate.id === loopId);
    if (!loop) continue;
    result.push(loop);
    for (const step of loop.steps) {
      for (const target of [step.on.approved, step.on.rejected]) {
        if (typeof target === "object" && "loop" in target) pending.push(target.loop);
      }
    }
  }
  return result;
};

const definitionHash = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");
