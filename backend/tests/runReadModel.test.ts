// This read-model suite intentionally shares one in-memory database harness across dashboard scenarios.
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppData } from "../../shared/api/workspaceData.js";
import type { ProjectLoop } from "../../shared/domain/automation.js";
import { builtInLoopThemes, resolveLoopTheme } from "../../shared/domain/loopThemes.js";
import type { AgentOutcome, ExecutionSpec, ExecutionTaskStatus, LoopRunStatus } from "../../shared/domain/runtime.js";
import {
  bridgeRunInvalidations,
  RunInvalidationBroadcaster,
  RunReadModelService,
  RunReadModelStore,
  RunTargetService
} from "../runs/index.js";

const PROJECT_ID = "project";
const READY: AgentOutcome = { outcome: "ready", summary: "Done.", checks: [] };
const BLOCKED: AgentOutcome = { outcome: "blocked", summary: "Needs input.", checks: [] };
const DELIVERY: ProjectLoop = {
  id: "delivery",
  theme: "open-ai",
  start: "implement",
  steps: [{
    id: "implement", type: "agent", agentId: "developer", description: "Implement.",
    nodeSize: "medium",
    on: { approved: { loop: "release" }, rejected: { end: "failed" } }
  }]
};
const RELEASE: ProjectLoop = {
  id: "release",
  theme: "open-ai",
  start: "publish",
  steps: [{
    id: "publish", type: "agent", agentId: "publisher", description: "Publish.",
    nodeSize: "medium",
    on: { approved: { end: "completed" }, rejected: { end: "failed" } }
  }]
};

let runtime: Database.Database;
let control: Database.Database;
let service: RunReadModelService;

beforeEach(() => {
  runtime = new Database(":memory:");
  control = new Database(":memory:");
  createRuntimeSchema(runtime);
  createControlSchema(control);
  service = new RunReadModelService(new RunReadModelStore({
    runtimeConnection: () => runtime,
    controlPlaneConnection: () => control,
    projectId: PROJECT_ID
  }));
});

afterEach(() => {
  runtime.close();
  control.close();
});

