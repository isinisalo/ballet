/* eslint-disable max-lines -- One lifecycle service owns durable dispatch, recovery, cancellation, and finalization ordering. */
import type Database from "better-sqlite3";
import type { CreateEnvironmentRunInput, FeedbackSeed, RunEvidenceSeed } from "../../../shared/orchestration/persistence.js";
import type { ValidationOutcome, WorkOutcome } from "../../../shared/orchestration/outcomes.js";
import type { StoredActionExecution, StoredEnvironmentRun } from "../../../shared/orchestration/persistenceRecords.js";
import type { JsonValue } from "../../../shared/orchestration/primitives.js";
import { ActionOutcomeCoordinator } from "../persistence/ActionOutcomeCoordinator.js";
import { EnvironmentRunStore } from "../persistence/EnvironmentRunStore.js";
import { FlowCoordinator } from "../persistence/FlowCoordinator.js";
import { AgentExecutionStore, type StoredExecutionTask } from "../persistence/AgentExecutionStore.js";
import { AgentDispatchFactory, type PreparedAgentDispatch } from "./AgentDispatchFactory.js";
import type { ExecutionQueueBoundary } from "./ExecutionQueueBoundary.js";
import { mapProviderPermissions } from "./ProviderPermissions.js";
import type { OrchestrationRuntimeProvider } from "./RuntimeProvider.js";
import { parseOrchestrationStructuredOutput } from "./StructuredOutputValidator.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";

