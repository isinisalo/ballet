import { mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { Temporal } from "@js-temporal/polyfill";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppData } from "../../../shared/api/workspace-contracts.js";
import type { ProjectAutomationConfig, ProjectStepSchedule } from "../../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../../shared/domain/loopThemes.js";
import { RuntimeDatabase, type DispatchLoopScheduleResult } from "../../runtime-db.js";
import { LoopScheduler, type LoopSchedulerOptions } from "../LoopScheduler.js";
import type { ScheduleClock } from "../ScheduleClock.js";

const roots: string[] = [];
const schedulers: LoopScheduler[] = [];
const databases: RuntimeDatabase[] = [];
const openAiTheme = defaultLoopTheme;

class FakeScheduleClock implements ScheduleClock {
  private instant: Temporal.Instant;
  constructor(value: string) { this.instant = Temporal.Instant.from(value); }
  now(): Temporal.Instant { return this.instant; }
  set(value: string): void { this.instant = Temporal.Instant.from(value); }
}

afterEach(async () => {
  await Promise.all(schedulers.splice(0).map((scheduler) => scheduler.stop()));
  databases.splice(0).forEach((database) => database.close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const automation = (schedule: ProjectStepSchedule): ProjectAutomationConfig => ({
  version: 7,
  loops: [{ id: "scheduled-delivery", start: "timer", steps: [
    { id: "timer", type: "scheduled", agentId: "delivery-agent", description: "Start on schedule.", nodeStyle: "luna", schedule,
      on: { approved: "work", rejected: { end: "failed" } } },
    { id: "work", type: "agent", agentId: "delivery-agent", description: "Deliver.", nodeStyle: "terra",
      on: { approved: { end: "completed" }, rejected: { end: "failed" } } }
  ] }]
});

const workspace = (config: ProjectAutomationConfig): AppData => ({
  project: {
    id: "fixture", name: "Fixture", description: "Fixture checkout", status: "active",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
  },
  agents: [], skills: [], loopRuns: [], scheduleStates: [], automation: config, automationIssues: [],
  loopTheme: structuredClone(defaultLoopTheme), loopThemeIssues: [],
  runtime: {
    instanceId: "fixture", hostname: "localhost", platform: "darwin", architecture: "arm64",
    checkout: { path: "/fixture", headSha: "a".repeat(40), configHash: "config", dirty: false },
    uptimeSeconds: 0, startedAt: "2026-01-01T00:00:00.000Z", providers: [], activeRunCount: 0,
    logsPath: "/fixture/.git/ballet/logs/ballet.log"
  },
  agentRuntimeConfigurations: {}, executionStates: [], runTargets: { loops: [], agents: [] }, projectDocumentTree: []
});

const once = (time = "09:00"): ProjectStepSchedule => ({ kind: "once", date: "2026-07-12", time, timeZone: "UTC" });

const daily = (time = "09:00"): ProjectStepSchedule => ({
  kind: "recurring", startsOn: "2026-07-12", time, timeZone: "UTC", cadence: "daily"
});

const runtimeDatabase = async (): Promise<RuntimeDatabase> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-loop-scheduler-"));
  roots.push(root);
  const database = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
  databases.push(database);
  return database;
};

const dispatchOccurrence = (
  database: RuntimeDatabase,
  config: ProjectAutomationConfig,
  input: Parameters<LoopSchedulerOptions["dispatch"]>[0]
): DispatchLoopScheduleResult => {
  if (!input.canDispatch()) return { status: "stale" };
  if (database.activeLoopIds().includes(input.loopId)) {
    const error = `Loop ${input.loopId} already has an active run.`;
    database.completeLoopScheduleOccurrence({ ...input, status: "skipped", error });
    return { status: "skipped", error };
  }
  const rootRunId = `schedule-${createHash("sha256").update(input.scheduledFor).digest("hex").slice(0, 16)}`;
  insertRoot(database, rootRunId, input.loopId);
  const run = database.startLoopRun(
    config,
    input.loopId,
    openAiTheme,
    rootRunId,
    undefined,
    "schedule",
    undefined,
    { stepId: input.stepId, scheduledFor: input.scheduledFor }
  );
  database.completeLoopScheduleOccurrence({ ...input, status: "started", runId: run.runId });
  return { status: "started", run };
};

const insertRoot = (database: RuntimeDatabase, rootRunId: string, targetId: string): void => {
  const timestamp = "2026-07-12T00:00:00.000Z";
  database.connection().prepare(`
    INSERT INTO root_runs (
      root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
      config_hash, snapshot_hash, created_at, updated_at
    ) VALUES (?, 'loop', ?, 'schedule', 'queued', ?, ?, ?, 'config', 'snapshot', ?, ?)
  `).run(rootRunId, targetId, `/tmp/${rootRunId}`, `ballet/run/${rootRunId}`, "a".repeat(40), timestamp, timestamp);
};

const startScheduler = async (input: {
  data: () => AppData;
  database: RuntimeDatabase;
  clock: FakeScheduleClock;
  dispatch?: LoopSchedulerOptions["dispatch"];
}) => {
  const dispatch = input.dispatch ?? vi.fn<LoopSchedulerOptions["dispatch"]>(async ({ canDispatch, ...occurrence }) => {
    return dispatchOccurrence(input.database, input.data().automation, { ...occurrence, canDispatch });
  });
  const scheduler = new LoopScheduler({
    readData: async () => input.data(),
    database: () => input.database,
    dispatch,
    clock: input.clock,
    intervalMs: 3_600_000
  });
  schedulers.push(scheduler);
  scheduler.start();
  await scheduler.trigger();
  return { scheduler, dispatch };
};

describe("Loop scheduler", () => {
  it("dispatches a due one-time occurrence exactly once", async () => {
    const data = workspace(automation(once()));
    const database = await runtimeDatabase();
    const clock = new FakeScheduleClock("2026-07-12T09:00:30.000Z");
    const dispatch = vi.fn<LoopSchedulerOptions["dispatch"]>(async ({ canDispatch, ...occurrence }) => {
      return dispatchOccurrence(database, data.automation, { ...occurrence, canDispatch });
    });
    const { scheduler } = await startScheduler({ data: () => data, database, clock, dispatch });

    await Promise.all([scheduler.trigger(), scheduler.trigger()]);

    expect(dispatch).toHaveBeenCalledOnce();
    expect(database.listLoopRuns()).toHaveLength(1);
    expect(database.listLoopScheduleStates()).toEqual([expect.objectContaining({
      loopId: "scheduled-delivery",
      stepId: "timer",
      nextRunAt: undefined,
      lastScheduledAt: "2026-07-12T09:00:00.000Z",
      lastStatus: "started",
      lastRunId: database.listLoopRuns()[0]!.runId
    })]);
  });

  it("marks a persisted past-due occurrence missed after restart", async () => {
    const data = workspace(automation(daily()));
    const database = await runtimeDatabase();
    const clock = new FakeScheduleClock("2026-07-12T08:00:00.000Z");
    const { scheduler, dispatch } = await startScheduler({ data: () => data, database, clock });
    expect(database.listLoopScheduleStates()[0]!.nextRunAt).toBe("2026-07-12T09:00:00.000Z");
    await scheduler.pause();
    clock.set("2026-07-12T09:01:00.000Z");
    scheduler.start();
    await scheduler.trigger();

    expect(dispatch).not.toHaveBeenCalled();
    expect(database.listLoopRuns()).toEqual([]);
    expect(database.listLoopScheduleStates()).toEqual([expect.objectContaining({
      nextRunAt: "2026-07-13T09:00:00.000Z",
      lastScheduledAt: "2026-07-12T09:00:00.000Z",
      lastStatus: "missed",
      lastError: expect.stringContaining("missed")
    })]);
  });

  it("records only the latest missed recurring occurrence after a long downtime", async () => {
    const data = workspace(automation(daily()));
    const database = await runtimeDatabase();
    const clock = new FakeScheduleClock("2026-07-12T08:00:00.000Z");
    const { scheduler } = await startScheduler({ data: () => data, database, clock });
    await scheduler.pause();
    clock.set("2026-07-15T10:00:00.000Z");
    scheduler.start();
    await scheduler.trigger();

    expect(database.listLoopScheduleStates()).toEqual([expect.objectContaining({
      nextRunAt: "2026-07-16T09:00:00.000Z",
      lastScheduledAt: "2026-07-15T09:00:00.000Z",
      lastStatus: "missed"
    })]);
  });
});

describe("Loop scheduler dispatch outcomes", () => {
  it("dispatches the current occurrence after recording older missed occurrences", async () => {
    const data = workspace(automation(daily()));
    const database = await runtimeDatabase();
    const clock = new FakeScheduleClock("2026-07-12T08:00:00.000Z");
    const { scheduler, dispatch } = await startScheduler({ data: () => data, database, clock });
    await scheduler.pause();
    clock.set("2026-07-15T09:00:30.000Z");
    scheduler.start();
    await scheduler.trigger();

    expect(dispatch).toHaveBeenCalledOnce();
    expect(database.listLoopRuns()).toHaveLength(1);
    expect(database.listLoopScheduleStates()).toEqual([expect.objectContaining({
      nextRunAt: "2026-07-16T09:00:00.000Z",
      lastScheduledAt: "2026-07-15T09:00:00.000Z",
      lastStatus: "started"
    })]);
  });

  it("advances a recurring cursor after every started occurrence", async () => {
    const data = workspace(automation(daily()));
    const database = await runtimeDatabase();
    const clock = new FakeScheduleClock("2026-07-12T09:00:05.000Z");
    const { scheduler } = await startScheduler({ data: () => data, database, clock });
    const first = database.listLoopRuns()[0]!;
    expect(database.listLoopScheduleStates()[0]!.nextRunAt).toBe("2026-07-13T09:00:00.000Z");

    database.cancelLoopRun(first.runId);
    clock.set("2026-07-13T09:00:05.000Z");
    await scheduler.trigger();

    expect(database.listLoopRuns()).toHaveLength(2);
    expect(database.listLoopScheduleStates()).toEqual([expect.objectContaining({
      nextRunAt: "2026-07-14T09:00:00.000Z",
      lastScheduledAt: "2026-07-13T09:00:00.000Z",
      lastStatus: "started"
    })]);
  });

  it("skips a due occurrence while the loop already has an active run", async () => {
    const config = automation(once());
    const data = workspace(config);
    const database = await runtimeDatabase();
    insertRoot(database, "manual-active", "scheduled-delivery");
    const active = database.startLoopRun(
      config, "scheduled-delivery", openAiTheme, "manual-active"
    );
    const clock = new FakeScheduleClock("2026-07-12T09:00:10.000Z");
    await startScheduler({ data: () => data, database, clock });

    expect(database.listLoopRuns()).toHaveLength(1);
    expect(database.listLoopRuns()[0]!.runId).toBe(active.runId);
    expect(database.listLoopScheduleStates()).toEqual([expect.objectContaining({
      nextRunAt: undefined,
      lastStatus: "skipped",
      lastError: "Loop scheduled-delivery already has an active run."
    })]);
  });

  it("resets edited definitions and removes deleted schedule state", async () => {
    let data = workspace(automation(daily("09:00")));
    const database = await runtimeDatabase();
    const clock = new FakeScheduleClock("2026-07-12T08:00:00.000Z");
    const { scheduler } = await startScheduler({ data: () => data, database, clock });
    expect(database.listLoopScheduleStates()[0]!.nextRunAt).toBe("2026-07-12T09:00:00.000Z");

    data = workspace(automation(daily("10:00")));
    await scheduler.trigger();
    expect(database.listLoopScheduleStates()).toEqual([expect.objectContaining({
      nextRunAt: "2026-07-12T10:00:00.000Z",
      lastStatus: undefined
    })]);

    data = workspace({ version: 7, loops: [] });
    await scheduler.trigger();
    expect(database.listLoopScheduleStates()).toEqual([]);
  });
});

describe("Loop scheduler automation signals", () => {
  it("reconciles an automation save that arrives while a tick is in flight", async () => {
    let data = workspace(automation(daily("09:00")));
    const database = await runtimeDatabase();
    const clock = new FakeScheduleClock("2026-07-12T08:00:00.000Z");
    let releaseFirstRead: (() => void) | undefined;
    let blockFirstRead = true;
    let automationListener: ((reason?: string) => void) | undefined;
    const readData = vi.fn(async () => {
      const snapshot = data;
      if (blockFirstRead) {
        blockFirstRead = false;
        await new Promise<void>((resolve) => { releaseFirstRead = resolve; });
      }
      return snapshot;
    });
    const scheduler = new LoopScheduler({
      readData,
      database: () => database,
      dispatch: async () => ({ status: "stale" }),
      subscribeChanges: (listener) => {
        automationListener = listener;
        return () => { automationListener = undefined; };
      },
      clock,
      intervalMs: 3_600_000
    });
    schedulers.push(scheduler);
    scheduler.start();
    await vi.waitFor(() => expect(readData).toHaveBeenCalledOnce());

    data = workspace(automation(daily("10:00")));
    automationListener?.("automation");
    releaseFirstRead?.();

    await vi.waitFor(() => {
      expect(readData).toHaveBeenCalledTimes(2);
      expect(database.listLoopScheduleStates()[0]?.nextRunAt).toBe("2026-07-12T10:00:00.000Z");
    });
  });
});
