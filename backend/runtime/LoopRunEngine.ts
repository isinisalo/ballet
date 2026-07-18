import type Database from "better-sqlite3";
import type {
  ProjectAutomationConfig,
  ProjectLoop,
  ProjectStep,
  StepTransitionTarget
} from "../../shared/domain/automation.js";
import { isProjectAgentBackedStep, isProjectTerminalNode, resolveEffectiveStartStep } from "../../shared/domain/automation.js";
import type { LoopTheme } from "../../shared/domain/loopThemes.js";
import type {
  AgentOutcome,
  LoopExecutionPlan,
  LoopRun,
  LoopRunDetails,
  LoopRunSource,
  StepRun,
  StepRunResult
} from "../../shared/domain/runtime.js";
import { LoopRunConflictError, LoopRunNotFoundError, LoopRunStateError } from "./LoopRunErrors.js";
import { LoopRunStore } from "./LoopRunStore.js";
import { MAX_ROOT_TRANSITIONS, now, type CompleteStepRunInput } from "./RuntimeDbTypes.js";

interface StartOptions {
  source?: LoopRunSource;
  input?: string;
  rootRunId?: string;
  parentRunId?: string;
  parentStepRunId?: string;
  executionPlan?: LoopExecutionPlan;
  schedule?: { stepId: string; scheduledFor: string };
}

export type CompleteAgentStepInput = CompleteStepRunInput & { executionTaskId?: string };

const isLoopTarget = (target: StepTransitionTarget): target is { loop: string } =>
  typeof target === "object" && "loop" in target;

const isActiveLoopConstraint = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const code = "code" in error ? String((error as Error & { code?: unknown }).code ?? "") : "";
  return code.startsWith("SQLITE_CONSTRAINT")
    && (error.message.includes("loop_runs.loop_id") || error.message.includes("idx_loop_runs_one_active"));
};

export class LoopRunEngine {
  constructor(
    private readonly connection: () => Database.Database,
    private readonly store: LoopRunStore
  ) {}

  start(
    config: ProjectAutomationConfig,
    loopId: string,
    themeSnapshot: LoopTheme,
    options: StartOptions = {}
  ): LoopRunDetails {
    const transaction = this.connection().transaction(() => {
      const loop = this.requireLoop(config, loopId);
      return this.startInTransaction(loop, themeSnapshot, options);
    });
    try {
      return transaction() as LoopRunDetails;
    } catch (error) {
      if (isActiveLoopConstraint(error)) throw new LoopRunConflictError(`Loop ${loopId} already has an active run.`);
      throw error;
    }
  }

  respond(
    config: ProjectAutomationConfig,
    loopTheme: LoopTheme,
    runId: string,
    stepRunId: string,
    result: StepRunResult,
    input: string
  ): LoopRunDetails {
    const transaction = this.connection().transaction(() => {
      const run = this.requireRun(runId);
      const stepRun = this.requireStepRun(runId, stepRunId);
      const step = this.requireSnapshotStep(run, stepRun.stepId);
      if (step.type !== "human" || stepRun.type !== "human") {
        throw new LoopRunStateError("Only a human step can receive a response.");
      }
      if (run.status !== "waiting_for_human" || stepRun.status !== "waiting_for_human") {
        throw new LoopRunConflictError("The human step is no longer waiting for a response.");
      }
      const target = step.on[result];
      if (this.wouldExceedTransitionLimit(run)) {
        this.store.completeStepRun(stepRun, result, { responseInput: input });
        this.blockForTransitionLimit(run, stepRun);
        return this.requireDetails(runId);
      }
      const forwardedInput = this.forwardedInput(run.input, input);
      if (isLoopTarget(target) && this.store.hasActiveLoop(target.loop)) {
        throw new LoopRunConflictError(`Loop ${target.loop} already has an active run.`);
      }

      this.store.completeStepRun(stepRun, result, { responseInput: input });
      this.store.incrementTransitionCount(run.runId);
      this.store.updateRunInput(run.runId, forwardedInput);
      this.applyTransition(config, loopTheme, this.requireRun(run.runId), stepRun, target, forwardedInput);
      return this.requireDetails(runId);
    });
    try {
      return transaction() as LoopRunDetails;
    } catch (error) {
      if (isActiveLoopConstraint(error)) throw new LoopRunConflictError("The target loop already has an active run.");
      throw error;
    }
  }

