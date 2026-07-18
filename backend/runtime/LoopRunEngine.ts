// All Loop mutations remain in this transaction coordinator so a signal, its
// interpreted action, and the resulting Run state commit atomically.
import type Database from "better-sqlite3";
import type {
  ProjectAutomationConfig,
  ProjectLoop,
  ProjectStep,
  StepTransitionTarget,
  TransitionAction,
  TransitionInputMode
} from "../../shared/domain/automation.js";
import { isProjectAgentBackedStep, isProjectTerminalNode, resolveEffectiveStartStep } from "../../shared/domain/automation.js";
import type { LoopTheme } from "../../shared/domain/loopThemes.js";
import type { HumanDecision } from "../../shared/domain/outcomes.js";
import type {
  AgentOutcome,
  LoopExecutionPlan,
  LoopRun,
  LoopRunDetails,
  LoopRunSource,
  LoopRunTermination,
  StepRun,
  StepRunResult,
  StepRunTransition
} from "../../shared/domain/runtime.js";
import { LoopRunConflictError, LoopRunNotFoundError, LoopRunStateError } from "./LoopRunErrors.js";
import { LoopRunStore } from "./LoopRunStore.js";
import { interpretTransitionAction, type TransitionDecision } from "./LoopTransitionPolicy.js";
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

