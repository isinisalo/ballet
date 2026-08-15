import type Database from "better-sqlite3";
import type {
  ProjectLoop,
  StepTransitionTarget
} from "../../shared/domain/automation.js";
import { isProjectExecutionStep, isProjectTerminalNode, resolveEffectiveStartStep } from "../../shared/domain/automation.js";
import type {
  LoopRun,
  LoopRunDetails,
  LoopRunSource,
  RootExecutionSnapshot,
  StepRun,
  StepRunResult
} from "../../shared/domain/runtime.js";
import {
  LoopRunConflictError,
  LoopRunIntegrityError,
  LoopRunNotFoundError,
  LoopRunStateError
} from "./LoopRunErrors.js";
import { LoopRunStore } from "./LoopRunStore.js";
import { persistNonCompletedOutcome } from "./LoopRunOutcomePersistence.js";
import {
  failedStepOutcome,
  forwardedStepInput,
  isActiveLoopConstraint,
  isLoopTarget,
  persistedTransitionResult
} from "./LoopRunTransitionPolicy.js";
import { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import { MAX_ROOT_TRANSITIONS, now, type CompleteStepRunInput } from "./RuntimeDbTypes.js";

interface StartOptions {
  source?: LoopRunSource;
  input?: string;
  rootRunId: string;
  parentRunId?: string;
  parentStepRunId?: string;
  schedule?: { stepId: string; scheduledFor: string };
}

export type CompleteExecutionStepInput = CompleteStepRunInput & { executionTaskId?: string };

export class LoopRunEngine {
  constructor(
    private readonly connection: () => Database.Database,
    private readonly store: LoopRunStore,
    private readonly snapshots: RootExecutionSnapshotStore
  ) {}

  start(rootRunId: string, options: Omit<StartOptions, "rootRunId"> = {}): LoopRunDetails {
    const transaction = this.connection().transaction(() => {
      const snapshot = this.snapshots.require(rootRunId);
      const loop = this.snapshots.loop(snapshot, snapshot.rootLoopId);
      return this.startInTransaction(loop, snapshot, { ...options, rootRunId });
    });
    try {
      return transaction() as LoopRunDetails;
    } catch (error) {
      if (isActiveLoopConstraint(error)) {
        const loopId = this.snapshots.require(rootRunId).rootLoopId;
        throw new LoopRunConflictError(`Loop ${loopId} already has an active run.`);
      }
      throw error;
    }
  }

  respond(runId: string, stepRunId: string, result: StepRunResult, input: string): LoopRunDetails {
    const transaction = this.connection().transaction(() => {
      const run = this.requireRun(runId);
      const snapshot = this.snapshots.require(run.rootRunId);
      const stepRun = this.requireStepRun(runId, stepRunId);
      const step = this.requireSnapshotStep(snapshot, run, stepRun.stepId);
      if (step.type !== "human" || stepRun.type !== "human") {
        throw new LoopRunStateError("Only a human step can receive a response.");
      }
      if (run.status !== "waiting_for_human" || stepRun.status !== "waiting_for_human") {
        throw new LoopRunConflictError("The human step is no longer waiting for a response.");
      }

      const completed = this.store.completeStepRun(stepRun, result, { responseInput: input });
      const persistedResult = persistedTransitionResult(completed);
      const target = step.on[persistedResult];
      if (this.wouldExceedTransitionLimit(run)) {
        this.blockForTransitionLimit(run, completed);
        return this.requireDetails(runId);
      }
      const forwardedInput = forwardedStepInput(run.input, input);
      if (isLoopTarget(target) && this.store.hasActiveLoop(target.loop)) {
        throw new LoopRunConflictError(`Loop ${target.loop} already has an active run.`);
      }

      this.store.incrementTransitionCount(run.runId);
      this.store.updateRunInput(run.runId, forwardedInput);
      this.applyTransition(snapshot, this.requireRun(run.runId), completed, target, forwardedInput);
      return this.requireDetails(runId);
    });
    try {
      return transaction() as LoopRunDetails;
    } catch (error) {
      if (isActiveLoopConstraint(error)) throw new LoopRunConflictError("The target loop already has an active run.");
      throw error;
    }
  }

  completeExecutionStep(input: CompleteExecutionStepInput): LoopRunDetails {
    const transaction = this.connection().transaction(() => {
      const stepRun = this.store.getStepRun(input.stepRunId);
      if (!stepRun) throw new LoopRunNotFoundError(`Step run ${input.stepRunId} was not found.`);
      const run = this.requireRun(stepRun.runId);
      const snapshot = this.snapshots.require(run.rootRunId);
      if (run.status === "cancelled" || stepRun.status === "cancelled") return this.requireDetails(run.runId);
      if (input.executionTaskId && stepRun.executionTaskId !== input.executionTaskId) {
        return this.requireDetails(run.runId);
      }
      if (stepRun.type === "human") {
        throw new LoopRunStateError("A human step cannot be completed by the local runtime.");
      }
      if (stepRun.status !== "running" && stepRun.status !== "queued") {
        return this.requireDetails(run.runId);
      }

      const step = this.requireSnapshotStep(snapshot, run, stepRun.stepId);
      if (!isProjectExecutionStep(step) || step.type !== stepRun.type) {
        throw new LoopRunIntegrityError("An execution Step Run does not match its immutable Step snapshot.");
      }
      const outcome = input.error
        ? failedStepOutcome(input.error)
        : input.outcome ?? failedStepOutcome("Runtime completed without a structured Step outcome.");
      if (persistNonCompletedOutcome(this.store, run, stepRun, outcome, input.error)) {
        return this.requireDetails(run.runId);
      }
      if (outcome.state !== "completed" || !outcome.result) {
        throw new LoopRunStateError("A completed Step outcome must include an approved or rejected result.");
      }

      // The provider outcome is first persisted. The transition engine then reads
      // the canonical result back through the store and never branches on the
      // provider payload held in memory.
      const completed = this.store.completeStepRun(stepRun, outcome.result, { outcome });
      const persistedResult = persistedTransitionResult(completed);
      const target = step.on[persistedResult];
      if (isLoopTarget(target) && this.store.hasActiveLoop(target.loop)) {
        this.store.blockStepRunWithoutTransition(completed, run.runId, `Loop ${target.loop} already has an active run.`);
        return this.requireDetails(run.runId);
      }
      if (this.wouldExceedTransitionLimit(run)) {
        this.blockForTransitionLimit(run, completed);
        return this.requireDetails(run.runId);
      }
      this.store.incrementTransitionCount(run.runId);
      this.applyTransition(snapshot, run, completed, target, run.input);
      return this.requireDetails(run.runId);
    });
    return transaction() as LoopRunDetails;
  }

  resumeExecutionStep(runId: string, stepRunId: string, input: string): LoopRunDetails {
    if (!input.trim()) throw new LoopRunStateError("Resume input is required.");
    const transaction = this.connection().transaction(() => {
      const run = this.requireRun(runId);
      const snapshot = this.snapshots.require(run.rootRunId);
      const stepRun = this.requireStepRun(runId, stepRunId);
      const step = this.requireSnapshotStep(snapshot, run, stepRun.stepId);
      if (!isProjectExecutionStep(step) || stepRun.type === "human") {
        throw new LoopRunStateError("Only an execution step can resume after requesting input.");
      }
      if (run.status !== "waiting_for_human" || stepRun.status !== "needs_input"
        || stepRun.outcome?.state !== "needs_input") {
        throw new LoopRunConflictError("The execution step is no longer waiting for input.");
      }

      const runInput = forwardedStepInput(run.input, input);
      const stepInput = forwardedStepInput(stepRun.input, input);
      this.store.resumeStepRun(stepRun, stepInput, input);
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
        UPDATE step_runs SET status = 'cancelled', result = NULL, completed_at = @completedAt, updated_at = @updatedAt
        WHERE run_id = @runId AND status IN ('queued', 'running', 'waiting_for_human', 'needs_input')
      `).run({ runId, completedAt: timestamp, updatedAt: timestamp });
      this.store.finishRun(runId, "cancelled");
      return this.requireDetails(runId);
    });
    return transaction() as LoopRunDetails;
  }

  private startInTransaction(
    loop: ProjectLoop,
    snapshot: RootExecutionSnapshot,
    options: StartOptions
  ): LoopRunDetails {
    if (this.store.hasActiveLoop(loop.id)) {
      throw new LoopRunConflictError(`Loop ${loop.id} already has an active run.`);
    }
    const run = this.store.createLoopRun({
      loop,
      rootRunId: options.rootRunId,
      parentRunId: options.parentRunId,
      parentStepRunId: options.parentStepRunId,
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
    snapshot: RootExecutionSnapshot,
    run: LoopRun,
    sourceStepRun: StepRun,
    target: StepTransitionTarget,
    input?: string
  ): void {
    if (typeof target === "string") {
      const sourceLoop = this.snapshots.loop(snapshot, run.loopId);
      const nextNode = sourceLoop.nodes.find((node) => node.id === target);
      if (!nextNode) {
        throw new LoopRunIntegrityError(`Transition target ${run.loopId}:${target} is missing from the Run snapshot.`);
      }
      if (isProjectTerminalNode(nextNode)) {
        this.store.finishRun(run.runId, nextNode.type);
        return;
      }
      this.store.createStepRun(this.requireRun(run.runId), nextNode, input);
      return;
    }
    if (!isLoopTarget(target)) {
      throw new LoopRunIntegrityError(`Step ${sourceStepRun.stepId} has an invalid persisted transition target.`);
    }
    const targetLoop = this.snapshots.loop(snapshot, target.loop);
    this.store.finishRun(run.runId, "completed");
    this.startInTransaction(targetLoop, snapshot, {
      source: "transition",
      input,
      rootRunId: run.rootRunId,
      parentRunId: run.runId,
      parentStepRunId: sourceStepRun.stepRunId
    });
  }

  private wouldExceedTransitionLimit(run: LoopRun): boolean {
    return this.store.rootTransitionCount(run.rootRunId) + 1 > MAX_ROOT_TRANSITIONS;
  }

  private blockForTransitionLimit(run: LoopRun, stepRun: StepRun): void {
    this.store.blockStepRunWithoutTransition(stepRun, run.runId,
      `Root transition limit of ${MAX_ROOT_TRANSITIONS} reached.`);
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

  private requireSnapshotStep(snapshot: RootExecutionSnapshot, run: LoopRun, stepId: string) {
    return this.snapshots.step(snapshot, run.loopId, stepId);
  }

  private requireDetails(runId: string): LoopRunDetails {
    const details = this.store.details(runId);
    if (!details) throw new LoopRunNotFoundError(`Loop run ${runId} was not found.`);
    return details;
  }
}
