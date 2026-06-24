import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent, AgentOutcome, Policy } from "../shared/domain.js";
import { RuntimeDatabase, isPatchedSqliteVersion } from "../runtime-db.js";
import { checksPassRequiredGate, mapOutcomeToDomainEvent, parseAgentOutcomeText } from "../runtime-policy.js";
import { policyVersion } from "../shared/policy.js";

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

const policy: Policy = {
  id: "policy-implementation-review",
  name: "Implementation review",
  description: "Route implementation work.",
  active: true,
  projectId: "project",
  eventTypes: ["implementation.requested.v1"],
  source: "*",
  payloadMetadata: {},
  targetAgentId: "developer-agent",
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

const architectureAgent: Agent = {
  ...agent,
  id: "architecture-reviewer",
  name: "Architecture Reviewer",
  description: "Reviews architecture."
};

const qaAgent: Agent = {
  ...agent,
  id: "qa-verification-reviewer",
  name: "QA Verification Reviewer",
  description: "Reviews verification evidence."
};

const architectureReviewPolicy: Policy = {
  id: "policy-architecture-review",
  name: "Architecture review",
  description: "Route ready implementations to architecture review.",
  active: true,
  match: {
    eventTypes: ["implementation.ready.v1"],
    source: "agentd"
  },
  action: {
    type: "start_agent_run",
    targetAgentId: "architecture-reviewer"
  },
  projectId: "*",
  eventTypes: ["implementation.ready.v1"],
  source: "*",
  payloadMetadata: {},
  targetAgentId: "architecture-reviewer",
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

const qaReviewPolicy: Policy = {
  ...architectureReviewPolicy,
  id: "policy-qa-review",
  name: "QA review",
  action: {
    type: "start_agent_run",
    targetAgentId: "qa-verification-reviewer"
  },
  targetAgentId: "qa-verification-reviewer"
};

const readyOutcome: AgentOutcome = {
  outcome: "ready",
  summary: "Implementation is ready.",
  artifacts: {
    git_sha: "4f28dbd",
    changed_files: ["backend/runtime-db.ts"]
  },
  checks: [{ name: "unit-tests", status: "passed" }]
};

describe("runtime database", () => {
  it("accepts SQLite versions with the WAL-reset fix", () => {
    expect(isPatchedSqliteVersion("3.51.3")).toBe(true);
    expect(isPatchedSqliteVersion("3.50.7")).toBe(true);
    expect(isPatchedSqliteVersion("3.44.6")).toBe(true);
    expect(isPatchedSqliteVersion("3.51.2")).toBe(false);
  });

  it("writes an intake event and queues one deduplicated agent run", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));

    const result = db.intakeEvent({
      projectId: "project",
      eventType: "implementation.requested.v1",
      source: "test",
      tags: ["delivery"],
      payload: { work_item_id: "work-1" }
    }, [policy], [agent]);

    expect(result.event.status).toBe("routed");
    expect(result.event.subject).toBe("work-1");
    expect(result.run).toMatchObject({
      policyId: "policy-implementation-review",
      policyVersion: policyVersion(policy),
      agentRole: "developer-agent",
      status: "queued"
    });
    expect(result.runs).toHaveLength(1);
    expect(db.listRuntimeEvents()).toHaveLength(1);
    expect(db.listRuns()).toHaveLength(1);
    db.close();
  });

  it("fans one event out to every matching enabled policy", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));

    const result = db.intakeEvent({
      projectId: "project",
      eventType: "implementation.ready.v1",
      source: "agentd",
      subject: "work-1",
      payload: { artifacts: { git_sha: "4f28dbd" } }
    }, [qaReviewPolicy, architectureReviewPolicy], [agent, architectureAgent, qaAgent]);

    expect(result.event.status).toBe("routed");
    expect(result.event.routing).toMatchObject({
      matchedPolicies: 2,
      routedRuns: 2,
      skippedPolicies: 0
    });
    expect(result.runs.map((run) => run.agentRole).sort()).toEqual(["architecture-reviewer", "qa-verification-reviewer"]);
    expect(db.listRuns()).toHaveLength(2);
    db.close();
  });

  it("leases, retries, and completes a run with a domain event atomically", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    db.intakeEvent({
      projectId: "project",
      eventType: "implementation.requested.v1",
      source: "test",
      subject: "work-1",
      tags: ["delivery"],
      payload: {}
    }, [policy], [agent]);

    const leased = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    expect(leased).toMatchObject({ status: "running", attempt: 1 });

    const completed = db.completeRun({
      runId: leased!.runId,
      status: "completed",
      outcome: readyOutcome,
      domainEvent: {
        type: "implementation.ready.v1",
        payload: { outcome: readyOutcome.outcome, summary: readyOutcome.summary }
      }
    });

    expect(completed.run.status).toBe("completed");
    expect(completed.event?.type).toBe("implementation.ready.v1");
    expect(db.listRuntimeEvents()).toHaveLength(2);

    expect(() => db.retryRun(leased!.runId)).toThrow("cannot be retried");
    db.close();
  });

  it("projects a completed developer outcome back through review policies", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const intake = db.intakeEvent({
      projectId: "project",
      eventType: "implementation.requested.v1",
      source: "test",
      subject: "work-1",
      payload: {}
    }, [policy, architectureReviewPolicy, qaReviewPolicy], [agent, architectureAgent, qaAgent]);

    const leased = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    const completed = db.completeRun({
      runId: leased!.runId,
      status: "completed",
      outcome: readyOutcome,
      domainEvent: {
        type: "implementation.ready.v1",
        payload: { outcome: readyOutcome.outcome, summary: readyOutcome.summary }
      },
      policies: [policy, architectureReviewPolicy, qaReviewPolicy],
      agents: [agent, architectureAgent, qaAgent]
    });

    expect(completed.run.status).toBe("completed");
    expect(completed.event).toMatchObject({
      type: "implementation.ready.v1",
      correlationId: intake.event.correlationId,
      causationId: intake.event.eventId,
      correlationDepth: 1,
      status: "routed"
    });
    expect(completed.runs?.map((run) => run.agentRole).sort()).toEqual(["architecture-reviewer", "qa-verification-reviewer"]);
    expect(db.listRuntimeEvents()).toHaveLength(2);
    expect(db.listRuns()).toHaveLength(3);
    db.close();
  });

  it("deduplicates event publication by dedupe key", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const input = {
      projectId: "project",
      eventType: "implementation.requested.v1",
      source: "test",
      subject: "work-1",
      dedupeKey: "external:work-1:implementation-requested",
      payload: {}
    };

    const first = db.intakeEvent(input, [policy], [agent]);
    const second = db.intakeEvent(input, [policy], [agent]);

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
    db.intakeEvent({
      projectId: "project",
      eventType: "implementation.requested.v1",
      source: "test",
      subject: "work-1",
      correlationDepth: 20,
      payload: {}
    }, [policy], [agent]);

    const leased = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    const completed = db.completeRun({
      runId: leased!.runId,
      status: "completed",
      outcome: readyOutcome,
      domainEvent: {
        type: "implementation.ready.v1",
        payload: { outcome: readyOutcome.outcome, summary: readyOutcome.summary }
      },
      policies: [architectureReviewPolicy],
      agents: [architectureAgent]
    });

    expect(completed.event).toBeUndefined();
    expect(completed.runs).toEqual([]);
    expect(db.listRuntimeEvents()).toHaveLength(1);
    expect(db.listRunLogs(leased!.runId).some((log) => log.level === "warn" && log.message.includes("correlation depth"))).toBe(true);
    db.close();
  });
});

describe("runtime outcome policy", () => {
  it("validates structured agent outcome JSON", () => {
    expect(parseAgentOutcomeText(JSON.stringify(readyOutcome))).toEqual(readyOutcome);
    expect(() => parseAgentOutcomeText("{bad json")).toThrow("not valid JSON");
  });

  it("maps developer ready outcomes only after deterministic validation", () => {
    expect(checksPassRequiredGate(readyOutcome.checks)).toBe(true);
    expect(mapOutcomeToDomainEvent("developer-agent", readyOutcome, {
      gitCommitExists: false,
      requiredChecksPassed: true
    })).toBeUndefined();
    expect(mapOutcomeToDomainEvent("developer-agent", readyOutcome, {
      gitCommitExists: true,
      requiredChecksPassed: true
    })?.type).toBe("implementation.ready.v1");
  });

  it("prevents reviewer roles from producing implementation events", () => {
    const mapping = mapOutcomeToDomainEvent("architecture-reviewer", {
      outcome: "approved",
      summary: "Looks good.",
      checks: [{ name: "review", status: "passed" }]
    }, {
      gitCommitExists: true,
      requiredChecksPassed: true
    });

    expect(mapping?.type).toBe("review.approved.v1");
  });
});
