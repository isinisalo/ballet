import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultTerminalNodes, type ProjectAutomationConfig } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { AgentOutcome } from "../../shared/domain/runtime.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { scheduleDefinitionHash } from "../scheduling/ScheduleDefinition.js";

const roots: string[] = [];
const databases: RuntimeDatabase[] = [];

afterEach(async () => {
  databases.splice(0).forEach((database) => database.close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const automation: ProjectAutomationConfig = {
  version: 8,
  loops: [{
    id: "scheduled-delivery",
    start: "timer",
    nodes: [{
      id: "timer",
      type: "scheduled",
      agentId: "delivery-agent",
      description: "Deliver once.",
      nodeStyle: "luna",
      nodeSize: "tiny",
      schedule: { kind: "once", date: "2026-07-12", time: "09:00", timeZone: "UTC" },
      on: { approved: "completed", rejected: "blocked" }
    }, ...defaultTerminalNodes()]
  }]
};

const ready: AgentOutcome = {
  outcome: "ready",
  summary: "Delivered.",
  checks: []
};

const blocked: AgentOutcome = {
  outcome: "blocked",
  summary: "Delivery is blocked.",
  checks: []
};

describe("scheduled runtime starts", () => {
  it("runs the scheduled node itself as an agent StepRun", async () => {
    const database = await runtimeDatabase();
    const scheduled = automation.loops[0]!.nodes[0]!;
    if (scheduled.type !== "scheduled") throw new Error("Expected scheduled fixture step.");
    const definitionHash = scheduleDefinitionHash(scheduled.schedule, scheduled.agentId);
    database.syncLoopScheduleDefinitions([{
      loopId: "scheduled-delivery",
      stepId: scheduled.id,
      definitionHash,
      nextRunAt: "2026-07-12T09:00:00.000Z"
    }], "2026-07-12T08:00:00.000Z");

    const scheduledFor = "2026-07-12T09:00:00.000Z";
    const rootRunId = insertRoot(database, "scheduled-delivery", "schedule");
    expect(database.completeLoopScheduleOccurrence({
      loopId: "scheduled-delivery", stepId: scheduled.id, definitionHash, scheduledFor,
      status: "started", updatedAt: scheduledFor
    })).toBe(true);
    const run = database.startLoopRun(
      automation, "scheduled-delivery", defaultLoopTheme, rootRunId, undefined, "schedule", undefined,
      { stepId: scheduled.id, scheduledFor }
    );

    expect(run).toMatchObject({
      source: "schedule",
      status: "running",
      schedule: { stepId: scheduled.id, scheduledFor }
    });
    expect(run.stepRuns).toEqual([expect.objectContaining({
      stepId: scheduled.id,
      type: "agent",
      agentId: scheduled.agentId,
      status: "queued"
    })]);

    const completed = database.completeAgentStep(automation, defaultLoopTheme, {
      stepRunId: run.stepRuns[0]!.stepRunId,
      outcome: ready
    });
    expect(completed.status).toBe("completed");
  });

  it("uses the same scheduled agent-backed start for manual runs", async () => {
    const database = await runtimeDatabase();
    const rootRunId = insertRoot(database, "scheduled-delivery", "manual");
    const run = database.startLoopRun(
      automation, "scheduled-delivery", defaultLoopTheme, rootRunId, "Manual context", "manual"
    );

    expect(run).toMatchObject({ source: "manual", schedule: undefined });
    expect(run.stepRuns).toEqual([expect.objectContaining({
      stepId: "timer",
      type: "agent",
      agentId: "delivery-agent",
      input: "Manual context"
    })]);
  });

  it("follows the scheduled node's rejected output", async () => {
    const database = await runtimeDatabase();
    const rootRunId = insertRoot(database, "scheduled-delivery", "manual");
    const run = database.startLoopRun(
      automation, "scheduled-delivery", defaultLoopTheme, rootRunId, undefined, "manual"
    );

    const rejected = database.completeAgentStep(automation, defaultLoopTheme, {
      stepRunId: run.stepRuns[0]!.stepRunId,
      outcome: blocked
    });

    expect(rejected.status).toBe("blocked");
    expect(rejected.stepRuns[0]).toMatchObject({ result: "rejected", status: "completed" });
  });
});

const runtimeDatabase = async (): Promise<RuntimeDatabase> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-runtime-scheduled-"));
  roots.push(root);
  const database = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
  databases.push(database);
  return database;
};

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
