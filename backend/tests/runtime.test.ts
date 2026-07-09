import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import type { AgentOutcome } from "../../shared/domain/runtime.js";
import { actionRouteId } from "../../shared/policy-actions.js";
import { outcomeToOutputEventStatus } from "../agentd.js";
import { mapAgentOutputToEvent } from "../automation.js";
import { RuntimeDatabase, isPatchedSqliteVersion } from "../runtime-db.js";
import { parseAgentOutcomeText } from "../runtime-policy.js";

const tempRoots: string[] = [];

const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-runtime-"));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const agent: Agent = {
  id: "developer-agent",
  name: "Developer Agent",
  description: "Implements changes.",
  instructions: "Return structured outcome.",
  skills: [],
  enabled: true,
  status: "offline",
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

const qaAgent: Agent = {
  ...agent,
  id: "qa-verification-reviewer",
  name: "QA Verification Reviewer",
  description: "Reviews verification evidence."
};

const readyOutcome: AgentOutcome = {
  outcome: "ready",
  summary: "Change is implemented.",
  artifacts: {
    git_sha: "4f28dbd",
    changed_files: ["backend/runtime-db.ts"]
  },
  checks: [{ name: "unit-tests", status: "passed" }]
};

const loopId = "plan-approved.loop";
const implementationAction = {
  id: "implementation",
  description: "Implement approved work.",
  outputIds: ["approved", "rejected"],
  agentIds: ["developer-agent"]
};
const qaAction = {
  id: "qa-review",
  description: "Review implementation.",
  outputIds: ["approved", "rejected"],
  agentIds: ["qa-verification-reviewer"]
};
const automationConfig = (patch: Partial<ProjectAutomationConfig> = {}): ProjectAutomationConfig => ({
  version: 1,
  actions: [implementationAction, qaAction],
  outputs: [{ id: "approved" }, { id: "rejected" }],
  outputRoutes: [{
    sourceLoopId: loopId,
    sourceActionId: "implementation",
    outputId: "approved",
    targetLoopId: loopId,
    targetActionId: "qa-review"
  }],
  humanGateResponses: [],
  loops: [{ id: loopId, steps: ["implementation", "qa-review"] }],
  runtimes: [],
  ...patch
});