export interface RunEvidenceFinalizationPort {
  finalize(run: StoredEnvironmentRun, at: string): Promise<RunEvidenceSeed>;
  cleanup?(run: StoredEnvironmentRun): Promise<void>;
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
    private readonly finalizer: RunEvidenceFinalizationPort,
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
    if (["succeeded", "failed"].includes(task.status)) {
      await this.applyPersistedTerminal(task);
      return true;
    }
    if (task.status !== "queued" || !this.execution.claimTask(taskId, this.now())) return true;
    const agent = this.execution.requireAgent(task.agentRunId);
    const run = this.runs.require(agent.environmentRunId);
    if (!["pending", "running"].includes(run.status)) return true;
    this.activeTaskId = taskId;
    const terminal = await this.provider.execute(task.spec, permissionsFor(task));
    this.activeTaskId = undefined;
    if (this.stopping) return true;
    if (!["pending", "running"].includes(this.runs.require(run.environmentRunId).status)) return true;
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
    if (parsed.outcome.role === "work" && parsed.outcome.state === "needs_input") {
      this.outcomes.waitForWorkInput({ taskId, agentRunId: agent.agentRunId,
        providerOutcomeKey: terminal.providerOutcomeKey, expectedActionRevision: this.runs.requireAction(agent.actionExecutionId!).revision,
        outcome: parsed.outcome, completedAt: at });
      return true;
    }
    this.execution.finishTask(taskId, terminal.providerOutcomeKey, "succeeded", { outcome: parsed.outcome }, at);
    await this.applyOutcome(agent.agentRunId, terminal.providerOutcomeKey, parsed.outcome, at);
    return true;
  }

  async reconcile(): Promise<number> {
    this.execution.recoverAfterRestart(this.now());
    this.runs.recoverFinalizations(this.now());
    let count = 0;
    for (const task of this.execution.recoverableTasks().filter(({ spec }) => ["validation", "work"].includes(spec.evidence.role))) {
      if (!this.queue.has(task.taskId)) { this.queue.enqueue(task.taskId); count += 1; }
    }
    for (const run of this.runs.finalizableRuns()) {
      await this.progress(run.environmentRunId);
      count += 1;
    }
    return count;
  }

  private async applyPersistedTerminal(task: StoredExecutionTask): Promise<void> {
    if (!task.providerOutcomeKey) throw new Error(`Terminal task ${task.taskId} lacks a provider outcome key.`);
    const agent = this.execution.requireAgent(task.agentRunId);
    if (task.status === "succeeded") {
      if (!task.outcome) throw new Error(`Succeeded task ${task.taskId} lacks its structured outcome.`);
      await this.applyOutcome(agent.agentRunId, task.providerOutcomeKey,
        task.outcome as ValidationOutcome | WorkOutcome | { role: "critic" | "refinement" }, this.now());
      return;
    }
    if (task.errorCode === "provider_failure") {
      await this.applyProviderFailure(agent.agentRunId, task.providerOutcomeKey, task.errorMessage ?? "Provider failed.", this.now());
      return;
    }
    this.blockInvalid(agent.agentRunId, task.providerOutcomeKey, task.errorMessage ?? "Invalid structured output.", this.now());
  }

  async cancel(environmentRunId: string): Promise<StoredEnvironmentRun> {
    const run = this.runs.require(environmentRunId);
    if (this.activeTaskId) {
      const task = this.execution.requireTask(this.activeTaskId);
      if (task.spec.environmentRunId === environmentRunId) {
        await this.provider.cancel?.(this.activeTaskId, "Environment Run was cancelled by the local operator.");
      }
    }
    return this.flow.stop(environmentRunId, run.revision, "cancelled", this.now());
  }

  answerWorkInput(input: {
    environmentRunId: string; expectedAgentRunId: string; expectedAgentRevision: number;
    answer: string; actorId: string;
  }): StoredEnvironmentRun {
    const run = this.runs.require(input.environmentRunId);
    if (run.status !== "running" || run.activeAgentRunId !== input.expectedAgentRunId) {
      throw new ConflictError("Environment Run no longer has the expected waiting Work Agent.");
    }
    const waiting = this.execution.requireAgent(input.expectedAgentRunId);
    if (waiting.status !== "waiting_for_input" || waiting.role !== "work" || !waiting.actionExecutionId) {
      throw new ConflictError("Expected Agent is not waiting for Work input.");
    }
    const row = this.connection().prepare(
      "SELECT task_envelope_json FROM agent_runs WHERE agent_run_id = ?"
    ).get(waiting.agentRunId) as { task_envelope_json: string };
    const envelope = JSON.parse(row.task_envelope_json) as { dynamicPrompt?: string };
    const resumedPrompt = `${envelope.dynamicPrompt ?? "Continue the delegated Work."}\n\nHuman response (${input.actorId}):\n${input.answer.trim()}`;
    if (resumedPrompt.length > 131072) throw new ConflictError("Work response exceeds the bounded prompt contract.");
    const action = this.runs.requireAction(waiting.actionExecutionId);
    const at = this.now();
    const next = this.dispatches.create({ run, action, role: "work", phase: "work",
      attempt: action.workAttempt + 1, parentAgentRunId: waiting.agentRunId,
      dynamicPrompt: resumedPrompt, at });
    this.connection().transaction(() => {
      this.outcomes.resumeWorkInput({ agentRunId: waiting.agentRunId,
        expectedAgentRevision: input.expectedAgentRevision, expectedActionRevision: action.revision,
        nextWork: next.agent, actorId: input.actorId, resumedAt: at });
      this.execution.createTask(next.task);
    })();
    this.enqueueAfterCommit(next);
    return this.runs.require(input.environmentRunId);
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
      const claimed = this.runs.claimFinalization(environmentRunId, run.revision, this.now());
      try {
        const snapshot = this.withRuntimeEvidence(await this.finalizer.finalize(claimed, this.now()), claimed);
        this.flow.completeEnvironment(snapshot, claimed.revision);
      } catch (error) {
        this.runs.failFinalization(environmentRunId, claimed.revision,
          error instanceof Error ? error.message : String(error), this.now());
        throw error;
      }
      await this.finalizer.cleanup?.(claimed);
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
        attempt: action.workAttempt + 1, parentAgentRunId: agentRunId, workOutcome: outcome, at });
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
    this.connection().transaction(() => {
      this.outcomes.applyWorkFailure({ agentRunId, providerOutcomeKey: key, errorMessage: message,
        expectedActionRevision: action.revision,
        feedback: feedbackFor(action, agentRunId, "provider_failure", message, at), completedAt: at });
    })();
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

  private withRuntimeEvidence(seed: RunEvidenceSeed, run: StoredEnvironmentRun): RunEvidenceSeed {
    const states = this.runs.states(run.environmentRunId).map((state) => ({
      id: state.stateDefinitionId, order: state.order, status: state.status,
      actions: this.runs.actions(state.stateExecutionId).map((action) => ({
        id: action.actionDefinitionId, priority: action.priority, status: action.status,
        workAttempts: action.workAttempt, maxRetries: action.maxRetries,
        evidence: json(this.connection().prepare(`
          SELECT agent_run_id, role, phase, attempt, status, evidence_json, outcome_json
          FROM agent_runs WHERE action_execution_id = ? ORDER BY created_at, agent_run_id
        `).all(action.actionExecutionId))
      }))
    }));
    const feedback = json(this.connection().prepare(`
      SELECT feedback_entry_id, source, category, target_type, target_id, status, evidence_refs_json
      FROM feedback_entries WHERE environment_run_id = ? ORDER BY created_at, feedback_entry_id
    `).all(run.environmentRunId));
    return {
      ...seed,
      validationSummary: json({
        orderedExecution: states,
        feedback,
        approvedUseCases: run.executionSnapshot.approvedUseCases.map(({ useCase, contentSha256 }) => ({
          id: useCase.id, contentSha256, approval: useCase.approval ?? null
        })),
        lineage: run.executionSnapshot.lineage ?? null,
        snapshotSha256: run.executionSnapshotHash
      })
    };
  }
}

const feedbackFor = (
  action: StoredActionExecution, agentRunId: string, source: FeedbackSeed["source"], description: string, at: string
): FeedbackSeed => ({
  feedbackEntryId: `feedback:${agentRunId}`, source, category: source === "validation_blocked" ? "code" : "system",
  targetType: "action_execution", targetId: action.actionExecutionId,
  comment: `${source === "retry_exhaustion" ? "Retry budget exhausted"
    : source === "provider_failure" ? "Provider execution failed" : "Action blocked"}: ${description}`,
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

const json = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