const isLoopTarget = (target: StepTransitionTarget): target is { loop: string } =>
  typeof target === "object" && target !== null && "loop" in target;

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

  start(config: ProjectAutomationConfig, loopId: string, theme: LoopTheme, options: StartOptions = {}): LoopRunDetails {
    const transaction = this.connection().transaction(() =>
      this.startInTransaction(this.requireLoop(config, loopId), theme, options));
    try { return transaction() as LoopRunDetails; }
    catch (error) {
      if (isActiveLoopConstraint(error)) throw new LoopRunConflictError(`Loop ${loopId} already has an active run.`);
      throw error;
    }
  }

  respond(
    config: ProjectAutomationConfig,
    theme: LoopTheme,
    runId: string,
    stepRunId: string,
    decision: HumanDecision,
    input: string
  ): LoopRunDetails {
    if (!input.trim()) throw new LoopRunStateError("Human response input is required.");
    const transaction = this.connection().transaction(() => {
      const run = this.requireRun(runId);
      const stepRun = this.requireStepRun(runId, stepRunId);
      const step = this.requireSnapshotStep(run, stepRun.stepId);
      if (step.type !== "human" || stepRun.type !== "human") {
        throw new LoopRunStateError("Only a human step can receive a human decision.");
      }
      if (run.status !== "waiting_for_human" || stepRun.status !== "waiting_for_human") {
        throw new LoopRunConflictError("The human step is no longer waiting for a response.");
      }
      const signal = { kind: "human", decision } as const satisfies StepRunResult;
      const action = step.on[decision];
      return this.applySignal(config, theme, run, stepRun, signal, action, { responseInput: input });
    });
    try { return transaction() as LoopRunDetails; }
    catch (error) {
      if (isActiveLoopConstraint(error)) throw new LoopRunConflictError("The target loop already has an active run.");
      throw error;
    }
  }

  completeAgentStep(config: ProjectAutomationConfig, theme: LoopTheme, input: CompleteStepRunInput): LoopRunDetails {
    const transaction = this.connection().transaction(() => {
      const stepRun = this.store.getStepRun(input.stepRunId);
      if (!stepRun) throw new LoopRunNotFoundError(`Step run ${input.stepRunId} was not found.`);
      const run = this.requireRun(stepRun.runId);
      if (run.status === "cancelled" || stepRun.status === "cancelled") return this.requireDetails(run.runId);
      if (stepRun.type !== "agent") throw new LoopRunStateError("A human step cannot be completed by the local runtime.");
      if (stepRun.status !== "running" && stepRun.status !== "queued") return this.requireDetails(run.runId);
      const step = this.requireSnapshotStep(run, stepRun.stepId);
      if (!isProjectAgentBackedStep(step)) throw new LoopRunStateError("An agent StepRun must reference an agent-backed step.");

      const outcome = input.outcome ?? executionFailure(input.error ?? "The execution returned no structured outcome.");
      const signal = { kind: "agent", outcome: outcome.outcome } as const satisfies StepRunResult;
      const action = step.on[outcome.outcome];
      return this.applySignal(config, theme, run, stepRun, signal, action, { outcome, error: input.error });
    });
    return transaction() as LoopRunDetails;
  }

  resumeWait(
    config: ProjectAutomationConfig,
    theme: LoopTheme,
    runId: string,
    stepRunId: string,
    input: string
  ): LoopRunDetails {
    if (!input.trim()) throw new LoopRunStateError("Resume input is required.");
    const transaction = this.connection().transaction(() => {
      const run = this.requireRun(runId);
      const stepRun = this.requireStepRun(runId, stepRunId);
      const step = this.requireSnapshotStep(run, stepRun.stepId);
      if (run.status !== "waiting_for_human" || stepRun.status !== "waiting_for_human") {
        throw new LoopRunConflictError("The step is no longer waiting for resume input.");
      }
      if (!stepRun.result || stepRun.transition?.action !== "wait" || stepRun.transition.resumed) {
        throw new LoopRunStateError("The step does not have a resumable wait action.");
      }

      const target = stepRun.transition.resume === "same-step"
        ? step.id
        : stepRun.transition.resume.target;
      const failure = this.invalidTarget(config, run, stepRun, target, stepRun.result, {
        allowScheduledSource: stepRun.transition.resume === "same-step"
      });
      if (!failure) this.ensureTargetAvailable(target);
      const guarded = failure ?? this.guardTransition(run, stepRun, stepRun.result, target);
      const transition: StepRunTransition = guarded
        ? this.terminalTransition(stepRun.result, guarded)
        : { ...stepRun.transition, resumed: { target, at: now() } };
      const nextInput = this.transitionInput(run.input, input, stepRun.transition.input ?? "current");
      this.store.completeStepRun(stepRun, stepRun.result, {
        responseInput: stepRun.responseInput ? this.forwardedInput(stepRun.responseInput, input) : input,
        outcome: stepRun.outcome,
        transition,
        status: guarded ? guarded.status : "completed"
      });
      this.store.updateRunInput(run.runId, this.forwardedInput(run.input, input));
      if (guarded) this.store.finishRun(run.runId, guarded);
      else this.followTarget(config, theme, run, stepRun, stepRun.result, target, nextInput);
      return this.requireDetails(runId);
    });
    try { return transaction() as LoopRunDetails; }
    catch (error) {
      if (isActiveLoopConstraint(error)) throw new LoopRunConflictError("The target loop already has an active run.");
      throw error;
    }
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
        WHERE run_id = @runId AND status IN ('queued', 'running', 'waiting_for_human')
      `).run({ runId, completedAt: timestamp, updatedAt: timestamp });
      this.store.finishRun(runId, { status: "cancelled", code: "cancelled", message: "The run was cancelled." });
      return this.requireDetails(runId);
    });
    return transaction() as LoopRunDetails;
  }

  private applySignal(
    config: ProjectAutomationConfig,
    theme: LoopTheme,
    run: LoopRun,
    stepRun: StepRun,
    signal: StepRunResult,
    action: TransitionAction | undefined,
    detail: { outcome?: AgentOutcome; responseInput?: string; error?: string }
  ): LoopRunDetails {
    if (!action) return this.finishMissingTransition(run, stepRun, signal, detail);
    const history = this.store.listByRoot(run.rootRunId).flatMap((candidate) => candidate.stepRuns);
    const interpreted = interpretTransitionAction({
      action,
      signal,
      stepRun,
      history,
      outcome: detail.outcome,
      responseInput: detail.responseInput
    });
    const target = interpreted.kind === "goto" || interpreted.kind === "retry"
      ? interpreted.target
      : undefined;
    const implicitRetry = interpreted.kind === "retry" && action.action === "retry" && action.target === undefined;
    const failure = target
      ? this.invalidTarget(config, run, stepRun, target, signal, {
          allowScheduledSource: implicitRetry,
          requireExecutable: interpreted.kind === "retry"
        })
      : undefined;
    if (target && !failure) this.ensureTargetAvailable(target);
    const guarded = failure ?? (target && !implicitRetry
      ? this.guardTransition(run, stepRun, signal, target)
      : undefined);
    const transition = guarded ? this.terminalTransition(signal, guarded) : interpreted.transition;
    const status = guarded ? guarded.status
      : interpreted.kind === "wait" ? "waiting_for_human"
        : interpreted.kind === "terminate" ? interpreted.termination.status
          : "completed";

    this.store.completeStepRun(stepRun, signal, {
      outcome: detail.outcome,
      responseInput: detail.responseInput,
      error: detail.error,
      transition,
      status
    });
    if (detail.responseInput) {
      this.store.updateRunInput(run.runId, this.forwardedInput(run.input, detail.responseInput));
    }

    if (guarded) this.store.finishRun(run.runId, guarded);
    else this.applyDecision(config, theme, run, stepRun, signal, action, interpreted, detail);
    return this.requireDetails(run.runId);
  }

  private applyDecision(
    config: ProjectAutomationConfig,
    theme: LoopTheme,
    run: LoopRun,
    stepRun: StepRun,
    signal: StepRunResult,
    configuredAction: TransitionAction,
    decision: TransitionDecision,
    detail: { outcome?: AgentOutcome; responseInput?: string }
  ): void {
    if (decision.kind === "terminate") {
      this.store.finishRun(run.runId, decision.termination);
      return;
    }
    if (decision.kind === "wait") {
      this.store.waitForHuman(run.runId);
      return;
    }
    const payload = detail.responseInput ?? detail.outcome?.summary;
    const nextInput = this.transitionInput(run.input, payload, decision.inputMode);
    if (decision.kind === "retry" && configuredAction.action === "retry" && configuredAction.target === undefined) {
      const target = this.requireLocalExecutable(run, decision.target);
      this.store.createStepRun(run, target, nextInput, { retryOf: stepRun });
      return;
    }
    this.followTarget(config, theme, run, stepRun, signal, decision.target, nextInput);
  }

  private startInTransaction(loop: ProjectLoop, themeSnapshot: LoopTheme, options: StartOptions): LoopRunDetails {
    if (this.store.hasActiveLoop(loop.id)) throw new LoopRunConflictError(`Loop ${loop.id} already has an active run.`);
    const run = this.store.createLoopRun({
      loop, themeSnapshot, rootRunId: options.rootRunId, parentRunId: options.parentRunId,
      parentStepRunId: options.parentStepRunId, executionPlan: options.executionPlan,
      schedule: options.schedule, source: options.source ?? "manual", input: options.input
    });
    const firstStep = resolveEffectiveStartStep(loop);
    if (!firstStep) throw new LoopRunStateError(`Loop ${loop.id} does not have an executable start step.`);
    this.store.createStepRun(run, firstStep, options.input);
    return this.requireDetails(run.runId);
  }

  private followTarget(
    config: ProjectAutomationConfig,
    theme: LoopTheme,
    run: LoopRun,
    source: StepRun,
    signal: StepRunResult,
    target: StepTransitionTarget,
    input?: string
  ): void {
    this.store.incrementTransitionCount(run.runId);
    if (typeof target === "string") {
      const next = run.snapshot.nodes.find((node) => node.id === target)!;
      if (isProjectTerminalNode(next)) {
        this.store.finishRun(run.runId, {
          status: next.type,
          code: "terminal_reached",
          message: `Transition reached the ${next.type} terminal.`,
          stepRunId: source.stepRunId,
          stepId: source.stepId,
          signal,
          target
        });
      } else {
        this.store.createStepRun(this.requireRun(run.runId), next, input);
      }
      return;
    }

    const targetLoop = this.requireLoop(config, target.loop);
    this.store.finishRun(run.runId, {
      status: "completed",
      code: "completed",
      message: `Transition continued in Loop ${target.loop}.`,
      stepRunId: source.stepRunId,
      stepId: source.stepId,
      signal,
      target
    });
    this.startInTransaction(targetLoop, theme, {
      source: "transition",
      input,
      rootRunId: run.rootRunId,
      parentRunId: run.runId,
      parentStepRunId: source.stepRunId,
      executionPlan: run.executionPlan
    });
  }

  private invalidTarget(
    config: ProjectAutomationConfig,
    run: LoopRun,
    stepRun: StepRun,
    target: StepTransitionTarget,
    signal: StepRunResult,
    options: { allowScheduledSource?: boolean; requireExecutable?: boolean } = {}
  ): LoopRunTermination | undefined {
    if (typeof target === "string") {
      const node = run.snapshot.nodes.find((candidate) => candidate.id === target);
      if (!node) {
        return this.termination(stepRun, signal, "blocked", "stale_transition", `Transition target ${target} is missing.`, target);
      }
      if (!isProjectTerminalNode(node) && node.type === "scheduled"
        && !(options.allowScheduledSource && node.id === stepRun.stepId)) {
        return this.termination(stepRun, signal, "blocked", "invalid_transition", `Transition target ${target} is a scheduled start step.`, target);
      }
      if (options.requireExecutable && isProjectTerminalNode(node)) {
        return this.termination(stepRun, signal, "blocked", "invalid_transition", `Retry target ${target} is not executable.`, target);
      }
      return undefined;
    }
    if (!config.loops.some((candidate) => candidate.id === target.loop)) {
      return this.termination(stepRun, signal, "blocked", "stale_transition", `Transition Loop ${target.loop} is missing.`, target);
    }
    if (target.loop === run.loopId) {
      return this.termination(stepRun, signal, "blocked", "invalid_transition", "A Loop target must name a different Loop.", target);
    }
    return undefined;
  }

  private ensureTargetAvailable(target: StepTransitionTarget): void {
    if (isLoopTarget(target) && this.store.hasActiveLoop(target.loop)) {
      throw new LoopRunConflictError(`Loop ${target.loop} already has an active run.`);
    }
  }

  private guardTransition(
    run: LoopRun,
    stepRun: StepRun,
    signal: StepRunResult,
    target: StepTransitionTarget
  ): LoopRunTermination | undefined {
    const count = this.store.rootTransitionCount(run.rootRunId) + 1;
    if (count <= MAX_ROOT_TRANSITIONS) return undefined;
    return this.termination(
      stepRun,
      signal,
      "blocked",
      "transition_limit_exceeded",
      `The root transition limit of ${MAX_ROOT_TRANSITIONS} was reached.`,
      target,
      MAX_ROOT_TRANSITIONS,
      count
    );
  }

  private finishMissingTransition(
    run: LoopRun,
    stepRun: StepRun,
    signal: StepRunResult,
    detail: { outcome?: AgentOutcome; responseInput?: string; error?: string }
  ): LoopRunDetails {
    const termination = this.termination(
      stepRun,
      signal,
      "blocked",
      "missing_transition",
      `Step ${stepRun.stepId} has no transition for signal ${signalLabel(signal)}.`
    );
    this.store.completeStepRun(stepRun, signal, {
      outcome: detail.outcome,
      responseInput: detail.responseInput,
      error: detail.error,
      transition: this.terminalTransition(signal, termination),
      status: "blocked"
    });
    this.store.finishRun(run.runId, termination);
    return this.requireDetails(run.runId);
  }

  private terminalTransition(signal: StepRunResult, termination: LoopRunTermination): StepRunTransition {
    return {
      version: 1,
      signal,
      action: "terminate",
      status: termination.status,
      code: termination.code
    };
  }

  private termination(
    stepRun: StepRun,
    signal: StepRunResult,
    status: "blocked" | "failed",
    code: LoopRunTermination["code"],
    message: string,
    target?: StepTransitionTarget,
    limit?: number,
    count?: number
  ): LoopRunTermination {
    return {
      status,
      code,
      message,
      stepRunId: stepRun.stepRunId,
      stepId: stepRun.stepId,
      signal,
      target,
      limit,
      count
    };
  }

  private transitionInput(
    current: string | undefined,
    signalPayload: string | undefined,
    mode: TransitionInputMode
  ): string | undefined {
    if (mode === "current") return current;
    if (mode === "signal") return signalPayload;
    return signalPayload ? this.forwardedInput(current, signalPayload) : current;
  }

  private forwardedInput(runInput: string | undefined, responseInput: string): string {
    return runInput ? `${runInput}\n\n${responseInput}` : responseInput;
  }

  private requireLocalExecutable(run: LoopRun, stepId: string) {
    const node = run.snapshot.nodes.find((candidate) => candidate.id === stepId);
    if (!node || isProjectTerminalNode(node)) throw new LoopRunStateError(`Executable transition target ${stepId} is missing.`);
    return node;
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

const executionFailure = (message: string): AgentOutcome => ({
  outcome: "failed",
  summary: message,
  failure: { classification: "permanent", code: "execution_failed" },
  checks: []
});

const signalLabel = (signal: StepRunResult): string =>
  signal.kind === "agent" ? signal.outcome : signal.decision;
