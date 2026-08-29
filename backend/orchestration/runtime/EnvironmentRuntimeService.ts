import type Database from "better-sqlite3";
import type { CreateEnvironmentRunInput, FeedbackSeed, ProductSnapshotSeed } from "../../../shared/orchestration/persistence.js";
import type { ValidationOutcome, WorkOutcome } from "../../../shared/orchestration/outcomes.js";
import type { StoredActionExecution, StoredEnvironmentRun } from "../../../shared/orchestration/persistenceRecords.js";
import { ActionOutcomeCoordinator } from "../persistence/ActionOutcomeCoordinator.js";
import { EnvironmentRunStore } from "../persistence/EnvironmentRunStore.js";
import { FlowCoordinator } from "../persistence/FlowCoordinator.js";
import { AgentExecutionStore, type StoredExecutionTask } from "../persistence/AgentExecutionStore.js";
import { AgentDispatchFactory, failedWorkOutcome, type PreparedAgentDispatch } from "./AgentDispatchFactory.js";
import type { ExecutionQueueBoundary } from "./ExecutionQueueBoundary.js";
import { mapProviderPermissions } from "./ProviderPermissions.js";
import type { OrchestrationRuntimeProvider } from "./RuntimeProvider.js";
import { parseOrchestrationStructuredOutput } from "./StructuredOutputValidator.js";

export interface ProductFinalizationPort {
  finalize(run: StoredEnvironmentRun, at: string): Promise<ProductSnapshotSeed>;
}

export class EnvironmentRuntimeService {
  private readonly flow: FlowCoordinator;
  private readonly outcomes: ActionOutcomeCoordinator;
  private readonly runs: EnvironmentRunStore;
  private readonly execution: AgentExecutionStore;
  private readonly dispatches: AgentDispatchFactory;
  private activeTaskId?: string;
  private stopping = false;

  constructor(
    private readonly connection: () => Database.Database,
    private readonly queue: ExecutionQueueBoundary,
    private readonly provider: OrchestrationRuntimeProvider,
    private readonly finalizer: ProductFinalizationPort,
    nextId: (kind: string) => string,
    private readonly now: () => string
  ) {
    this.flow = new FlowCoordinator(this.connection);
    this.outcomes = new ActionOutcomeCoordinator(this.connection);
    this.runs = new EnvironmentRunStore(this.connection);
    this.execution = new AgentExecutionStore(this.connection);
    this.dispatches = new AgentDispatchFactory(nextId);
  }

  async start(input: CreateEnvironmentRunInput): Promise<StoredEnvironmentRun> {
    this.flow.createEnvironmentRun(input);
    await this.progress(input.environmentRunId);
    return this.runs.require(input.environmentRunId);
  }

  async resume(environmentRunId: string): Promise<StoredEnvironmentRun> {
    await this.progress(environmentRunId);
    return this.runs.require(environmentRunId);
  }

  async processNext(): Promise<boolean> {
    if (this.stopping) return false;
    const taskId = this.queue.next();
    if (!taskId) return false;
    const task = this.execution.requireTask(taskId);
    if (task.status !== "queued" || !this.execution.claimTask(taskId, this.now())) return true;
    const agent = this.execution.requireAgent(task.agentRunId);
    const run = this.runs.require(agent.environmentRunId);
    if (!["pending", "running"].includes(run.status)) return true;
    this.activeTaskId = taskId;
    const terminal = await this.provider.execute(task.spec, permissionsFor(task));
    this.activeTaskId = undefined;
    if (this.stopping) return true;
    const at = this.now();
    if (terminal.kind === "failure") {
      this.execution.finishTask(taskId, terminal.providerOutcomeKey, "failed", {
        errorCode: "provider_failure", errorMessage: terminal.errorMessage
      }, at);
      await this.applyProviderFailure(agent.agentRunId, terminal.providerOutcomeKey, terminal.errorMessage, at);
      return true;
    }
    const parsed = parseOrchestrationStructuredOutput(terminal.raw, { role: agent.role, phase: agent.phase });
    if (!parsed.success) {
      this.execution.finishTask(taskId, terminal.providerOutcomeKey, "failed", {
        errorCode: "invalid_structured_output", errorMessage: parsed.error
      }, at);
      this.blockInvalid(agent.agentRunId, terminal.providerOutcomeKey, parsed.error, at);
      return true;
    }
    this.execution.finishTask(taskId, terminal.providerOutcomeKey, "succeeded", { outcome: parsed.outcome }, at);
    await this.applyOutcome(agent.agentRunId, terminal.providerOutcomeKey, parsed.outcome, at);
    return true;
  }