describe("runtime database", () => {
  it("accepts SQLite versions with the WAL-reset fix", () => {
    expect(isPatchedSqliteVersion("3.51.3")).toBe(true);
    expect(isPatchedSqliteVersion("3.50.7")).toBe(true);
    expect(isPatchedSqliteVersion("3.44.6")).toBe(true);
    expect(isPatchedSqliteVersion("3.51.2")).toBe(false);
  });

  it("writes an intake event and queues deduplicated action runs", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));

    const result = db.intakeEvent({
      projectId: "project",
      eventType: "plan-approved",
      source: "test",
      tags: ["delivery"],
      payload: { work_item_id: "work-1" }
    }, automationConfig({
      actions: [{ ...implementationAction, agentIds: ["developer-agent"] }],
      outputRoutes: [],
      loops: [{ id: loopId, steps: ["implementation"] }]
    }), [agent]);

    expect(result.event.status).toBe("routed");
    expect(result.event.subject).toBe("work-1");
    expect(result.run).toMatchObject({
      actionId: "implementation",
      loopId,
      routeId: actionRouteId(loopId, "implementation"),
      actionVersion: 1,
      agentRole: "developer-agent",
      status: "queued"
    });
    expect(result.runs).toHaveLength(1);
    expect(db.listRuntimeEvents()).toHaveLength(1);
    expect(db.listRuns()).toHaveLength(1);
    db.close();
  });

  it("routes one event to the single agent on the matching action", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));

    const result = db.intakeEvent({
      projectId: "project",
      eventType: "plan-approved",
      source: "test",
      subject: "work-1",
      payload: {}
    }, automationConfig(), [agent, qaAgent]);

    expect(result.event.status).toBe("routed");
    expect(result.event.routing).toMatchObject({
      matchedActions: 1,
      routedRuns: 1,
      skippedActions: 0
    });
    expect(result.runs.map((run) => run.agentRole)).toEqual(["developer-agent"]);
    expect(db.listRuns()).toHaveLength(1);
    db.close();
  });

  it("publishes action output when the single action run finishes", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const config = automationConfig();
    const intake = db.intakeEvent({
      projectId: "project",
      eventType: "plan-approved",
      source: "test",
      subject: "work-1",
      payload: {}
    }, config, [agent, qaAgent]);

    expect(intake.runs.map((run) => run.agentRole)).toEqual(["developer-agent"]);

    const first = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    const firstCompletion = db.completeRun({
      runId: first!.runId,
      status: "completed",
      outcome: readyOutcome,
      projectAction: implementationAction,
      actions: config.actions,
      outputs: config.outputs,
      outputRoutes: config.outputRoutes,
      loops: config.loops,
      automation: config,
      agents: [agent, qaAgent]
    });

    expect(firstCompletion.event).toMatchObject({
      type: "plan-approved.loop.implementation.approved",
      source: "agentd",
      correlationId: intake.event.correlationId,
      causationId: intake.event.eventId,
      status: "routed",
      payload: {
        action: "implementation",
        loop_id: loopId,
        status: "approved",
        agents: expect.arrayContaining([
          expect.objectContaining({ agent: "developer-agent", status: "completed", outcome: "ready" })
        ])
      }
    });
    expect(firstCompletion.runs?.map((run) => run.agentRole)).toEqual(["qa-verification-reviewer"]);
    expect(db.listRuntimeEvents()).toHaveLength(2);
    db.close();
  });

  it("deduplicates event publication by dedupe key", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const input = {
      projectId: "project",
      eventType: "plan-approved",
      source: "test",
      subject: "work-1",
      dedupeKey: "external:work-1:plan-approved",
      payload: {}
    };

    const config = automationConfig({
      actions: [{ ...implementationAction, agentIds: ["developer-agent"] }],
      outputRoutes: [],
      loops: [{ id: loopId, steps: ["implementation"] }]
    });
    const first = db.intakeEvent(input, config, [agent]);
    const second = db.intakeEvent(input, config, [agent]);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.event.eventId).toBe(first.event.eventId);
    expect(db.listRuntimeEvents()).toHaveLength(1);
    expect(db.listRuns()).toHaveLength(1);
    db.close();
  });

  it("stops chained publication when correlation depth exceeds the limit", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const config = automationConfig({
      actions: [{ ...implementationAction, agentIds: ["developer-agent"] }],
      outputRoutes: [],
      loops: [{ id: loopId, steps: ["implementation"] }]
    });
    db.intakeEvent({
      projectId: "project",
      eventType: "plan-approved",
      source: "test",
      subject: "work-1",
      correlationDepth: 20,
      payload: {}
    }, config, [agent]);

    const leased = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    const completed = db.completeRun({
      runId: leased!.runId,
      status: "completed",
      outcome: readyOutcome,
      projectAction: implementationAction,
      actions: config.actions,
      outputs: config.outputs,
      outputRoutes: config.outputRoutes,
      loops: config.loops,
      automation: config,
      agents: [agent]
    });

    expect(completed.event).toBeUndefined();
    expect(completed.runs).toEqual([]);
    expect(db.listRuntimeEvents()).toHaveLength(1);
    expect(db.listRunLogs(leased!.runId).some((log) => log.level === "warn" && log.message.includes("correlation depth"))).toBe(true);
    db.close();
  });
});