  completeAgentStep(
    config: ProjectAutomationConfig,
    loopTheme: LoopTheme,
    input: CompleteAgentStepInput
  ): LoopRunDetails {
    const transaction = this.connection().transaction(() => {
      const stepRun = this.store.getStepRun(input.stepRunId);
      if (!stepRun) throw new LoopRunNotFoundError(`Step run ${input.stepRunId} was not found.`);
      const run = this.requireRun(stepRun.runId);
      if (run.status === "cancelled" || stepRun.status === "cancelled") return this.requireDetails(run.runId);
      if (input.executionTaskId && stepRun.executionTaskId !== input.executionTaskId) {
        return this.requireDetails(run.runId);
      }
      if (stepRun.type !== "agent") throw new LoopRunStateError("A human step cannot be completed by the local runtime.");
      if (stepRun.status !== "running" && stepRun.status !== "queued") {
        return this.requireDetails(run.runId);
      }

      const step = this.requireSnapshotStep(run, stepRun.stepId);
      if (!isProjectAgentBackedStep(step)) {
        throw new LoopRunStateError("An agent StepRun must reference an agent-backed step.");
      }
      const outcome = input.error
        ? this.executionFailure(input.error)
        : input.outcome ?? this.executionFailure("Runtime completed without a structured agent outcome.");
      if (outcome.state === "needs_input") {
        this.store.pauseStepRunForInput(stepRun, outcome);
        this.store.waitForStepInput(run.runId);
        return this.requireDetails(run.runId);
      }
      if (outcome.state === "blocked" || outcome.state === "failed") {
        this.store.finishStepRunWithoutTransition(stepRun, outcome.state, outcome, input.error);
        this.store.finishRun(run.runId, outcome.state);
        return this.requireDetails(run.runId);
      }

      if (outcome.state !== "completed" || !outcome.result) {
        throw new LoopRunStateError("A completed agent outcome must include an approved or rejected result.");
      }
      const result = outcome.result;
      const target = step.on[result];
      if (isLoopTarget(target) && this.store.hasActiveLoop(target.loop)) {
        this.store.blockStepRunWithoutTransition(stepRun, run.runId, `Loop ${target.loop} already has an active run.`);
        return this.requireDetails(run.runId);
      }
      this.store.completeStepRun(stepRun, result, { outcome });
      if (this.wouldExceedTransitionLimit(run)) {
        this.blockForTransitionLimit(run, stepRun);
        return this.requireDetails(run.runId);
      }
      this.store.incrementTransitionCount(run.runId);
      this.applyTransition(config, loopTheme, run, stepRun, target, run.input);
      return this.requireDetails(run.runId);
    });
    return transaction() as LoopRunDetails;
  }

  resumeAgentStep(runId: string, stepRunId: string, input: string): LoopRunDetails {
    if (!input.trim()) throw new LoopRunStateError("Resume input is required.");
    const transaction = this.connection().transaction(() => {
      const run = this.requireRun(runId);
      const stepRun = this.requireStepRun(runId, stepRunId);
      const step = this.requireSnapshotStep(run, stepRun.stepId);
      if (!isProjectAgentBackedStep(step) || stepRun.type !== "agent") {
        throw new LoopRunStateError("Only an agent step can resume after requesting input.");
      }
      if (run.status !== "waiting_for_human" || stepRun.status !== "needs_input"
        || stepRun.outcome?.state !== "needs_input") {
        throw new LoopRunConflictError("The agent step is no longer waiting for input.");
      }

      const runInput = this.forwardedInput(run.input, input);
      const stepInput = this.forwardedInput(stepRun.input, input);
      const responseInput = this.forwardedInput(stepRun.responseInput, input);
      this.store.resumeStepRun(stepRun, stepInput, responseInput);
      this.store.resumeRun(run.runId, runInput);
      return this.requireDetails(runId);
    });
    return transaction() as LoopRunDetails;
  }

  cancel(runId: string): LoopRunDetails {
    const transaction = this.connection().transaction(() => {
      const run = this.requireRun(runId);
      if (!["running", "waiting_for_human"].includes(run.status)) {
        throw new LoopRunConflictError(`Loop run ${runId} is already ${run.status}.`);
      }
      const timestamp = now();
      this.connection().prepare(`
        UPDATE step_runs SET status = 'cancelled', completed_at = @completedAt, updated_at = @updatedAt
        WHERE run_id = @runId AND status IN ('queued', 'running', 'waiting_for_human', 'needs_input')
      `).run({ runId, completedAt: timestamp, updatedAt: timestamp });
      this.store.finishRun(runId, "cancelled");
      return this.requireDetails(runId);
    });
    return transaction() as LoopRunDetails;
  }