  reconcile(): number {
    let count = 0;
    for (const task of this.execution.pendingTasks().filter(({ spec }) => ["validation", "work"].includes(spec.evidence.role))) {
      if (!this.queue.has(task.taskId)) { this.queue.enqueue(task.taskId); count += 1; }
    }
    return count;
  }

  cancel(environmentRunId: string): StoredEnvironmentRun {
    const run = this.runs.require(environmentRunId);
    return this.flow.stop(environmentRunId, run.revision, "cancelled", this.now());
  }

  async shutdown(): Promise<void> {
    this.stopping = true;
    if (this.activeTaskId) await this.provider.cancel?.(this.activeTaskId, "Ballet orchestration is shutting down.");
    const rows = this.connection().prepare(
      "SELECT environment_run_id FROM environment_runs WHERE status IN ('pending','running')"
    ).all() as Array<{ environment_run_id: string }>;
    for (const row of rows) {
      const run = this.runs.require(row.environment_run_id);
      this.flow.stop(run.environmentRunId, run.revision, "interrupted", this.now());
    }
  }

  private async progress(environmentRunId: string): Promise<void> {
    let run = this.runs.require(environmentRunId);
    if (!["pending", "running"].includes(run.status) || run.activeActionExecutionId || run.activeAgentRunId) return;
    const states = this.runs.states(environmentRunId);
    const runningState = states.find(({ status }) => status === "running");
    if (runningState && this.runs.actions(runningState.stateExecutionId).every(({ status }) => status === "done")) {
      this.flow.completeState(runningState.stateExecutionId, runningState.revision, this.now());
      run = this.runs.require(environmentRunId);
    }
    if (this.runs.states(environmentRunId).every(({ status }) => status === "done")) {
      const snapshot = await this.finalizer.finalize(run, this.now());
      this.flow.completeEnvironment(snapshot, run.revision);
      return;
    }
    const action = this.flow.advance(environmentRunId, run.revision, this.now());
    const selectedRun = this.runs.require(environmentRunId);
    const dispatch = this.dispatches.create({
      run: selectedRun, action, role: "validation", phase: "precheck", attempt: action.workAttempt + 1, at: this.now()
    });
    this.connection().transaction(() => {
      const agent = this.outcomes.createPrecheck(action.actionExecutionId, action.revision, dispatch.agent);
      if (dispatch.agent.agentRunId !== agent.agentRunId) throw new Error("Persisted Agent differs from dispatch task.");
      this.execution.createTask(dispatch.task);
    })();
    this.enqueueAfterCommit(dispatch);
  }

  private async applyOutcome(
    agentRunId: string, providerOutcomeKey: string,
    outcome: ValidationOutcome | WorkOutcome | { role: "critic" | "refinement" }, at: string
  ): Promise<void> {
    const agent = this.execution.requireAgent(agentRunId);
    if (!agent.actionExecutionId) throw new Error("Governance Agent outcomes use their dedicated service.");
    const action = this.runs.requireAction(agent.actionExecutionId);
    const run = this.runs.require(action.environmentRunId);
    if (outcome.role === "work") {
      const next = this.dispatches.create({ run, action, role: "validation", phase: "postwork",
        attempt: action.workAttempt, parentAgentRunId: agentRunId, workOutcome: outcome, at });
      this.connection().transaction(() => {
        this.outcomes.applyWork({ agentRunId, providerOutcomeKey, expectedActionRevision: action.revision,
          outcome, nextValidation: next.agent, completedAt: at });
        this.execution.createTask(next.task);
      })();
      this.enqueueAfterCommit(next);
      return;
    }
    if (outcome.role !== "validation") throw new Error("Unsupported Environment Agent outcome.");
    if (outcome.result.phase === "precheck") {
      const next = outcome.result.decision === "delegate" ? this.dispatches.create({
        run, action, role: "work", phase: "work", attempt: action.workAttempt + 1,
        parentAgentRunId: agentRunId, dynamicPrompt: outcome.result.workPrompt, at
      }) : undefined;
      this.connection().transaction(() => {
        this.outcomes.applyPrecheck({ agentRunId, providerOutcomeKey, expectedActionRevision: action.revision,
          outcome, nextWork: next?.agent,
          feedback: outcome.result.decision === "blocked" ? feedbackFor(action, agentRunId, "validation_blocked", outcome.result.reason, at) : undefined,
          completedAt: at });
        if (next) this.execution.createTask(next.task);
      })();
      if (next) this.enqueueAfterCommit(next);
      else await this.progress(action.environmentRunId);
      return;
    }
    const retryDecision = outcome.result.decision === "retry" ? outcome.result : undefined;
    const next = retryDecision && action.workAttempt < action.maxRetries + 1 ? this.dispatches.create({
      run, action, role: "work", phase: "work", attempt: action.workAttempt + 1,
      parentAgentRunId: agentRunId, dynamicPrompt: retryDecision.workPrompt,
      previousValidationFeedback: retryDecision.feedback, at
    }) : undefined;
    const source = retryDecision && !next ? "retry_exhaustion" : "validation_blocked";
    this.connection().transaction(() => {
      this.outcomes.applyPostwork({ agentRunId, providerOutcomeKey, expectedActionRevision: action.revision,
        outcome, nextWork: next?.agent,
        feedback: outcome.result.decision === "blocked" || (retryDecision && !next)
          ? feedbackFor(action, agentRunId, source, outcome.result.decision === "blocked" ? outcome.result.reason : retryDecision!.feedback, at)
          : undefined,
        completedAt: at });
      if (next) this.execution.createTask(next.task);
    })();
    if (next) this.enqueueAfterCommit(next);
    else await this.progress(action.environmentRunId);
  }

