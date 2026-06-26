import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent, EventDefinition } from "../shared/domain.js";
import type { ContractDefinition } from "../shared/contracts.js";
import type { AgentOperation } from "../shared/operations.js";
import type { RoutingPolicy } from "../shared/routing-policy.js";
import { RuntimeDatabase, isPatchedSqliteVersion, operationDefinitionHash } from "../runtime-db.js";
import { routingPolicyVersion } from "../routing-engine.js";

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

const at = "2026-06-24T08:00:00.000Z";

const contract = (id: string, kind: ContractDefinition["kind"], schema: Record<string, unknown>): ContractDefinition => ({
  id,
  version: 1,
  name: id,
  description: id,
  kind,
  active: true,
  schema,
  examples: [],
  createdAt: at,
  updatedAt: at
});

const looseInputSchema = {
  type: "object",
  additionalProperties: true
};

const agentOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "summary"],
  properties: {
    status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
    summary: { type: "string" },
    result: { type: "object", additionalProperties: true },
    evidence: { type: "object", additionalProperties: true }
  }
};

const contracts = [
  contract("plan-approved-data", "event-data", looseInputSchema),
  contract("change-implemented-data", "event-data", looseInputSchema),
  contract("developer-input", "agent-input", looseInputSchema),
  contract("review-input", "agent-input", looseInputSchema),
  contract("agent-output", "agent-output", agentOutputSchema)
];

const changeImplementedEvent: EventDefinition = {
  id: "change-implemented",
  name: "Change implemented",
  description: "A change was implemented.",
  active: true,
  eventType: "change.implemented.v1",
  tags: [],
  dataContract: { id: "change-implemented-data", version: 1 },
  examples: [],
  createdAt: at,
  updatedAt: at
};

const developerOperation: AgentOperation = {
  id: "developer-agent/implement-change",
  version: 1,
  name: "Implement change",
  description: "Implement an approved plan.",
  active: true,
  agentId: "developer-agent",
  instructions: "Implement the mapped change.",
  inputContract: { id: "developer-input", version: 1 },
  outputContract: { id: "agent-output", version: 1 },
  emissionRequired: false,
  createdAt: at,
  updatedAt: at
};

const architectureOperation: AgentOperation = {
  ...developerOperation,
  id: "architecture-reviewer/review-change",
  name: "Review architecture",
  agentId: "architecture-reviewer",
  inputContract: { id: "review-input", version: 1 }
};

const qaOperation: AgentOperation = {
  ...architectureOperation,
  id: "qa-verification-reviewer/verify-change",
  name: "Verify QA",
  agentId: "qa-verification-reviewer"
};

