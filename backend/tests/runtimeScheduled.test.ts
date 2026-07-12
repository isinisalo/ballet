import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectAutomationConfig, ProjectExecutableStep } from "../../shared/domain/automation.js";
import { builtInLoopThemes, resolveLoopTheme } from "../../shared/domain/loopThemes.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { scheduleDefinitionHash } from "../scheduling/ScheduleDefinition.js";

const roots: string[] = [];
const databases: RuntimeDatabase[] = [];

afterEach(async () => {
  databases.splice(0).forEach((database) => database.close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const config = (target: ProjectExecutableStep): ProjectAutomationConfig => ({
  version: 6,
  loops: [{
    id: "scheduled-delivery",
    theme: "open-ai",
    start: "timer",
    steps: [{
      id: "timer",
      type: "scheduled",
      description: "Start once.",
      nodeSize: "small",
      schedule: {
        kind: "once",
        date: "2026-07-12",
        time: "09:00",
        timeZone: "UTC"
      },
      on: { triggered: target.id }
    }, target]
  }]
});

const agent: ProjectExecutableStep = {
  id: "agent-work",
  type: "agent",
  agentId: "delivery-agent",
  description: "Deliver.",
  nodeSize: "medium",
  on: { approved: { end: "completed" }, rejected: { end: "failed" } }
};

const human: ProjectExecutableStep = {
  id: "human-gate",
  type: "human",
  description: "Approve delivery.",
  nodeSize: "small",
  on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
};
const openAiTheme = resolveLoopTheme(builtInLoopThemes, "open-ai");

describe("scheduled runtime starts", () => {
  it.each([
    ["agent", agent, "running", "queued"],
    ["human", human, "waiting_for_human", "waiting_for_human"]
  ] as const)("starts directly from the triggered %s step", async (_kind, target, runStatus, stepStatus) => {
    const root = await mkdtemp(path.join(tmpdir(), "ballet-runtime-scheduled-"));
    roots.push(root);
    const database = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    databases.push(database);
    const automation = config(target);
    const scheduled = automation.loops[0]!.steps[0]!;
    if (scheduled.type !== "scheduled") throw new Error("Expected scheduled fixture step.");
    const definitionHash = scheduleDefinitionHash(scheduled.schedule, scheduled.on.triggered);
    database.syncLoopScheduleDefinitions([{
      loopId: "scheduled-delivery",
      stepId: "timer",
      definitionHash,
      nextRunAt: "2026-07-12T09:00:00.000Z"
    }], "2026-07-12T08:00:00.000Z");

    const scheduledFor = "2026-07-12T09:00:00.000Z";
    const rootRunId = insertRoot(database, "scheduled-delivery", "schedule");
    expect(database.completeLoopScheduleOccurrence({
      loopId: "scheduled-delivery",
      stepId: "timer",
      definitionHash,
      scheduledFor,
      status: "started",
      updatedAt: "2026-07-12T09:00:00.000Z"
    })).toBe(true);
    const run = database.startLoopRun(
      automation,
      "scheduled-delivery",
      openAiTheme,
      rootRunId,
      undefined,
      "schedule",
      undefined,
      { stepId: "timer", scheduledFor }
    );
    expect(database.finishReservedScheduleOccurrence({
      loopId: "scheduled-delivery", stepId: "timer", scheduledFor,
      status: "started", runId: run.runId, updatedAt: "2026-07-12T09:00:00.000Z"
    })).toBe(true);

    expect(run).toMatchObject({
      source: "schedule",
      status: runStatus,
      schedule: { stepId: "timer", scheduledFor: "2026-07-12T09:00:00.000Z" }
    });
    expect(run.stepRuns).toHaveLength(1);
    expect(run.stepRuns[0]).toMatchObject({
      stepId: target.id,
      type: target.type,
      status: stepStatus
    });
    expect(run.stepRuns.some((step) => step.stepId === "timer")).toBe(false);
    expect(database.listLoopScheduleStates()).toEqual([expect.objectContaining({
      lastStatus: "started",
      lastRunId: run.runId
    })]);
  });

  it("lets a manual start bypass the scheduled step", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ballet-runtime-scheduled-"));
    roots.push(root);
    const database = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    databases.push(database);
    const automation = config(agent);
    const rootRunId = insertRoot(database, "scheduled-delivery", "manual");

    const run = database.startLoopRun(
      automation,
      "scheduled-delivery",
      openAiTheme,
      rootRunId,
      "Manual context",
      "manual"
    );

    expect(run).toMatchObject({ source: "manual", schedule: undefined });
    expect(run.stepRuns).toHaveLength(1);
    expect(run.stepRuns[0]).toMatchObject({
      stepId: "agent-work",
      type: "agent",
      input: "Manual context"
    });
    expect(run.stepRuns.some((step) => step.stepId === "timer")).toBe(false);
  });
});

const insertRoot = (database: RuntimeDatabase, targetId: string, source: "manual" | "schedule"): string => {
  const rootRunId = randomUUID();
  const timestamp = new Date().toISOString();
  database.connection().prepare(`
    INSERT INTO root_runs (
      root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
      config_hash, snapshot_hash, created_at, updated_at
    ) VALUES (?, 'loop', ?, ?, 'queued', ?, ?, ?, 'config', 'snapshot', ?, ?)
  `).run(rootRunId, targetId, source, `/tmp/${rootRunId}`, `ballet/run/${rootRunId}`, "a".repeat(40), timestamp, timestamp);
  return rootRunId;
};