  private async applyProviderFailure(agentRunId: string, key: string, message: string, at: string): Promise<void> {
    const agent = this.execution.requireAgent(agentRunId);
    if (!agent.actionExecutionId || agent.role !== "work") {
      this.blockInvalid(agentRunId, key, `Provider failure: ${message}`, at);
      return;
    }
    const action = this.runs.requireAction(agent.actionExecutionId);
    const next = this.dispatches.create({
      run: this.runs.require(action.environmentRunId), action, role: "validation", phase: "postwork",
      attempt: action.workAttempt, parentAgentRunId: agentRunId, workOutcome: failedWorkOutcome(message), at
    });
    this.connection().transaction(() => {
      this.outcomes.applyWorkFailure({ agentRunId, providerOutcomeKey: key, errorMessage: message,
        expectedActionRevision: action.revision, nextValidation: next.agent, completedAt: at });
      this.execution.createTask(next.task);
    })();
    this.enqueueAfterCommit(next);
  }

  private blockInvalid(agentRunId: string, key: string, message: string, at: string): void {
    const agent = this.execution.requireAgent(agentRunId);
    if (!agent.actionExecutionId) throw new Error("Invalid governance output uses its dedicated service.");
    const action = this.runs.requireAction(agent.actionExecutionId);
    this.outcomes.blockInvalidOutput({ agentRunId, providerOutcomeKey: key, expectedActionRevision: action.revision,
      errorMessage: message, feedback: feedbackFor(action, agentRunId, "system_invalid_output", message, at), completedAt: at });
  }

  private enqueueAfterCommit(dispatch: PreparedAgentDispatch): void {
    this.queue.enqueue(dispatch.task.spec.taskId);
  }
}

const feedbackFor = (
  action: StoredActionExecution, agentRunId: string, source: FeedbackSeed["source"], description: string, at: string
): FeedbackSeed => ({
  feedbackEntryId: `feedback:${agentRunId}`, source, category: source === "system_invalid_output" ? "system" : "product",
  targetType: "action_execution", targetId: action.actionExecutionId,
  title: source === "retry_exhaustion" ? "Retry budget exhausted" : "Action blocked",
  description, correctiveActions: ["Review the recorded evidence and correct the Action input or resources."],
  environmentRunId: action.environmentRunId, stateExecutionId: action.stateExecutionId,
  actionExecutionId: action.actionExecutionId, agentRunId,
  provenance: { source, agentRunId }, createdAt: at
});

const permissionsFor = (task: StoredExecutionTask) => {
  const role = task.spec.evidence.role;
  const policy = role === "work" ? "workspace_write" : "read_only";
  return mapProviderPermissions({ provider: task.spec.runtime.provider, role, toolPolicy: policy,
    networkAccess: task.spec.runtime.networkAccess, worktreePath: task.spec.project.checkoutRoot });
};