describe("runtime output mapping", () => {
  it("validates structured agent outcome JSON", () => {
    expect(parseAgentOutcomeText(JSON.stringify(readyOutcome))).toEqual(readyOutcome);
    expect(() => parseAgentOutcomeText("{bad json")).toThrow("not valid JSON");
  });

  it("maps agent output statuses through action output events", () => {
    expect(mapAgentOutputToEvent(implementationAction, { status: "complete", loopId }, [], [implementationAction]).id).toBe("plan-approved.loop.implementation.approved");
    expect(mapAgentOutputToEvent(implementationAction, { status: "failed", loopId }, [], [implementationAction]).id).toBe("plan-approved.loop.implementation.rejected");
    expect(mapAgentOutputToEvent(
      { id: "human-review", description: "Human review", outputIds: ["approved", "rejected"], agentIds: [], humanGate: true },
      { status: "approved", loopId },
      [],
      [{ id: "human-review", description: "Human review", outputIds: ["approved", "rejected"], agentIds: [], humanGate: true }]
    ).id).toBe("plan-approved.loop.human-review.approved");
  });

  it("maps structured outcomes to configured action outputs", () => {
    expect(outcomeToOutputEventStatus(
      readyOutcome,
      implementationAction,
      [{ ...implementationAction, outputIds: ["done", "needs-clarification"] }]
    )).toBe("approved");
    expect(outcomeToOutputEventStatus(
      { ...readyOutcome, outcome: "changes-requested" },
      { ...implementationAction, id: "review" },
      [{ ...implementationAction, id: "review", outputIds: ["accepted", "reject"] }]
    )).toBe("rejected");
    expect(outcomeToOutputEventStatus(
      { ...readyOutcome, outcome: "changes-requested" },
      { ...implementationAction, id: "create-roadmap" },
      [{ ...implementationAction, id: "create-roadmap", outputIds: ["roadmap_ready"] }]
    )).toBeUndefined();
  });

  it("does not require an event id in agent output", () => {
    const routed = mapAgentOutputToEvent(implementationAction, {
      runId: "run-1",
      inputEventId: "event-1",
      actionId: implementationAction.id,
      loopId,
      actionVersion: 123,
      status: "complete",
      outcome: "ready",
      summary: "Done."
    }, []);

    expect(routed).toMatchObject({
      id: "plan-approved.loop.implementation.approved",
      source: "agentd",
      payload: {
        action: "implementation",
        status: "approved",
        outcome: "ready",
        summary: "Done.",
        run_id: "run-1",
        input_event_id: "event-1",
        action_id: implementationAction.id,
        loop_id: loopId,
        action_version: 123
      }
    });
  });

  it("migrates legacy trigger event run columns to input event columns", async () => {
    const root = await tempRoot();
    const dbPath = path.join(root, "runtime.sqlite");
    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        subject TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        causation_id TEXT,
        occurred_at TEXT NOT NULL,
        project_id TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'received',
        matched_policy_id TEXT,
        assigned_agent_id TEXT,
        handling_result TEXT,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE agent_runs (
        run_id TEXT PRIMARY KEY,
        trigger_event_id TEXT NOT NULL,
        trigger_event_seq INTEGER,
        policy_id TEXT NOT NULL,
        policy_version INTEGER NOT NULL,
        agent_role TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt INTEGER NOT NULL DEFAULT 0,
        lease_owner TEXT,
        lease_until TEXT,
        thread_id TEXT,
        turn_id TEXT,
        outcome_json TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        UNIQUE(trigger_event_id, policy_id, policy_version, agent_role),
        FOREIGN KEY(trigger_event_seq) REFERENCES events(seq) ON DELETE SET NULL
      );
      CREATE INDEX idx_agent_runs_trigger ON agent_runs(trigger_event_id);
      INSERT INTO events (
        event_id, type, source, subject, correlation_id, occurred_at, project_id, tags_json, payload_json
      ) VALUES (
        'event-1', 'plan-approved', 'test', 'work-1', 'event-1', '2026-07-07T10:00:00.000Z', 'project', '[]', '{}'
      );
      INSERT INTO agent_runs (
        run_id, trigger_event_id, trigger_event_seq, policy_id, policy_version, agent_role, status,
        attempt, created_at, updated_at
      ) VALUES (
        'run-1', 'event-1', 1, 'plan-approved.loop:implementation', 1, 'developer-agent', 'queued',
        0, '2026-07-07T10:00:00.000Z', '2026-07-07T10:00:00.000Z'
      );
    `);
    legacy.close();

    const runtime = new RuntimeDatabase(dbPath);
    const columns = new Set((runtime.connection().prepare("PRAGMA table_info(agent_runs)").all() as Array<{ name: string }>).map((column) => column.name));
    expect(columns.has("input_event_id")).toBe(true);
    expect(columns.has("input_event_seq")).toBe(true);
    expect(columns.has("trigger_event_id")).toBe(false);
    expect(columns.has("trigger_event_seq")).toBe(false);
    expect(runtime.listRuns()[0]).toMatchObject({
      runId: "run-1",
      inputEventId: "event-1",
      inputEventSeq: 1,
      loopId,
      actionId: "implementation"
    });
    expect(runtime.getInputEvent(runtime.listRuns()[0]!)).toMatchObject({ eventId: "event-1" });
    runtime.close();
  });
});
