import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppData } from "../../shared/api/workspaceData.js";
import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import { ControlPlanePreflightError } from "../control-plane/errors.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { scheduleDefinitionHash } from "../scheduling/index.js";
import type { LoopExecutionGateway } from "../services/LoopExecutionGateway.js";
import { LoopRunService } from "../services/LoopRunService.js";
import type { RuntimeDatabaseProvider } from "../services/RuntimeDatabaseProvider.js";

const roots: string[] = [];
const databases: RuntimeDatabase[] = [];

afterEach(async () => {
  databases.splice(0).forEach((database) => database.close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("scheduled LoopRun service", () => {
  it("records an exact skipped error when runtime preflight is unavailable", async () => {
    const context = await serviceContext("agent");

    const result = await context.service.dispatchScheduled(context.occurrence);

    expect(result).toEqual({
      status: "skipped",
      error: "Cannot start an agent loop before the runtime control plane is configured."
    });
    expect(context.database.listLoopRuns()).toEqual([]);
    expect(context.database.listLoopScheduleStates()[0]).toMatchObject({
      lastStatus: "skipped",
      lastError: "Cannot start an agent loop before the runtime control plane is configured."
    });
  });

  it("skips an active loop before running preflight", async () => {
    const context = await serviceContext("human");
    context.database.startLoopRun(context.data.automation, "scheduled-work");
    context.service.setExecutionGateway(gateway(async () => {
      throw new Error("Preflight should not run for an active loop.");
    }));

    const result = await context.service.dispatchScheduled(context.occurrence);

    expect(result).toEqual({
      status: "skipped",
      error: "Loop scheduled-work already has an active run."
    });
    expect(context.database.listLoopRuns()).toHaveLength(1);
    expect(context.database.listLoopScheduleStates()[0]).toMatchObject({
      lastStatus: "skipped",
      lastError: "Loop scheduled-work already has an active run."
    });
  });

  it("marks an occurrence missed if preflight finishes after its dispatch minute", async () => {
    let now = new Date("2026-07-12T09:00:10.000Z");
    const context = await serviceContext("human", () => now);
    context.service.setExecutionGateway(gateway(async () => {
      now = new Date("2026-07-12T09:01:00.000Z");
      return undefined;
    }));

    const result = await context.service.dispatchScheduled(context.occurrence);

    expect(result).toEqual({
      status: "missed",
      error: "Scheduled occurrence expired before runtime preflight completed."
    });
    expect(context.database.listLoopScheduleStates()[0]).toMatchObject({ lastStatus: "missed" });
    expect(context.database.listLoopRuns()).toEqual([]);
  });

  it("stores exact runtime preflight issue details", async () => {
    const context = await serviceContext("human");
    context.service.setExecutionGateway(gateway(async () => {
      throw new ControlPlanePreflightError("Loop run preflight failed.", [{
        agentId: "worker",
        stepId: "scheduled-work:work",
        code: "offline",
        message: "The paired runtime is offline."
      }]);
    }));

    const result = await context.service.dispatchScheduled(context.occurrence);

    const error = "Loop run preflight failed. scheduled-work:work: The paired runtime is offline.";
    expect(result).toEqual({ status: "skipped", error });
    expect(context.database.listLoopScheduleStates()[0]).toMatchObject({
      lastStatus: "skipped",
      lastError: error
    });
  });

  it("does not dispatch after the scheduler pause gate closes during preflight", async () => {
    let allowed = true;
    const context = await serviceContext("human");
    context.service.setExecutionGateway(gateway(async () => {
      allowed = false;
      return undefined;
    }));

    const result = await context.service.dispatchScheduled({
      ...context.occurrence,
      canDispatch: () => allowed
    });

    expect(result).toEqual({ status: "stale" });
    expect(context.database.listLoopRuns()).toEqual([]);
    expect(context.database.listLoopScheduleStates()[0]).toMatchObject({
      nextRunAt: context.occurrence.scheduledFor,
      lastStatus: undefined
    });
  });

  it("does not dispatch an occurrence after its schedule definition changes", async () => {
    const context = await serviceContext("human");
    const scheduled = context.data.automation.loops[0]!.steps[0]!;
    if (scheduled.type !== "scheduled") throw new Error("Expected scheduled fixture.");
    scheduled.schedule = { ...scheduled.schedule, time: "10:00" };

    const result = await context.service.dispatchScheduled(context.occurrence);

    expect(result).toEqual({ status: "stale" });
    expect(context.database.listLoopRuns()).toEqual([]);
    expect(context.database.listLoopScheduleStates()[0]).toMatchObject({
      nextRunAt: context.occurrence.scheduledFor,
      lastStatus: undefined
    });
  });

  it("does not dispatch when automation changes during runtime preflight", async () => {
    const context = await serviceContext("human");
    context.service.setExecutionGateway(gateway(async () => {
      const scheduled = context.data.automation.loops[0]!.steps[0]!;
      if (scheduled.type !== "scheduled") throw new Error("Expected scheduled fixture.");
      scheduled.schedule = { ...scheduled.schedule, time: "10:00" };
      return undefined;
    }));

    const result = await context.service.dispatchScheduled(context.occurrence);

    expect(result).toEqual({ status: "stale" });
    expect(context.database.listLoopRuns()).toEqual([]);
    expect(context.database.listLoopScheduleStates()[0]).toMatchObject({
      nextRunAt: context.occurrence.scheduledFor,
      lastStatus: undefined
    });
  });
});

const serviceContext = async (targetType: "agent" | "human", now: () => Date = () => new Date("2026-07-12T09:00:10.000Z")) => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-scheduled-service-"));
  roots.push(root);
  const database = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
  databases.push(database);
  const automation = automationConfig(targetType);
  const data = workspace(automation);
  const provider = { runtimeDatabase: () => database } as RuntimeDatabaseProvider;
  const service = new LoopRunService(async () => data, provider, now);
  const scheduled = automation.loops[0]!.steps[0]!;
  if (scheduled.type !== "scheduled") throw new Error("Expected scheduled fixture.");
  const definitionHash = scheduleDefinitionHash(scheduled.schedule, scheduled.on.triggered);
  const occurrence = {
    loopId: automation.loops[0]!.id,
    stepId: scheduled.id,
    definitionHash,
    scheduledFor: "2026-07-12T09:00:00.000Z",
    updatedAt: "2026-07-12T09:00:10.000Z"
  };
  database.syncLoopScheduleDefinitions([{ ...occurrence, nextRunAt: occurrence.scheduledFor }], occurrence.updatedAt);
  return { data, database, service, occurrence };
};

const automationConfig = (targetType: "agent" | "human"): ProjectAutomationConfig => ({
  version: 5,
  loops: [{
    id: "scheduled-work",
    theme: "open-ai",
    start: "timer",
    steps: [{
      id: "timer",
      type: "scheduled",
      description: "Start work.",
      nodeSize: "small",
      schedule: { kind: "once", date: "2026-07-12", time: "09:00", timeZone: "UTC" },
      on: { triggered: "work" }
    }, targetType === "agent" ? {
      id: "work",
      type: "agent",
      agentId: "worker",
      description: "Work.",
      nodeSize: "medium",
      on: { approved: { end: "completed" }, rejected: { end: "failed" } }
    } : {
      id: "work",
      type: "human",
      description: "Approve.",
      nodeSize: "small",
      on: { approved: { end: "completed" }, rejected: { end: "failed" } }
    }]
  }]
});

const workspace = (automation: ProjectAutomationConfig): AppData => ({
  projects: [], goals: [], adrs: [], agents: [], skills: [], policies: [], eventDefinitions: [],
  events: [], loopRuns: [], scheduleStates: [], automation, automationIssues: []
});

const gateway = (prepare: LoopExecutionGateway["prepare"]): LoopExecutionGateway => ({
  prepare,
  enqueuePending: async () => undefined,
  cancel: async () => undefined,
  finalizeIfTerminal: async () => undefined
});
