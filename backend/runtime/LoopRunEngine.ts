// This transaction coordinator intentionally keeps all Loop state mutations in
// one module so a Step result, its persisted routing record, and the next Run
// state commit atomically. Outcome policy and evidence hashing live separately.
import type Database from "better-sqlite3";
import type {
  ProjectAutomationConfig,
  ProjectLoop,
  ProjectStep,
  StepTransitionTarget
} from "../../shared/domain/automation.js";
import { isProjectAgentBackedStep, isProjectTerminalNode, resolveEffectiveStartStep } from "../../shared/domain/automation.js";
import { LoopHandoffValidationError, validateLoopTransitionHandoff } from "../../shared/domain/loopHandoff.js";
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
import { MAX_REPAIR_ATTEMPTS, decideAgentTransition, fingerprintRepairEvidence } from "./LoopTransitionPolicy.js";
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
      if (step.type !== "human" || stepRun.type !== "human") throw new LoopRunStateError("Only a human step can receive a response.");
      if (run.status !== "waiting_for_human" || stepRun.status !== "waiting_for_human") {
        throw new LoopRunConflictError("The human step is no longer waiting for a response.");
      }
      const signal = { kind: "human", decision } as const satisfies StepRunResult;
      if (!Object.hasOwn(step.on, decision)) return this.finishMissingTransition(run, stepRun, signal, input);
      const target = step.on[decision];
      const forwardedInput = this.forwardedInput(run.input, input);
      this.validateHandoff(target, forwardedInput);
      if (isLoopTarget(target) && this.store.hasActiveLoop(target.loop)) {
        throw new LoopRunConflictError(`Loop ${target.loop} already has an active run.`);
      }

      const targetFailure = this.invalidTarget(config, run, stepRun, target, signal);
      const transition = targetFailure
        ? this.terminalTransition(signal, targetFailure)
        : this.humanTransition(run, stepRun, signal, target, input);
      const guarded = targetFailure ?? this.guardTransition(run, stepRun, signal, transition);
      this.store.completeStepRun(stepRun, signal, {
        responseInput: input,
        transition: guarded ? this.terminalTransition(signal, guarded) : transition
      });
      this.store.updateRunInput(run.runId, forwardedInput);
      if (guarded) this.store.finishRun(run.runId, guarded);
      else this.followTarget(config, theme, run, stepRun, signal, target, forwardedInput);
      return this.requireDetails(runId);
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
      const history = this.store.listByRoot(run.rootRunId).flatMap((candidate) => candidate.stepRuns);
      const missing = !Object.hasOwn(step.on, outcome.outcome)
        ? this.termination(run, stepRun, signal, "blocked", "missing_transition", `Step ${step.id} has no ${outcome.outcome} transition.`)
        : undefined;
      const decision = missing ? undefined : decideAgentTransition({ step, stepRun, outcome, history });
      const target = decision && "target" in decision ? decision.target : undefined;
      const targetFailure = target ? this.invalidTarget(config, run, stepRun, target, signal, decision!.transition) : undefined;
      const guarded = missing ?? targetFailure ?? (decision && "target" in decision
        ? this.guardTransition(run, stepRun, signal, decision.transition)
        : undefined);
      const transition = guarded ? this.terminalTransition(signal, guarded) : decision!.transition;
      const waitingForInput = !guarded && "wait" in decision!;
      this.store.completeStepRun(stepRun, signal, {
        outcome,
        error: input.error,
        transition,
        status: waitingForInput ? "waiting_for_human"
          : outcome.outcome === "blocked" ? "blocked"
            : outcome.outcome === "failed" ? "failed" : "completed"
      });

      if (guarded) this.store.finishRun(run.runId, guarded);
      else if ("termination" in decision!) this.store.finishRun(run.runId, decision.termination);
      else if ("wait" in decision!) this.store.waitForHuman(run.runId);
      else if ("retry" in decision!) this.store.createStepRun(run, step, stepRun.input ?? run.input, { retryOf: stepRun });
      else this.followTarget(
        config,
        theme,
        run,
        stepRun,
        signal,
        decision!.target,
        decision!.transition.action === "human" ? outcome.summary : run.input
      );
      return this.requireDetails(run.runId);
    });
    return transaction() as LoopRunDetails;
  }

  resumeAgentInput(
    runId: string,
    stepRunId: string,
    input: string
  ): LoopRunDetails {
    if (!input.trim()) throw new LoopRunStateError("Agent response input is required.");
    const transaction = this.connection().transaction(() => {
      const run = this.requireRun(runId);
      const stepRun = this.requireStepRun(runId, stepRunId);
      const step = this.requireSnapshotStep(run, stepRun.stepId);
      if (!isProjectAgentBackedStep(step) || stepRun.type !== "agent") {
        throw new LoopRunStateError("Only an agent step waiting for input can be resumed with agent input.");
      }
      if (run.status !== "waiting_for_human" || stepRun.status !== "waiting_for_human") {
        throw new LoopRunConflictError("The agent step is no longer waiting for input.");
      }
      if (stepRun.outcome?.outcome !== "needs_input" || stepRun.transition?.action !== "wait") {
        throw new LoopRunStateError("The agent step does not have a resumable needs_input outcome.");
      }
      const signal = { kind: "agent", outcome: "needs_input" } as const satisfies StepRunResult;
      const transition = { signal, action: "resume", target: step.id } as const satisfies StepRunTransition;
      const guarded = this.guardTransition(run, stepRun, signal, transition);
      const forwardedInput = this.forwardedInput(run.input, input);
      this.store.completeStepRun(stepRun, signal, {
        responseInput: input,
        outcome: stepRun.outcome,
        transition: guarded ? this.terminalTransition(signal, guarded) : transition
      });
      this.store.updateRunInput(run.runId, forwardedInput);
      if (guarded) this.store.finishRun(run.runId, guarded);
      else {
        this.store.incrementTransitionCount(run.runId);
        this.store.createStepRun(this.requireRun(run.runId), step, forwardedInput);
      }
      return this.requireDetails(runId);
    });
    return transaction() as LoopRunDetails;
  }

  cancel(runId: string): LoopRunDetails {
    const transaction = this.connection().transaction(() => {
      const run = this.requireRun(runId);
      if (!["running", "waiting_for_human"].includes(run.status)) throw new LoopRunConflictError(`Loop run ${runId} is already ${run.status}.`);
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
    config: ProjectAutomationConfig, theme: LoopTheme, run: LoopRun, source: StepRun, signal: StepRunResult,
    target: StepTransitionTarget, input?: string
  ): void {
    this.store.incrementTransitionCount(run.runId);
    if (typeof target === "string") {
      const next = run.snapshot.nodes.find((node) => node.id === target)!;
      if (isProjectTerminalNode(next)) {
        this.store.finishRun(run.runId, {
          status: next.type,
          code: terminalCode(next.type, signal),
          message: `Transition reached the ${next.type} terminal.`,
          stepRunId: source.stepRunId,
          stepId: source.stepId,
          signal,
          target
        });
      } else this.store.createStepRun(this.requireRun(run.runId), next, input);
      return;
    }
    const targetLoop = this.requireLoop(config, target.loop);
    this.store.finishRun(run.runId, {
      status: "completed", code: "completed", message: `Transition continued in Loop ${target.loop}.`,
      stepRunId: source.stepRunId, stepId: source.stepId, signal, target
    });
    this.startInTransaction(targetLoop, theme, {
      source: "human", input, rootRunId: run.rootRunId, parentRunId: run.runId,
      parentStepRunId: source.stepRunId, executionPlan: run.executionPlan
    });
  }

  private invalidTarget(
    config: ProjectAutomationConfig, run: LoopRun, stepRun: StepRun, target: StepTransitionTarget,
    signal: StepRunResult, transition?: StepRunTransition
  ): LoopRunTermination | undefined {
    if (typeof target === "string") {
      const node = run.snapshot.nodes.find((candidate) => candidate.id === target);
      if (!node) return this.termination(run, stepRun, signal, "blocked", "stale_transition", `Transition target ${target} is missing.`, target);
      if (!isProjectTerminalNode(node) && node.type === "scheduled") {
        return this.termination(run, stepRun, signal, "blocked", "invalid_transition", `Transition target ${target} is a scheduled start step.`, target);
      }
      if (transition?.action === "human" && (isProjectTerminalNode(node) || node.type !== "human")) {
        return this.termination(run, stepRun, signal, "blocked", "invalid_transition", `needs_input target ${target} is not a human step.`, target);
      }
      if (transition?.action === "repair" && (isProjectTerminalNode(node) || node.type !== "agent")) {
        return this.termination(run, stepRun, signal, "blocked", "invalid_transition", `Repair target ${target} is not an agent step.`, target);
      }
      return undefined;
    }
    if (stepRun.type !== "human") return this.termination(run, stepRun, signal, "blocked", "invalid_transition", "Only a human decision may transition to another Loop.", target);
    if (!config.loops.some((candidate) => candidate.id === target.loop)) {
      return this.termination(run, stepRun, signal, "blocked", "stale_transition", `Transition Loop ${target.loop} is missing.`, target);
    }
    return undefined;
  }

  private humanTransition(run: LoopRun, stepRun: StepRun, signal: StepRunResult, target: StepTransitionTarget, input: string): StepRunTransition {
    if (typeof target !== "string") return { signal, action: "transition", target };
    const node = run.snapshot.nodes.find((candidate) => candidate.id === target);
    if (signal.kind !== "human" || signal.decision !== "rejected" || !node || isProjectTerminalNode(node) || node.type !== "agent") {
      return { signal, action: "transition", target };
    }
    const repairs = this.store.listByRoot(run.rootRunId).flatMap((candidate) => candidate.stepRuns)
      .filter((candidate) => candidate.loopId === stepRun.loopId && candidate.stepId === stepRun.stepId
        && candidate.transition?.action === "repair" && candidate.transition.target === target);
    return {
      signal, action: "repair", target, repairAttempt: repairs.length + 1,
      evidenceFingerprint: fingerprintRepairEvidence({ outcome: "changes-requested", summary: input, artifacts: {}, checks: [] })
    };
  }

  private guardTransition(run: LoopRun, stepRun: StepRun, signal: StepRunResult, transition: StepRunTransition): LoopRunTermination | undefined {
    if (transition.action === "repair" && transition.repairAttempt > MAX_REPAIR_ATTEMPTS) {
      return this.termination(run, stepRun, signal, "blocked", "repair_limit_exceeded",
        `The repair loop reached its limit of ${MAX_REPAIR_ATTEMPTS}.`, transition.target, MAX_REPAIR_ATTEMPTS, transition.repairAttempt);
    }
    if (this.store.rootTransitionCount(run.rootRunId) + 1 > MAX_ROOT_TRANSITIONS) {
      return this.termination(run, stepRun, signal, "blocked", "transition_limit_exceeded",
        `The root transition limit of ${MAX_ROOT_TRANSITIONS} was reached.`, "target" in transition ? transition.target : undefined,
        MAX_ROOT_TRANSITIONS, this.store.rootTransitionCount(run.rootRunId) + 1);
    }
    return undefined;
  }

  private finishMissingTransition(run: LoopRun, stepRun: StepRun, signal: StepRunResult, input: string): LoopRunDetails {
    const termination = this.termination(run, stepRun, signal, "blocked", "missing_transition", `Step ${stepRun.stepId} has no transition for this decision.`);
    this.store.completeStepRun(stepRun, signal, { responseInput: input, transition: this.terminalTransition(signal, termination) });
    this.store.finishRun(run.runId, termination);
    return this.requireDetails(run.runId);
  }

  private terminalTransition(signal: StepRunResult, termination: LoopRunTermination): StepRunTransition {
    return { signal, action: "terminate", status: termination.status, code: termination.code };
  }

  private termination(
    _run: LoopRun, stepRun: StepRun, signal: StepRunResult,
    status: "blocked" | "failed", code: LoopRunTermination["code"], message: string,
    target?: StepTransitionTarget, limit?: number, count?: number
  ): LoopRunTermination {
    return { status, code, message, stepRunId: stepRun.stepRunId, stepId: stepRun.stepId, signal, target, limit, count };
  }

  private validateHandoff(target: StepTransitionTarget, input: string): void {
    if (!isLoopTarget(target)) return;
    try { validateLoopTransitionHandoff(target.loop, input); }
    catch (error) {
      if (error instanceof LoopHandoffValidationError) throw new LoopRunStateError(error.message);
      throw error;
    }
  }

  private forwardedInput(runInput: string | undefined, responseInput: string): string {
    return runInput ? `${runInput}\n\n${responseInput}` : responseInput;
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
    if (!stepRun || stepRun.runId !== runId) throw new LoopRunNotFoundError(`Step run ${stepRunId} was not found in loop run ${runId}.`);
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

const terminalCode = (
  status: "completed" | "blocked" | "failed",
  signal: StepRunResult
): LoopRunTermination["code"] => {
  if (status === "completed") return "completed";
  if (signal.kind === "human") return signal.decision === "approved" ? "human_approved" : "human_rejected";
  return status === "blocked" ? "agent_blocked" : "agent_failed";
};
