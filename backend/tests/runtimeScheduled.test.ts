import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectAutomationConfig, ProjectExecutableStep } from "../../shared/domain/automation.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { scheduleDefinitionHash } from "../scheduling/ScheduleDefinition.js";

const roots: string[] = [];
const databases: RuntimeDatabase[] = [];

afterEach(async () => {
  databases.splice(0).forEach((database) => database.close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const config = (target: ProjectExecutableStep): ProjectAutomationConfig => ({
  version: 5,
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

    const result = database.dispatchLoopScheduleOccurrence(automation, {
      loopId: "scheduled-delivery",
      stepId: "timer",
      definitionHash,
      scheduledFor: "2026-07-12T09:00:00.000Z",
      updatedAt: "2026-07-12T09:00:00.000Z"
    });

    expect(result.status).toBe("started");
    if (result.status !== "started") throw new Error("Expected scheduled run to start.");
    expect(result.run).toMatchObject({
      source: "schedule",
      status: runStatus,
      schedule: { stepId: "timer", scheduledFor: "2026-07-12T09:00:00.000Z" }
    });
    expect(result.run.stepRuns).toHaveLength(1);
    expect(result.run.stepRuns[0]).toMatchObject({
      stepId: target.id,
      type: target.type,
      status: stepStatus
    });
    expect(result.run.stepRuns.some((step) => step.stepId === "timer")).toBe(false);
    expect(database.listLoopScheduleStates()).toEqual([expect.objectContaining({
      lastStatus: "started",
      lastRunId: result.run.runId
    })]);
  });

  it("lets a manual start bypass the scheduled step", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ballet-runtime-scheduled-"));
    roots.push(root);
    const database = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    databases.push(database);
    const automation = config(agent);

    const run = database.startLoopRun(
      automation,
      "scheduled-delivery",
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
