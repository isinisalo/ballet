import type { AppData } from "../../shared/api/workspaceData.js";
import type { LoopExecutionPlan, LoopRunSource, StepRunResult } from "../../shared/domain/runtime.js";
import { LoopRunNotFoundError, LoopRunStateError } from "../runtime/LoopRunErrors.js";
import { notifyRuntimeChanged } from "../runtime-events.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import type { DispatchLoopScheduleInput, DispatchLoopScheduleResult } from "../runtime-db.js";
import { scheduleDefinitionHash } from "../scheduling/ScheduleDefinition.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";
import { loopContainsAgentWork, type LoopExecutionGateway } from "./LoopExecutionGateway.js";
import { validateLoopRunStart } from "./LoopRunStartPolicy.js";

export class LoopRunService {
  private executionGateway?: LoopExecutionGateway;

  constructor(
    private readonly readData: () => Promise<AppData>,
    private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider,
    private readonly now: () => Date = () => new Date()
  ) {}

  setExecutionGateway(gateway: LoopExecutionGateway): void {
    this.executionGateway = gateway;
  }

  async start(loopId: string, input?: string, source: LoopRunSource = "manual") {
    const data = await this.readData();
    if (data.automationIssues.length > 0) {
      throw new LoopRunStateError("Cannot start a loop while project.json is invalid.");
    }
    await validateLoopRunStart(data, loopId, input);
    if (!this.executionGateway && loopContainsAgentWork(data, loopId)) {
      throw new LoopRunStateError("Cannot start an agent loop before the runtime control plane is configured.");
    }
    const plan = await this.executionGateway?.prepare(data, loopId);
    const run = this.database().startLoopRun(data.automation, loopId, input, source, plan?.deviceId, plan);
    if (this.executionGateway) await this.executionGateway.enqueuePending(data, run.rootRunId);
    notifyRuntimeChanged("loop-runs");
    return this.database().getLoopRun(run.runId) ?? run;
  }

  async dispatchScheduled(input: Omit<DispatchLoopScheduleInput, "runtimeDeviceId" | "executionPlan"> & {
    canDispatch?: () => boolean;
  }): Promise<DispatchLoopScheduleResult> {
    const { canDispatch, ...dispatchInput } = input;
    let data: AppData;
    let plan: LoopExecutionPlan | undefined;
    try {
      data = await this.readData();
      if (data.automationIssues.length > 0) {
        throw new LoopRunStateError("Cannot start a loop while project.json is invalid.");
      }
      if (!matchesScheduleDefinition(data, input)) return { status: "stale" };
      if (this.database().activeLoopIds().includes(input.loopId)) {
        return this.skipScheduled(dispatchInput, `Loop ${input.loopId} already has an active run.`);
      }
      const automationSnapshot = JSON.stringify(data.automation);
      await validateLoopRunStart(data, input.loopId, undefined);
      if (!this.executionGateway && loopContainsAgentWork(data, input.loopId)) {
        throw new LoopRunStateError("Cannot start an agent loop before the runtime control plane is configured.");
      }
      plan = await this.executionGateway?.prepare(data, input.loopId);
      const currentData = await this.readData();
      if (
        currentData.automationIssues.length > 0
        || JSON.stringify(currentData.automation) !== automationSnapshot
        || !matchesScheduleDefinition(currentData, input)
      ) return { status: "stale" };
      data = currentData;
    } catch (error) {
      return this.skipScheduled(dispatchInput, errorMessage(error));
    }

    if (canDispatch && !canDispatch()) return { status: "stale" };
    const attemptedAt = this.now();
    if (attemptedAt.getTime() >= Date.parse(dispatchInput.scheduledFor) + 60_000) {
      return this.completeScheduled(dispatchInput, "missed", "Scheduled occurrence expired before runtime preflight completed.");
    }

    let result: DispatchLoopScheduleResult;
    try {
      result = this.database().dispatchLoopScheduleOccurrence(data.automation, {
        ...dispatchInput,
        runtimeDeviceId: plan?.deviceId,
        executionPlan: plan,
        updatedAt: attemptedAt.toISOString()
      });
    } catch (error) {
      return this.skipScheduled(dispatchInput, errorMessage(error));
    }
    if (result.status !== "stale") notifyRuntimeChanged("schedules");
    if (result.status === "started") {
      notifyRuntimeChanged("loop-runs");
      if (this.executionGateway) await this.executionGateway.enqueuePending(data, result.run.rootRunId);
    }
    return result;
  }

  async latest(loopId: string) {
    const data = await this.readData();
    if (!data.automation.loops.some((loop) => loop.id === loopId)) {
      throw new LoopRunNotFoundError(`Loop ${loopId} was not found.`);
    }
    return this.database().latestLoopRun(loopId) ?? null;
  }

  async respond(runId: string, stepRunId: string, result: StepRunResult, input: string) {
    const data = await this.readData();
    const run = this.database().respondToStepRun(data.automation, runId, stepRunId, result, input);
    if (this.executionGateway) await this.executionGateway.enqueuePending(data, run.rootRunId);
    await this.executionGateway?.finalizeIfTerminal(run.rootRunId);
    notifyRuntimeChanged("loop-runs");
    return run;
  }

  async cancel(runId: string) {
    const run = this.database().cancelLoopRun(runId);
    await this.executionGateway?.cancel(run.rootRunId);
    await this.executionGateway?.finalizeIfTerminal(run.rootRunId);
    notifyRuntimeChanged("loop-runs");
    return run;
  }

  list() {
    return this.database().listLoopRuns();
  }

  listActive() {
    return this.database().listActiveLoopRuns();
  }

  database(): RuntimeDatabase {
    return this.runtimeDatabaseProvider.runtimeDatabase();
  }

  private skipScheduled(
    input: Omit<DispatchLoopScheduleInput, "runtimeDeviceId" | "executionPlan">,
    error: string
  ): DispatchLoopScheduleResult {
    return this.completeScheduled(input, "skipped", error);
  }

  private completeScheduled(
    input: Omit<DispatchLoopScheduleInput, "runtimeDeviceId" | "executionPlan">,
    status: "skipped" | "missed",
    error: string
  ): DispatchLoopScheduleResult {
    const completed = this.database().completeLoopScheduleOccurrence({
      ...input,
      status,
      error,
      updatedAt: this.now().toISOString()
    });
    if (!completed) return { status: "stale" };
    notifyRuntimeChanged("schedules");
    return { status, error };
  }
}

const errorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  const issues = "issues" in error && Array.isArray(error.issues) ? error.issues : [];
  const details = issues.flatMap((issue) => {
    if (!issue || typeof issue !== "object" || !("message" in issue) || typeof issue.message !== "string") return [];
    const stepId = "stepId" in issue && typeof issue.stepId === "string" ? issue.stepId : undefined;
    const agentId = "agentId" in issue && typeof issue.agentId === "string" ? issue.agentId : undefined;
    return [`${stepId ?? agentId ?? "Preflight"}: ${issue.message}`];
  });
  return details.length > 0 ? `${error.message} ${details.join("; ")}` : error.message;
};

const matchesScheduleDefinition = (
  data: AppData,
  input: Pick<DispatchLoopScheduleInput, "loopId" | "stepId" | "definitionHash">
): boolean => {
  const loop = data.automation.loops.find((candidate) => candidate.id === input.loopId);
  const step = loop?.steps.find((candidate) => candidate.id === input.stepId);
  return Boolean(
    loop?.start === input.stepId
    && step?.type === "scheduled"
    && scheduleDefinitionHash(step.schedule, step.on.triggered) === input.definitionHash
  );
};
