import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultTerminalNodes, type ProjectAutomationConfig } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { ExecutionProfile } from "../../shared/domain/projectConfig.js";
import type { RootExecutionSnapshot, StepOutcome } from "../../shared/domain/runtime.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { scheduleDefinitionHash } from "../scheduling/ScheduleDefinition.js";

const roots: string[] = [];
const databases: RuntimeDatabase[] = [];
const profile: ExecutionProfile = {
  id: "delivery-profile",
  name: "Delivery",
  provider: "codex",
  model: "gpt-test",
  reasoningEffort: "high",
  networkAccess: false
};

afterEach(async () => {
  databases.splice(0).forEach((database) => database.close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const automation: ProjectAutomationConfig = {
  version: 9,
  loops: [{
    id: "scheduled-delivery",
    start: "timer",
    nodes: [{
      id: "timer",
      type: "scheduled",
      executionProfileId: profile.id,
      primaryInstructionId: "project:delivery",
      skillIds: ["project:schedule"],
      description: "Deliver once.",
      nodeStyle: "luna",
      nodeSize: "tiny",
      schedule: { kind: "once", date: "2026-07-12", time: "09:00", timeZone: "UTC" },
      on: { approved: "completed", rejected: "blocked" }
    }, ...defaultTerminalNodes()]
  }]
};

const ready: StepOutcome = {
  state: "completed",
  result: "approved",
  summary: "Delivered.",
  checks: []
};

const rejectedOutcome: StepOutcome = {
  state: "completed",
  result: "rejected",
  summary: "Delivery needs changes.",
  checks: []
};

describe("scheduled runtime starts", () => {
  it("runs the composed Scheduled node itself as an execution StepRun", async () => {
    const database = await runtimeDatabase();
    const scheduled = automation.loops[0]!.nodes[0]!;
    if (scheduled.type !== "scheduled") throw new Error("Expected scheduled fixture step.");
    const definitionHash = scheduleDefinitionHash(scheduled);
    database.syncLoopScheduleDefinitions([{
      loopId: "scheduled-delivery",
      stepId: scheduled.id,
      definitionHash,
      nextRunAt: "2026-07-12T09:00:00.000Z"
    }], "2026-07-12T08:00:00.000Z");

    const scheduledFor = "2026-07-12T09:00:00.000Z";
    const rootRunId = insertRoot(database, automation, "scheduled-delivery", "schedule");
    expect(database.completeLoopScheduleOccurrence({
      loopId: "scheduled-delivery", stepId: scheduled.id, definitionHash, scheduledFor,
      status: "started", updatedAt: scheduledFor
    })).toBe(true);
    const run = database.startLoopRun(
      rootRunId, undefined, "schedule", { stepId: scheduled.id, scheduledFor }
    );

    expect(run).toMatchObject({
      source: "schedule",
      status: "running",
      schedule: { stepId: scheduled.id, scheduledFor }
    });
    expect(run.stepRuns).toEqual([expect.objectContaining({
      stepId: scheduled.id,
      type: "scheduled",
      status: "queued"
    })]);

    const completed = database.completeExecutionStep({
      stepRunId: run.stepRuns[0]!.stepRunId,
      outcome: ready
    });
    expect(completed.status).toBe("completed");
  });

  it("uses the same composed Scheduled Step for manual runs", async () => {
    const database = await runtimeDatabase();
    const rootRunId = insertRoot(database, automation, "scheduled-delivery", "manual");
    const run = database.startLoopRun(
      rootRunId, "Manual context", "manual"
    );

    expect(run).toMatchObject({ source: "manual", schedule: undefined });
    expect(run.stepRuns).toEqual([expect.objectContaining({
      stepId: "timer",
      type: "scheduled",
      input: "Manual context"
    })]);
  });

  it("follows the scheduled node's rejected output", async () => {
    const database = await runtimeDatabase();
    const rootRunId = insertRoot(database, automation, "scheduled-delivery", "manual");
    const run = database.startLoopRun(
      rootRunId, undefined, "manual"
    );

    const rejected = database.completeExecutionStep({
      stepRunId: run.stepRuns[0]!.stepRunId,
      outcome: rejectedOutcome
    });

    expect(rejected.status).toBe("blocked");
    expect(rejected.stepRuns[0]).toMatchObject({ result: "rejected", status: "completed" });
  });

  it("routes a persisted Scheduled result to another Loop", async () => {
    const database = await runtimeDatabase();
    const config: ProjectAutomationConfig = {
      version: 9,
      loops: [{
        id: "scheduled-delivery",
        start: "timer",
        nodes: [{
          id: "timer",
          type: "scheduled",
          executionProfileId: profile.id,
          primaryInstructionId: "project:delivery",
          skillIds: ["project:schedule"],
          description: "Deliver once.",
          nodeStyle: "luna",
          nodeSize: "tiny",
          schedule: { kind: "once", date: "2026-07-12", time: "09:00", timeZone: "UTC" },
          on: { approved: { loop: "release-gate" }, rejected: "blocked" }
        }, ...defaultTerminalNodes()]
      }, {
        id: "release-gate",
        start: "approve",
        nodes: [{
          id: "approve",
          type: "human",
          description: "Approve release.",
          nodeStyle: "flat",
          nodeSize: "medium",
          on: { approved: "completed", rejected: "blocked" }
        }, ...defaultTerminalNodes()]
      }]
    };
    const rootRunId = insertRoot(database, config, "scheduled-delivery", "manual");
    const source = database.startLoopRun(rootRunId);

    const completed = database.completeExecutionStep({
      stepRunId: source.stepRuns[0]!.stepRunId,
      outcome: ready
    });
    const rootRuns = database.listRootLoopRuns(rootRunId);
    const target = rootRuns.find((run) => run.loopId === "release-gate");

    expect(completed).toMatchObject({ status: "completed", transitionCount: 1 });
    expect(completed.stepRuns[0]).toMatchObject({ status: "completed", result: "approved" });
    expect(target).toMatchObject({
      parentRunId: source.runId,
      parentStepRunId: source.stepRuns[0]!.stepRunId,
      source: "transition",
      status: "waiting_for_human"
    });
    expect(target?.stepRuns).toEqual([expect.objectContaining({
      stepId: "approve",
      type: "human",
      status: "waiting_for_human"
    })]);
  });
});

const runtimeDatabase = async (): Promise<RuntimeDatabase> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-runtime-scheduled-"));
  roots.push(root);
  const database = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
  databases.push(database);
  return database;
};

const insertRoot = (
  database: RuntimeDatabase,
  config: ProjectAutomationConfig,
  targetId: string,
  source: "manual" | "schedule"
): string => {
  const rootRunId = randomUUID();
  const timestamp = new Date().toISOString();
  const snapshot: RootExecutionSnapshot = {
    version: 1,
    rootLoopId: targetId,
    project: {
      checkoutRoot: "/fixture",
      headSha: "a".repeat(40),
      configHash: "config",
      snapshotHash: "snapshot"
    },
    loops: structuredClone(config.loops),
    theme: structuredClone(defaultLoopTheme),
    executionProfiles: [profile],
    runtimes: [],
    resources: [],
    createdAt: timestamp
  };
  database.connection().prepare(`
    INSERT INTO root_runs (
      root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
      config_hash, snapshot_hash, execution_snapshot_json, created_at, updated_at
    ) VALUES (?, 'loop', ?, ?, 'queued', ?, ?, ?, 'config', 'snapshot', ?, ?, ?)
  `).run(rootRunId, targetId, source, `/tmp/${rootRunId}`, `ballet/run/${rootRunId}`, "a".repeat(40),
    JSON.stringify(snapshot), timestamp, timestamp);
  return rootRunId;
};