describe("root run read model", () => {
  it("aggregates nested scheduled LoopRuns and exposes exact current execution state", () => {
    insertLoop({ runId: "root-loop", rootRunId: "root-loop", loop: DELIVERY, source: "schedule", status: "completed", createdAt: "2026-07-11T08:00:00.000Z" });
    insertStep({ stepRunId: "step-implement", runId: "root-loop", loopId: "delivery", stepId: "implement", agentId: "developer", taskId: "task-implement", status: "completed", createdAt: "2026-07-11T08:00:00.100Z" });
    insertLoop({ runId: "nested-loop", rootRunId: "root-loop", parentRunId: "root-loop", loop: RELEASE, source: "human", status: "running", createdAt: "2026-07-11T08:01:00.000Z" });
    insertStep({ stepRunId: "step-publish", runId: "nested-loop", loopId: "release", stepId: "publish", agentId: "publisher", taskId: "task-publish", status: "queued", createdAt: "2026-07-11T08:01:00.100Z" });
    insertTask("task-implement", "root-loop", "developer", "succeeded", "2026-07-11T08:00:00.100Z", READY);
    insertTask("task-publish", "root-loop", "publisher", "queued", "2026-07-11T08:01:00.100Z");

    expect(service.detail("root-loop")).toMatchObject({
      kind: "loop",
      targetId: "delivery",
      source: "schedule",
      status: "queued",
      current: {
        loopRunId: "nested-loop",
        loopId: "release",
        stepRunId: "step-publish",
        stepId: "publish",
        taskId: "task-publish",
        agentId: "publisher",
        taskStatus: "queued"
      },
      loopRuns: [{ runId: "root-loop" }, { runId: "nested-loop" }],
      tasks: [{ id: "task-implement" }, { id: "task-publish" }]
    });
    expect(service.list({ state: "active" }).items.map((run) => run.rootRunId)).toEqual(["root-loop"]);
  });

  it("normalizes pending and reported Git finalization without discarding the report", () => {
    insertLoop({ runId: "root-loop", rootRunId: "root-loop", loop: DELIVERY, source: "manual", status: "completed", createdAt: "2026-07-11T08:00:00.000Z" });
    insertStep({ stepRunId: "step-implement", runId: "root-loop", loopId: "delivery", stepId: "implement", agentId: "developer", taskId: "task-implement", status: "completed", createdAt: "2026-07-11T08:00:00.100Z" });
    insertTask("task-implement", "root-loop", "developer", "succeeded", "2026-07-11T08:00:00.100Z", READY);
    insertFinalization("root-loop", "pending");

    expect(service.detail("root-loop")).toMatchObject({ status: "finalizing", finalization: { status: "pending", success: true } });

    const report = {
      success: true, retained: false, branch: "ballet/run/root-loop", worktreePath: "/tmp/root-loop",
      commitSha: "a".repeat(40), changedFiles: ["src/app.ts"], snapshotHash: "c".repeat(64)
    };
    control.prepare("UPDATE root_run_finalizations SET status = 'reported', report_json = ?, finalized_at = ? WHERE root_run_id = ?")
      .run(JSON.stringify(report), "2026-07-11T08:03:00.000Z", "root-loop");
    expect(service.detail("root-loop")).toMatchObject({
      status: "completed",
      completedAt: "2026-07-11T08:03:00.000Z",
      finalization: { status: "reported", report: { commitSha: "a".repeat(40), changedFiles: ["src/app.ts"] } }
    });
  });

  it("normalizes a direct AgentRun blocked outcome and keeps immutable instructions in its task", () => {
    insertAgentRun("agent-root", "developer", "failed", BLOCKED, "schedule");
    insertTask("agent-task", "agent-root", "developer", "succeeded", "2026-07-11T09:00:00.000Z", BLOCKED, "agent_run", "agent-root");

    const detail = service.detail("agent-root");
    expect(detail).toMatchObject({
      kind: "agent", targetId: "developer", source: "schedule", status: "blocked",
      current: { taskId: "agent-task", agentId: "developer", taskStatus: "succeeded" }
    });
    expect(detail?.tasks[0]?.spec.agent.instructions).toBe("Immutable developer instructions.");
    expect(service.list({ state: "recent", kind: "agent" }).items).toHaveLength(1);
    expect(service.list({ state: "active", kind: "agent" }).items).toEqual([]);
  });

  it("never drops old active or finalizing roots behind the recent scan limit", () => {
    insertLoop({ runId: "old-active-loop", rootRunId: "old-active-loop", loop: DELIVERY, source: "manual", status: "running", createdAt: "2026-07-11T07:00:00.000Z" });
    insertLoop({ runId: "new-completed-loop", rootRunId: "new-completed-loop", loop: RELEASE, source: "manual", status: "completed", createdAt: "2026-07-11T12:00:00.000Z" });
    insertLoop({ runId: "old-finalizing-loop", rootRunId: "old-finalizing-loop", loop: RELEASE, source: "manual", status: "completed", createdAt: "2026-07-11T06:00:00.000Z" });
    insertFinalization("old-finalizing-loop", "pending");
    insertAgentRun("old-active-agent", "developer", "queued", undefined, "manual", "old-agent-task", "2026-07-11T07:00:00.000Z");
    insertAgentRun("new-completed-agent", "publisher", "succeeded", READY, "manual", "new-agent-task", "2026-07-11T12:00:00.000Z");
    const limited = new RunReadModelService(new RunReadModelStore({
      runtimeConnection: () => runtime,
      controlPlaneConnection: () => control,
      projectId: PROJECT_ID
    }), 1);

    expect(limited.list({ state: "active" }).items.map((run) => [run.rootRunId, run.status]))
      .toEqual(expect.arrayContaining([
        ["old-active-loop", "running"],
        ["old-active-agent", "queued"],
        ["old-finalizing-loop", "finalizing"]
      ]));
  });

  it("builds launch targets with nested preflight and active root context", async () => {
    insertLoop({ runId: "root-loop", rootRunId: "root-loop", loop: DELIVERY, source: "schedule", status: "running", createdAt: "2026-07-11T08:00:00.000Z" });
    insertStep({ stepRunId: "step-implement", runId: "root-loop", loopId: "delivery", stepId: "implement", agentId: "developer", status: "queued", createdAt: "2026-07-11T08:00:00.100Z" });
    const data = appData();
    data.agents.push({ ...data.agents[0]!, id: "disabled", name: "disabled", enabled: false });
    const targets = await new RunTargetService({
      readData: async () => data,
      runs: service,
      preflightAgent: (agentId) => ({ ok: true, deviceId: agentId === "developer" ? "device-a" : "device-b", issues: [] })
    }).list();

    expect(targets.agents).toEqual([
      expect.objectContaining({ id: "developer", ready: true }),
      expect.objectContaining({ id: "publisher", ready: true }),
      expect.objectContaining({ id: "disabled", ready: false, issues: [expect.objectContaining({ code: "disabled" })] })
    ]);
    expect(targets.loops[0]).toMatchObject({ id: "delivery", ready: false, activeRootRunId: "root-loop" });
    expect(targets.loops[0]?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "mixed_device", stepId: "delivery:implement" }),
      expect.objectContaining({ code: "mixed_device", stepId: "release:publish" })
    ]));
  });

  it("marks a root target unready when a reachable Loop has an invalid theme reference", async () => {
    const data = appData();
    data.loopThemeIssues = [{
      path: "loops.1.theme",
      loopId: "release",
      themeId: "missing-theme",
      message: "Loop release references unknown theme: missing-theme."
    }];
    const targets = await new RunTargetService({
      readData: async () => data,
      runs: service,
      preflightAgent: () => ({ ok: true, deviceId: "device-a", issues: [] })
    }).list();

    expect(targets.loops).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "delivery",
        ready: false,
        issues: [expect.objectContaining({ code: "invalid_config", path: "loops.1.theme" })]
      }),
      expect.objectContaining({
        id: "release",
        ready: false,
        issues: [expect.objectContaining({ code: "invalid_config", path: "loops.1.theme" })]
      })
    ]));
  });
});

