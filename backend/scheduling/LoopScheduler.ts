import { Temporal } from "@js-temporal/polyfill";
import type { AppData } from "../../shared/api/workspace-contracts.js";
import type { ProjectScheduledStep } from "../../shared/domain/automation.js";
import type { DispatchLoopScheduleResult, RuntimeDatabase } from "../runtime-db.js";
import {
  latestScheduleOccurrenceBefore,
  nextScheduleOccurrence,
  scheduleDefinitionHash,
  scheduleOccurrenceAtOrAfter,
  systemScheduleClock,
  type ScheduleClock
} from "./index.js";

interface ScheduledDefinition {
  loopId: string;
  step: ProjectScheduledStep;
  definitionHash: string;
}

export interface LoopSchedulerOptions {
  readData: () => Promise<AppData>;
  database: () => RuntimeDatabase;
  dispatch: (input: {
    loopId: string;
    stepId: string;
    definitionHash: string;
    scheduledFor: string;
    nextRunAt?: string;
    updatedAt: string;
    canDispatch: () => boolean;
  }) => Promise<DispatchLoopScheduleResult>;
  clock?: ScheduleClock;
  intervalMs?: number;
  subscribeChanges?: (listener: (reason?: string) => void) => () => void;
  onChanged?: (reason: "schedules") => void;
}

export class LoopScheduler {
  private readonly clock: ScheduleClock;
  private readonly intervalMs: number;
  private timer?: ReturnType<typeof setInterval>;
  private unsubscribe?: () => void;
  private inFlight?: Promise<void>;
  private automationRefreshPending = false;
  private paused = true;
  private generation = 0;

  constructor(private readonly options: LoopSchedulerOptions) {
    this.clock = options.clock ?? systemScheduleClock;
    this.intervalMs = options.intervalMs ?? 15_000;
  }

  start(): void {
    if (this.timer) return;
    this.paused = false;
    this.generation += 1;
    this.unsubscribe = this.options.subscribeChanges?.((reason) => {
      if (reason !== "automation") return;
      if (this.inFlight) {
        this.automationRefreshPending = true;
        return;
      }
      void this.trigger();
    });
    this.timer = setInterval(() => { void this.trigger(); }, this.intervalMs);
    this.timer.unref();
    void this.trigger();
  }

  async pause(): Promise<void> {
    if (this.paused && !this.inFlight) return;
    this.paused = true;
    this.generation += 1;
    this.automationRefreshPending = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    await this.inFlight?.catch(() => undefined);
  }

  stop(): Promise<void> {
    return this.pause();
  }

  trigger(): Promise<void> {
    if (this.paused) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    const generation = this.generation;
    const running = this.tick(generation).catch((error) => {
      console.error("Loop scheduler tick failed.", error);
    }).finally(() => {
      if (this.inFlight !== running) return;
      this.inFlight = undefined;
      if (!this.paused && this.automationRefreshPending) {
        this.automationRefreshPending = false;
        void this.trigger();
      }
    });
    this.inFlight = running;
    return running;
  }

  private async tick(generation: number): Promise<void> {
    const data = await this.options.readData();
    if (this.isPaused(generation) || data.automationIssues.length > 0) return;
    const now = this.clock.now();
    const nowIso = iso(now);
    const minuteStart = Temporal.Instant.fromEpochMilliseconds(
      Math.floor(Number(now.epochMilliseconds) / 60_000) * 60_000
    );
    const definitions = scheduledDefinitions(data);
    const database = this.options.database();
    const definitionStates = definitions.map((definition) => {
      return {
        loopId: definition.loopId,
        stepId: definition.step.id,
        definitionHash: definition.definitionHash,
        nextRunAt: initialCursor(definition.step, minuteStart, now)
      };
    });
    const changed = database.syncLoopScheduleDefinitions(definitionStates, nowIso);
    if (changed) this.options.onChanged?.("schedules");

    const definitionsByKey = new Map(definitions.map((definition) => [
      `${definition.loopId}\0${definition.step.id}`,
      definition
    ]));
    for (const state of database.listLoopScheduleStates()) {
      if (this.isPaused(generation)) return;
      if (!state.nextRunAt) continue;
      const definition = definitionsByKey.get(`${state.loopId}\0${state.stepId}`);
      if (!definition) continue;
      let scheduledFor = state.nextRunAt;
      let due = Temporal.Instant.from(scheduledFor);
      if (Temporal.Instant.compare(due, minuteStart) < 0) {
        const nextRunAt = scheduleOccurrenceAtOrAfter(definition.step.schedule, minuteStart);
        const lastScheduledAt = latestScheduleOccurrenceBefore(definition.step.schedule, minuteStart)
          ?? scheduledFor;
        const completed = database.completeLoopScheduleOccurrence({
          loopId: state.loopId,
          stepId: state.stepId,
          definitionHash: definition.definitionHash,
          scheduledFor,
          lastScheduledAt,
          nextRunAt,
          status: "missed",
          error: "Scheduled occurrence was missed while Ballet was not dispatching runs.",
          updatedAt: nowIso
        });
        if (completed) this.options.onChanged?.("schedules");
        if (!completed || !nextRunAt) continue;
        scheduledFor = nextRunAt;
        due = Temporal.Instant.from(scheduledFor);
      }
      if (Temporal.Instant.compare(due, now) > 0) continue;
      const nextRunAt = nextScheduleOccurrence(definition.step.schedule, due);
      if (this.isPaused(generation)) return;
      await this.options.dispatch({
        loopId: state.loopId,
        stepId: state.stepId,
        definitionHash: definition.definitionHash,
        scheduledFor,
        nextRunAt,
        updatedAt: nowIso,
        canDispatch: () => !this.isPaused(generation)
      });
    }
  }

  private isPaused(generation: number): boolean {
    return this.paused || this.generation !== generation;
  }
}

const scheduledDefinitions = (data: AppData): ScheduledDefinition[] => data.automation.loops.flatMap((loop) => {
  const step = loop.nodes.find((candidate): candidate is ProjectScheduledStep =>
    candidate.id === loop.start && candidate.type === "scheduled");
  return step ? [{ loopId: loop.id, step, definitionHash: scheduleDefinitionHash(step.schedule, step.agentId) }] : [];
});

const initialCursor = (
  step: ProjectScheduledStep,
  minuteStart: Temporal.Instant,
  now: Temporal.Instant
): string | undefined => scheduleOccurrenceAtOrAfter(step.schedule, minuteStart)
  ?? (step.schedule.kind === "once" ? latestScheduleOccurrenceBefore(step.schedule, now.add({ nanoseconds: 1 })) : undefined);

const iso = (instant: Temporal.Instant): string => instant.toString({ smallestUnit: "millisecond" });