  private startInTransaction(
    loop: ProjectLoop,
    themeSnapshot: LoopTheme,
    options: StartOptions
  ): LoopRunDetails {
    if (this.store.hasActiveLoop(loop.id)) {
      throw new LoopRunConflictError(`Loop ${loop.id} already has an active run.`);
    }
    const run = this.store.createLoopRun({
      loop,
      themeSnapshot,
      rootRunId: options.rootRunId,
      parentRunId: options.parentRunId,
      parentStepRunId: options.parentStepRunId,
      executionPlan: options.executionPlan,
      schedule: options.schedule,
      source: options.source ?? "manual",
      input: options.input
    });
    const firstStep = resolveEffectiveStartStep(loop);
    if (!firstStep) throw new LoopRunStateError(`Loop ${loop.id} does not have an executable start step.`);
    this.store.createStepRun(run, firstStep, options.input);
    return this.requireDetails(run.runId);
  }

  private applyTransition(
    config: ProjectAutomationConfig,
    loopTheme: LoopTheme,
    run: LoopRun,
    sourceStepRun: StepRun,
    target: StepTransitionTarget,
    input?: string
  ): void {
    if (typeof target === "string") {
      const nextNode = run.snapshot.nodes.find((node) => node.id === target);
      if (!nextNode) {
        this.store.finishRun(run.runId, "blocked");
        return;
      }
      if (isProjectTerminalNode(nextNode)) {
        this.store.finishRun(run.runId, nextNode.type);
        return;
      }
      if (nextNode.type === "scheduled") {
        this.store.finishRun(run.runId, "blocked");
        return;
      }
      this.store.createStepRun(this.requireRun(run.runId), nextNode, input);
      return;
    }
    if (!isLoopTarget(target)) {
      this.store.finishRun(run.runId, "blocked");
      return;
    }
    const targetLoop = this.requireLoop(config, target.loop);
    this.store.finishRun(run.runId, "completed");
    this.startInTransaction(targetLoop, loopTheme, {
      source: "transition",
      input,
      rootRunId: run.rootRunId,
      parentRunId: run.runId,
      parentStepRunId: sourceStepRun.stepRunId,
      executionPlan: run.executionPlan
    });
  }

  private wouldExceedTransitionLimit(run: LoopRun): boolean {
    return this.store.rootTransitionCount(run.rootRunId) + 1 > MAX_ROOT_TRANSITIONS;
  }

  private blockForTransitionLimit(run: LoopRun, stepRun: StepRun): void {
    this.store.blockStepRunWithoutTransition(stepRun, run.runId,
      `Root transition limit of ${MAX_ROOT_TRANSITIONS} reached.`);
  }

  private forwardedInput(runInput: string | undefined, responseInput: string): string {
    if (!runInput) return responseInput;
    return `${runInput}\n\n${responseInput}`;
  }

  private executionFailure(message: string): AgentOutcome {
    return { state: "failed", summary: message, checks: [] };
  }

  private requireLoop(config: ProjectAutomationConfig, loopId: string): ProjectLoop {
    const loop = config.loops.find((candidate) => candidate.id === loopId);
    if (!loop) throw new LoopRunNotFoundError(`Loop ${loopId} was not found.`);
    return loop;
  }

  private requireRun(runId: string): LoopRun {
    const run = this.store.getLoopRun(runId);
    if (!run) throw new LoopRunNotFoundError(`Loop run ${runId} was not found.`);
    return run;
  }

  private requireStepRun(runId: string, stepRunId: string): StepRun {
    const stepRun = this.store.getStepRun(stepRunId);
    if (!stepRun || stepRun.runId !== runId) {
      throw new LoopRunNotFoundError(`Step run ${stepRunId} was not found in loop run ${runId}.`);
    }
    return stepRun;
  }

  private requireSnapshotStep(run: LoopRun, stepId: string): ProjectStep {
    const step = run.snapshot.nodes.find((candidate) => candidate.id === stepId);
    if (!step || isProjectTerminalNode(step)) throw new LoopRunStateError(`Step ${stepId} was not found in the run snapshot.`);
    return step;
  }

  private requireDetails(runId: string): LoopRunDetails {
    const details = this.store.details(runId);
    if (!details) throw new LoopRunNotFoundError(`Loop run ${runId} was not found.`);
    return details;
  }
}