describe("run invalidation broadcaster", () => {
  it("replays missed events and disconnects bridged sources", () => {
    const broadcaster = new RunInvalidationBroadcaster(() => new Date("2026-07-11T10:00:00.000Z"));
    let runtimeListener: ((signal: string) => void) | undefined;
    let controlListener: ((type: string, payload: Record<string, unknown>) => void) | undefined;
    const runtimeUnsubscribe = vi.fn();
    const controlUnsubscribe = vi.fn();
    const disconnect = bridgeRunInvalidations(broadcaster, {
      subscribeRuntime: (listener) => { runtimeListener = listener; return runtimeUnsubscribe; },
      subscribeControlPlane: (listener) => { controlListener = listener; return controlUnsubscribe; }
    });
    runtimeListener?.("loop-runs");
    controlListener?.("execution_event", { rootRunId: "root-loop" });
    controlListener?.("task_state", { rootRunId: "root-loop" });

    expect(broadcaster.eventsAfter(1)).toEqual([expect.objectContaining({ id: 2, rootRunId: "root-loop", reason: "task_state" })]);
    disconnect();
    expect(runtimeUnsubscribe).toHaveBeenCalledOnce();
    expect(controlUnsubscribe).toHaveBeenCalledOnce();
  });
});

const createRuntimeSchema = (db: Database.Database) => db.exec(`
  CREATE TABLE loop_runs (
    run_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, loop_id TEXT NOT NULL, root_run_id TEXT NOT NULL,
    parent_run_id TEXT, parent_step_run_id TEXT, source TEXT NOT NULL, status TEXT NOT NULL,
    runtime_device_id TEXT, execution_plan_json TEXT, input TEXT, snapshot_json TEXT NOT NULL,
    transition_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
  );
  CREATE TABLE step_runs (
    step_run_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, run_id TEXT NOT NULL, loop_id TEXT NOT NULL,
    step_id TEXT NOT NULL, step_type TEXT NOT NULL, agent_id TEXT, execution_task_id TEXT,
    execution_snapshot_json TEXT, status TEXT NOT NULL, input TEXT, response_input TEXT, result TEXT,
    outcome_json TEXT, error TEXT, attempt INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL, completed_at TEXT
  );
`);

const createControlSchema = (db: Database.Database) => db.exec(`
  CREATE TABLE agent_runs (
    run_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, agent_id TEXT NOT NULL, root_run_id TEXT NOT NULL,
    task_id TEXT NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL, input TEXT, runtime_snapshot_json TEXT NOT NULL,
    project_snapshot_json TEXT NOT NULL, outcome_json TEXT, branch TEXT, worktree_path TEXT,
    error_code TEXT, error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
  );
  CREATE TABLE execution_tasks (
    task_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, runtime_backend_id TEXT NOT NULL, device_id TEXT NOT NULL,
    kind TEXT NOT NULL, root_run_id TEXT NOT NULL, status TEXT NOT NULL, spec_json TEXT NOT NULL,
    fencing INTEGER NOT NULL DEFAULT 0, lease_until TEXT, claimed_at TEXT, started_at TEXT, completed_at TEXT,
    cancel_requested_at TEXT, error_code TEXT, error_message TEXT, outcome_json TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE root_run_finalizations (
    root_run_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, expected_success INTEGER NOT NULL,
    status TEXT NOT NULL, report_json TEXT, authorized_at TEXT NOT NULL, finalized_at TEXT
  );
`);