const policy: RoutingPolicy = {
  id: "on_plan_approved_then_start_developer_agent_run",
  name: "on_plan_approved_then_start_developer_agent_run",
  description: "Start development when a plan is approved.",
  active: true,
  consumes: { eventType: "plan.approved.v1" },
  dispatch: { operation: { id: "developer-agent/implement-change", version: 1 } },
  input: {
    object: {
      workItemId: { from: "/event/subject" },
      goal: { from: "/event/data/goal", default: "No goal supplied" }
    }
  },
  createdAt: at,
  updatedAt: at
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

const architectureReviewPolicy: RoutingPolicy = {
  id: "on_change_implemented_then_start_architecture_reviewer_agent_run",
  name: "on_change_implemented_then_start_architecture_reviewer_agent_run",
  description: "Route implemented change facts to architecture review.",
  active: true,
  consumes: { eventType: "change.implemented.v1" },
  dispatch: { operation: { id: "architecture-reviewer/review-change", version: 1 } },
  input: {
    object: {
      summary: { from: "/event/data/summary", default: "" },
      gitSha: { from: "/event/data/artifacts/git_sha", default: "" }
    }
  },
  createdAt: at,
  updatedAt: at
};

const qaReviewPolicy: RoutingPolicy = {
  ...architectureReviewPolicy,
  id: "on_change_implemented_then_start_qa_verification_reviewer_agent_run",
  name: "on_change_implemented_then_start_qa_verification_reviewer_agent_run",
  dispatch: { operation: { id: "qa-verification-reviewer/verify-change", version: 1 } }
};

const runtimeDefinitions = (
  routingPolicies: RoutingPolicy[],
  agents: Agent[],
  operations: AgentOperation[] = [developerOperation, architectureOperation, qaOperation]
) => ({
  agents,
  contracts,
  operations,
  routingPolicies,
  emissionPolicies: [],
  eventDefinitions: [],
  loopDefinitions: []
});

const readyOutcome = {
  outcome: "ready",
  summary: "Change is implemented.",
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

  it("migrates a pre-operation agent_runs table before creating new indexes", async () => {
    const root = await tempRoot();
    const dbPath = path.join(root, "runtime.sqlite");
    const legacy = new Database(dbPath);
    legacy.exec(`
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
        completed_at TEXT
      );
    `);
    legacy.close();

    const db = new RuntimeDatabase(dbPath);
    expect(() => db.listRuns()).not.toThrow();
    db.close();

    const migrated = new Database(dbPath, { readonly: true });
    const columns = new Set((migrated.prepare("PRAGMA table_info(agent_runs)").all() as Array<{ name: string }>).map((column) => column.name));
    expect(columns.has("operation_id")).toBe(true);
    expect(columns.has("operation_version")).toBe(true);
    expect(columns.has("correlation_id")).toBe(true);
    expect(columns.has("loop_instance_id")).toBe(true);

    const indexes = new Set((migrated.prepare("PRAGMA index_list(agent_runs)").all() as Array<{ name: string }>).map((index) => index.name));
    expect(indexes.has("idx_agent_runs_operation")).toBe(true);
    expect(indexes.has("idx_agent_runs_correlation")).toBe(true);
    expect(indexes.has("idx_agent_runs_loop_instance")).toBe(true);
    migrated.close();
  });

  it("writes an intake event and queues one deduplicated agent run", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));

    const result = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      tags: ["delivery"],
      payload: { work_item_id: "work-1" }
    }, runtimeDefinitions([policy], [agent]));

    expect(result.event.status).toBe("routed");
    expect(result.event.subject).toBe("work-1");
    expect(result.run).toMatchObject({
      policyId: "on_plan_approved_then_start_developer_agent_run",
      policyVersion: routingPolicyVersion(policy),
      agentRole: "developer-agent",
      operationId: "developer-agent/implement-change",
      inputJson: { workItemId: "work-1", goal: "No goal supplied" },
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
      eventType: "change.implemented.v1",
      source: "agentd",
      subject: "work-1",
      payload: { artifacts: { git_sha: "4f28dbd" } }
    }, runtimeDefinitions([qaReviewPolicy, architectureReviewPolicy], [agent, architectureAgent, qaAgent]));

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
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      tags: ["delivery"],
      payload: {}
    }, runtimeDefinitions([policy], [agent]));

    const leased = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    expect(leased).toMatchObject({ status: "running", attempt: 1 });

    const completed = db.completeRun({
      runId: leased!.runId,
      status: "completed",
      outcome: readyOutcome,
      domainEvent: {
        type: "change.implemented.v1",
        payload: { outcome: readyOutcome.outcome, summary: readyOutcome.summary }
      },
      definitions: {
        ...runtimeDefinitions([], []),
        eventDefinitions: [changeImplementedEvent]
      }
    });

    expect(completed.run.status).toBe("completed");
    expect(completed.event?.type).toBe("change.implemented.v1");
    expect(db.listRuntimeEvents()).toHaveLength(2);

    expect(() => db.retryRun(leased!.runId)).toThrow("cannot be retried");
    db.close();
  });

  it("fails completed domain-event publication when runtime definitions are missing", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      payload: {}
    }, runtimeDefinitions([policy], [agent]));

    const leased = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    const completed = db.completeRun({
      runId: leased!.runId,
      status: "completed",
      outcome: readyOutcome,
      domainEvent: {
        type: "change.implemented.v1",
        payload: { outcome: readyOutcome.outcome, summary: readyOutcome.summary }
      },
      definitions: runtimeDefinitions([], [])
    });

    expect(completed.event).toBeUndefined();
    expect(completed.run.status).toBe("failed");
    expect(completed.run.error).toBe("Runtime definitions are required to publish change.implemented.v1.");
    expect(db.listRuntimeEvents()).toHaveLength(1);
    expect(db.listRunLogs(leased!.runId)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        message: "Domain event publication failed.",
        data: expect.objectContaining({
          event_type: "change.implemented.v1",
          error: "Runtime definitions are required to publish change.implemented.v1."
        })
      })
    ]));
    db.close();
  });

  it("projects a completed developer outcome back through review policies", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const intake = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      payload: {}
    }, runtimeDefinitions([policy, architectureReviewPolicy, qaReviewPolicy], [agent, architectureAgent, qaAgent]));

    const leased = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    const completed = db.completeRun({
      runId: leased!.runId,
      status: "completed",
      outcome: readyOutcome,
      domainEvent: {
        type: "change.implemented.v1",
        payload: { outcome: readyOutcome.outcome, summary: readyOutcome.summary }
      },
      definitions: {
        ...runtimeDefinitions([policy, architectureReviewPolicy, qaReviewPolicy], [agent, architectureAgent, qaAgent]),
        eventDefinitions: [changeImplementedEvent]
      }
    });

    expect(completed.run.status).toBe("completed");
    expect(completed.event).toMatchObject({
      type: "change.implemented.v1",
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
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      dedupeKey: "external:work-1:plan-approved",
      payload: {}
    };

    const first = db.intakeEvent(input, runtimeDefinitions([policy], [agent]));
    const second = db.intakeEvent(input, runtimeDefinitions([policy], [agent]));

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
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      correlationDepth: 20,
      payload: {}
    }, runtimeDefinitions([policy], [agent]));

    const leased = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    const completed = db.completeRun({
      runId: leased!.runId,
      status: "completed",
      outcome: readyOutcome,
      domainEvent: {
        type: "change.implemented.v1",
        payload: { outcome: readyOutcome.outcome, summary: readyOutcome.summary }
      },
      definitions: runtimeDefinitions([architectureReviewPolicy], [architectureAgent])
    });

    expect(completed.event).toBeUndefined();
    expect(completed.run.status).toBe("failed");
    expect(completed.runs).toEqual([]);
    expect(db.listRuntimeEvents()).toHaveLength(1);
    expect(db.listRunLogs(leased!.runId).some((log) => log.level === "warn" && log.message.includes("correlation depth"))).toBe(true);
    db.close();
  });

  it("fails a completed run atomically when published event data violates its contract", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      payload: {}
    }, runtimeDefinitions([policy], [agent]));

    const leased = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    const strictChangeImplemented = contract("change-implemented-data", "event-data", {
      type: "object",
      additionalProperties: false,
      required: ["summary"],
      properties: {
        summary: { type: "string" }
      }
    });
    const completed = db.completeRun({
      runId: leased!.runId,
      status: "completed",
      outcome: readyOutcome,
      domainEvent: {
        type: "change.implemented.v1",
        payload: { summary: 42 }
      },
      definitions: {
        ...runtimeDefinitions([], []),
        contracts: contracts.map((item) => item.id === "change-implemented-data" ? strictChangeImplemented : item),
        eventDefinitions: [changeImplementedEvent]
      }
    });

    expect(completed.event).toBeUndefined();
    expect(completed.run.status).toBe("failed");
    expect(completed.run.error).toContain("Event data failed contract change-implemented-data@1 validation");
    expect(db.listRuntimeEvents()).toHaveLength(1);
    expect(db.listRunLogs(leased!.runId)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        message: "Domain event publication failed.",
        data: expect.objectContaining({
          event_type: "change.implemented.v1",
          error: expect.stringContaining("Event data failed contract change-implemented-data@1 validation")
        })
      })
    ]));
    db.close();
  });

  it("does not commit earlier downstream events when a later publication fails contract validation", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      payload: {}
    }, runtimeDefinitions([policy], [agent]));

    const leased = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    const reviewData = contract("review-data", "event-data", {
      type: "object",
      additionalProperties: false,
      required: ["approved"],
      properties: {
        approved: { type: "boolean" }
      }
    });
    const reviewEvent = {
      ...changeImplementedEvent,
      id: "review-approved",
      name: "Review approved",
      eventType: "review.approved.v1",
      dataContract: { id: "review-data", version: 1 }
    };

    const completed = db.completeRun({
      runId: leased!.runId,
      status: "completed",
      outcome: readyOutcome,
      domainEvents: [
        {
          type: "change.implemented.v1",
          payload: { summary: "Valid first event." }
        },
        {
          type: "review.approved.v1",
          payload: { approved: "yes" }
        }
      ],
      definitions: {
        ...runtimeDefinitions([], []),
        contracts: [...contracts, reviewData],
        eventDefinitions: [changeImplementedEvent, reviewEvent]
      }
    });

    expect(completed.event).toBeUndefined();
    expect(completed.runs).toEqual([]);
    expect(completed.run.status).toBe("failed");
    expect(completed.run.error).toContain("Event data failed contract review-data@1 validation");
    expect(db.listRuntimeEvents()).toHaveLength(1);
    expect(db.listRuntimeEvents()[0]?.type).toBe("plan.approved.v1");
    expect(db.listRunLogs(leased!.runId)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        message: "Domain event publication failed.",
        data: expect.objectContaining({
          event_type: "review.approved.v1",
          error: expect.stringContaining("Event data failed contract review-data@1 validation")
        })
      })
    ]));
    db.close();
  });

  it("clears stale current-attempt state when retrying a run", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      payload: {}
    }, runtimeDefinitions([policy], [agent]));

    const leased = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    db.completeRun({
      runId: leased!.runId,
      status: "failed",
      output: false,
      outputContractId: "agent-output",
      outputContractVersion: 1,
      outputContractHash: "stale",
      outputValidationErrors: [{
        instancePath: "/summary",
        schemaPath: "#/properties/summary/type",
        message: "must be string",
        keyword: "type"
      }],
      emissionDecisions: [{ status: "failed" }],
      error: "boom"
    });

    const retried = db.retryRun(leased!.runId);
    const retryLog = db.listRunLogs(leased!.runId).find((log) => log.message.includes("retry"));
    const priorAttempt = retryLog?.data?.prior_attempt as Record<string, unknown> | undefined;
    expect(retried).toMatchObject({
      status: "queued",
      outputJson: undefined,
      outputContractId: undefined,
      outputContractVersion: undefined,
      outputContractHash: undefined,
      outputValidationErrorsJson: undefined,
      emissionDecisionsJson: undefined,
      error: undefined
    });
    expect(priorAttempt).toMatchObject({
      previous_status: "failed",
      previous_attempt: 1,
      output_json: false,
      output_contract: { id: "agent-output", version: 1, hash: "stale" },
      output_validation_errors: [{
        instancePath: "/summary",
        schemaPath: "#/properties/summary/type",
        message: "must be string",
        keyword: "type"
      }],
      emission_decisions: [{ status: "failed" }],
      completion_error: "boom",
      cleared_state: {
        output: true,
        output_contract: true,
        output_validation_errors: true,
        emission_decisions: true,
        completion_error: true
      }
    });
    db.close();
  });

  it("persists structured output validation errors on failed runs", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      payload: {}
    }, runtimeDefinitions([policy], [agent]));

    const leased = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    const completed = db.completeRun({
      runId: leased!.runId,
      status: "failed",
      output: { status: "completed" },
      outputContractId: "agent-output",
      outputContractVersion: 1,
      outputContractHash: "hash",
      outputValidationErrors: [{
        instancePath: "",
        schemaPath: "#/required",
        message: "must have required property 'summary'",
        keyword: "required"
      }],
      error: "Agent output failed contract agent-output@1 validation."
    });

    expect(completed.run.outputValidationErrorsJson).toEqual([{
      instancePath: "",
      schemaPath: "#/required",
      message: "must have required property 'summary'",
      keyword: "required"
    }]);
    expect(db.getRun(leased!.runId)?.outputValidationErrorsJson).toEqual(completed.run.outputValidationErrorsJson);
    db.close();
  });

  it("binds reusable threads by work item, agent, operation, and version", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    db.upsertThreadBinding("work-1", "developer-agent", "thread-legacy");
    db.upsertThreadBinding("work-1", "developer-agent", "thread-implement", "developer-agent/implement-change", 1);
    db.upsertThreadBinding("work-1", "developer-agent", "thread-review", "architecture-reviewer/review-change", 1);

    expect(db.getThreadBinding("work-1", "developer-agent", "developer-agent/implement-change", 1)).toBe("thread-implement");
    expect(db.getThreadBinding("work-1", "developer-agent", "architecture-reviewer/review-change", 1)).toBe("thread-review");
    expect(db.getThreadBinding("work-1", "developer-agent", "qa-verification-reviewer/verify-change", 1)).toBeUndefined();
    expect(db.getThreadBinding("work-1", "developer-agent")).toBe("thread-legacy");
    db.close();
  });

  it("persists falsy JSON output and outcome values with operation snapshots", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      payload: {}
    }, runtimeDefinitions([policy], [agent]));

    const leased = db.leaseNextRun({ owner: "test-worker", leaseSeconds: 60 });
    expect(leased?.operationHash).toBe(operationDefinitionHash(developerOperation));
    expect(leased?.outputContractHash).toBeTruthy();
    const completed = db.completeRun({
      runId: leased!.runId,
      status: "failed",
      output: false,
      outcome: false,
      error: "failed"
    });

    expect(completed.run.outputJson).toBe(false);

    const retried = db.retryRun(leased!.runId);
    const completedWithNull = db.completeRun({
      runId: retried.runId,
      status: "failed",
      output: null,
      outcome: null,
      error: "failed again"
    });

    expect(completed.run.outcome).toBe(false);
    expect(completedWithNull.run.outputJson).toBeNull();
    expect(completedWithNull.run.outcome).toBeNull();
    db.close();
  });
});