const insertLoop = (input: {
  runId: string; rootRunId: string; loop: ProjectLoop; source: "manual" | "human" | "schedule";
  status: LoopRunStatus; createdAt: string; parentRunId?: string;
}) => runtime.prepare(`
  INSERT INTO loop_runs (run_id, project_id, loop_id, root_run_id, parent_run_id, source, status, snapshot_json, created_at, updated_at, completed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(input.runId, PROJECT_ID, input.loop.id, input.rootRunId, input.parentRunId ?? null, input.source, input.status,
  JSON.stringify({
    loop: input.loop,
    theme: resolveLoopTheme(builtInLoopThemes, input.loop.theme)
  }), input.createdAt, input.createdAt, input.status === "running" || input.status === "waiting_for_human" ? null : input.createdAt);

const insertStep = (input: {
  stepRunId: string; runId: string; loopId: string; stepId: string; agentId: string;
  status: string; createdAt: string; taskId?: string;
}) => runtime.prepare(`
  INSERT INTO step_runs (step_run_id, project_id, run_id, loop_id, step_id, step_type, agent_id, execution_task_id, status, created_at, updated_at, completed_at)
  VALUES (?, ?, ?, ?, ?, 'agent', ?, ?, ?, ?, ?, ?)
`).run(input.stepRunId, PROJECT_ID, input.runId, input.loopId, input.stepId, input.agentId, input.taskId ?? null,
  input.status, input.createdAt, input.createdAt, ["completed", "failed", "cancelled"].includes(input.status) ? input.createdAt : null);

const insertTask = (
  taskId: string,
  rootRunId: string,
  agentId: string,
  status: ExecutionTaskStatus,
  createdAt: string,
  outcome?: AgentOutcome,
  kind: "agent_run" | "loop_step" = "loop_step",
  agentRunId?: string
) => {
  const spec = executionSpec(taskId, rootRunId, agentId, createdAt, kind, agentRunId);
  control.prepare(`
    INSERT INTO execution_tasks (task_id, project_id, runtime_backend_id, device_id, kind, root_run_id, status, spec_json,
      outcome_json, created_at, updated_at, completed_at)
    VALUES (?, ?, 'backend', 'device', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(taskId, PROJECT_ID, kind, rootRunId, status, JSON.stringify(spec), outcome ? JSON.stringify(outcome) : null,
    createdAt, createdAt, ["succeeded", "failed", "cancelled"].includes(status) ? createdAt : null);
};

const insertAgentRun = (
  rootRunId: string,
  agentId: string,
  status: ExecutionTaskStatus,
  outcome?: AgentOutcome,
  source: "manual" | "schedule" = "manual",
  taskId = "agent-task",
  createdAt = "2026-07-11T09:00:00.000Z"
) => {
  const spec = executionSpec(taskId, rootRunId, agentId, createdAt, "agent_run", rootRunId);
  control.prepare(`
    INSERT INTO agent_runs (run_id, project_id, agent_id, root_run_id, task_id, source, status, runtime_snapshot_json,
      project_snapshot_json, outcome_json, created_at, updated_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(rootRunId, PROJECT_ID, agentId, rootRunId, taskId, source, status, JSON.stringify(spec.runtime), JSON.stringify(spec.project),
    outcome ? JSON.stringify(outcome) : null, createdAt, createdAt, createdAt);
};

const insertFinalization = (rootRunId: string, status: "pending" | "reported") => control.prepare(`
  INSERT INTO root_run_finalizations (root_run_id, project_id, expected_success, status, authorized_at)
  VALUES (?, ?, 1, ?, '2026-07-11T08:02:00.000Z')
`).run(rootRunId, PROJECT_ID, status);

const executionSpec = (
  taskId: string,
  rootRunId: string,
  agentId: string,
  createdAt: string,
  kind: "agent_run" | "loop_step",
  agentRunId?: string
): ExecutionSpec => ({
  version: 1, projectId: PROJECT_ID, taskId, kind, rootRunId, agentRunId,
  agent: { id: agentId, name: agentId, description: `${agentId} agent`, instructions: `Immutable ${agentId} instructions.`, skillIds: [], configHash: "a".repeat(64) },
  runtime: { deviceId: "device", deviceName: "Mac", runtimeBackendId: "backend", provider: "codex", cliVersion: "1.0.0", model: "gpt-5", reasoning: "high", policy: { network: false, readOnlyRoots: [] }, capabilityHash: "b".repeat(64) },
  project: { checkoutId: "checkout", repositoryUrl: "https://github.com/acme/ballet.git", headSha: "c".repeat(40), configHash: "c".repeat(64), snapshotHash: "c".repeat(64) },
  createdAt
});

const appData = (): AppData => ({
  projects: [], goals: [], adrs: [], skills: [], policies: [], eventDefinitions: [], events: [], loopRuns: [], scheduleStates: [],
  agents: ["developer", "publisher"].map((id) => ({
    id, name: id, description: `${id} agent`, instructions: `${id} instructions`, skills: [], enabled: true,
    createdAt: "2026-07-11T08:00:00.000Z", updatedAt: "2026-07-11T08:00:00.000Z"
  })),
  automation: { version: 6, loops: [DELIVERY, RELEASE] },
  automationIssues: [],
  loopThemes: [...builtInLoopThemes],
  loopThemeIssues: []
});
