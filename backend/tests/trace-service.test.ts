import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TraceService } from "../trace-service.js";
import { RuntimeDatabase, type RuntimeDefinitions } from "../runtime-db.js";
import { contractSchemaHash, type ContractDefinition } from "../shared/contracts.js";
import type { Agent } from "../shared/domain.js";
import type { LoopDefinition } from "../shared/loop.js";
import type { AgentOperation } from "../shared/operations.js";
import type { RoutingPolicy } from "../shared/routing-policy.js";

const at = "2026-06-25T08:00:00.000Z";
const tempRoots: string[] = [];

const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-trace-"));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const agent = (id: string, name: string): Agent => ({
  id,
  name,
  description: name,
  instructions: "Return structured output.",
  skills: [],
  enabled: true,
  status: "offline",
  createdAt: at,
  updatedAt: at
});

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

const eventDataSchema = {
  type: "object",
  additionalProperties: true
};

const inputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["workItemId"],
  properties: {
    workItemId: { type: "string" }
  }
};

const outputSchema = {
  type: "object",
  additionalProperties: true,
  required: ["status", "summary"],
  properties: {
    status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
    summary: { type: "string" },
    result: { type: "object", additionalProperties: true },
    evidence: { type: "object", additionalProperties: true }
  }
};

const contracts = [
  contract("plan-approved-data", "event-data", eventDataSchema),
  contract("change-implemented-data", "event-data", eventDataSchema),
  contract("agent-input", "agent-input", inputSchema),
  contract("agent-output", "agent-output", outputSchema)
];

const operation = (id: string, agentId: string, name: string): AgentOperation => ({
  id,
  version: 1,
  name,
  description: name,
  active: true,
  agentId,
  instructions: name,
  inputContract: { id: "agent-input", version: 1 },
  outputContract: { id: "agent-output", version: 1 },
  emissionRequired: true,
  createdAt: at,
  updatedAt: at
});

const implementOperation = operation("developer-agent/implement-change", "developer-agent", "Implement change");
const reviewOperation = operation("reviewer-agent/review-change", "reviewer-agent", "Review change");

const policy = (id: string, eventType: string, target: AgentOperation): RoutingPolicy => ({
  id,
  name: id,
  description: id,
  active: true,
  consumes: { eventType },
  dispatch: { operation: { id: target.id, version: target.version } },
  input: { object: { workItemId: { from: "/event/subject" } } },
  createdAt: at,
  updatedAt: at
});

const definitions: RuntimeDefinitions = {
  agents: [
    agent("developer-agent", "Developer Agent"),
    agent("reviewer-agent", "Reviewer Agent")
  ],
  contracts,
  operations: [implementOperation, reviewOperation],
  routingPolicies: [
    policy("on-plan-approved", "plan.approved.v1", implementOperation),
    policy("on-change-implemented", "change.implemented.v1", reviewOperation)
  ],
  emissionPolicies: [],
  eventDefinitions: [
    {
      id: "plan-approved-v1",
      name: "Plan approved",
      description: "Plan approved.",
      active: true,
      eventType: "plan.approved.v1",
      tags: [],
      dataContract: { id: "plan-approved-data", version: 1 },
      examples: [],
      createdAt: at,
      updatedAt: at
    },
    {
      id: "change-implemented-v1",
      name: "Change implemented",
      description: "Change implemented.",
      active: true,
      eventType: "change.implemented.v1",
      tags: [],
      dataContract: { id: "change-implemented-data", version: 1 },
      examples: [],
      createdAt: at,
      updatedAt: at
    }
  ],
  loopDefinitions: []
};

const deliveryLoop: LoopDefinition = {
  id: "delivery-loop",
  version: 1,
  name: "Delivery loop",
  description: "Coordinates delivery.",
  active: true,
  entryEventTypes: ["plan.approved.v1"],
  terminalEventTypes: ["change.implemented.v1"],
  routingPolicyIds: ["on-plan-approved"],
  emissionPolicyIds: [],
  limits: { maxHops: 10, maxRuns: 10, maxIterationsPerStep: 3 },
  createdAt: at,
  updatedAt: at
};

describe("TraceService", () => {
  it("builds a plain-language run trace across emitted events and downstream queued work", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const intake = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      payload: { goal: "Ship traces" }
    }, definitions);

    const leased = db.leaseNextRun({ owner: "worker-1", leaseSeconds: 60 });
    expect(leased?.runId).toBe(intake.runs[0]?.runId);
    db.appendRunLog(leased!.runId, "info", "Run leased by agentd.", { worker_id: "worker-1" });
    db.completeRun({
      runId: leased!.runId,
      status: "completed",
      output: { status: "completed", summary: "Implemented.", result: {}, evidence: {} },
      outputContractId: "agent-output",
      outputContractVersion: 1,
      outputContractHash: contractSchemaHash(contracts.find((item) => item.id === "agent-output")!),
      emissionDecisions: [{
        emissionPolicyId: "emit-change-implemented",
        emissionPolicyVersion: 1,
        operationId: implementOperation.id,
        operationVersion: implementOperation.version,
        status: "emitted",
        reason: "Completed result published change implemented.",
        gateDecisions: [{ type: "required_value", path: "/output/summary", passed: true, reason: "value_present" }],
        emittedEvents: [{ slot: "implemented", eventType: "change.implemented.v1", dedupeKey: "trace-test" }]
      }],
      domainEvents: [{
        type: "change.implemented.v1",
        subject: "work-1",
        tags: ["delivery"],
        payload: { summary: "Implemented." },
        dedupeKey: "trace-test"
      }],
      definitions
    });

    const trace = new TraceService(db).byRun(leased!.runId);
    const kinds = trace.entries.map((entry) => entry.kind);
    const downstream = trace.entries.find((entry) => entry.title === "Downstream run queued");

    expect(kinds).toContain("event_received");
    expect(kinds).toContain("routing_matched");
    expect(kinds).toContain("input_mapped");
    expect(kinds).toContain("input_validated");
    expect(kinds).toContain("agent_queued");
    expect(kinds).toContain("agent_started");
    expect(kinds).toContain("agent_completed");
    expect(kinds).toContain("emission_evaluated");
    expect(kinds).toContain("gate_passed");
    expect(kinds).toContain("event_emitted");
    expect(downstream).toMatchObject({
      kind: "agent_queued",
      summary: expect.stringContaining(reviewOperation.id)
    });
    expect(trace.entries.map((entry) => entry.at)).toEqual([...trace.entries.map((entry) => entry.at)].sort());
    db.close();
  });

  it("includes terminal emitted events in loop traces even when they queue no downstream run", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const loopDefinitions: RuntimeDefinitions = {
      ...definitions,
      routingPolicies: [definitions.routingPolicies[0]!],
      loopDefinitions: [deliveryLoop]
    };
    const intake = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      payload: { goal: "Ship loop traces" },
      loopDefinitionId: deliveryLoop.id,
      loopDefinitionVersion: deliveryLoop.version
    }, loopDefinitions);

    const leased = db.leaseNextRun({ owner: "worker-1", leaseSeconds: 60 });
    const loopInstanceId = leased?.loopInstanceId;
    expect(loopInstanceId).toBeTruthy();
    db.completeRun({
      runId: leased!.runId,
      status: "completed",
      output: { status: "completed", summary: "Implemented.", result: {}, evidence: {} },
      outputContractId: "agent-output",
      outputContractVersion: 1,
      outputContractHash: contractSchemaHash(contracts.find((item) => item.id === "agent-output")!),
      emissionDecisions: [{
        emissionPolicyId: "emit-change-implemented",
        emissionPolicyVersion: 1,
        operationId: implementOperation.id,
        operationVersion: implementOperation.version,
        status: "emitted",
        reason: "Completed result published change implemented.",
        gateDecisions: [],
        emittedEvents: [{ slot: "implemented", eventType: "change.implemented.v1", dedupeKey: "loop-trace-terminal" }]
      }],
      domainEvents: [{
        type: "change.implemented.v1",
        subject: "work-1",
        tags: ["delivery"],
        payload: { summary: "Implemented." },
        dedupeKey: "loop-trace-terminal"
      }],
      definitions: loopDefinitions
    });

    const trace = new TraceService(db).byLoop(loopInstanceId!);
    const emitted = trace.entries.find((entry) => entry.kind === "event_emitted" && entry.summary.includes("change.implemented.v1"));

    expect(intake.run?.loopInstanceId).toBe(loopInstanceId);
    expect(emitted).toMatchObject({
      loopInstanceId,
      technicalDetails: expect.objectContaining({ loopInstanceId })
    });
    expect(trace.entries.map((entry) => entry.kind)).toContain("loop_completed");
    expect(trace.entries.filter((entry) => entry.kind === "agent_queued")).toHaveLength(1);
    db.close();
  });

  it("shows emitted-event trace steps from stored emission decisions when no event row is in scope", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const intake = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      payload: { goal: "Ship trace decisions" }
    }, definitions);

    const run = intake.runs[0];
    expect(run).toBeDefined();
    db.completeRun({
      runId: run!.runId,
      status: "completed",
      output: { status: "completed", summary: "Implemented.", result: {}, evidence: {} },
      outputContractId: "agent-output",
      outputContractVersion: 1,
      outputContractHash: contractSchemaHash(contracts.find((item) => item.id === "agent-output")!),
      emissionDecisions: [{
        emissionPolicyId: "emit-change-implemented",
        emissionPolicyVersion: 1,
        operationId: implementOperation.id,
        operationVersion: implementOperation.version,
        status: "emitted",
        reason: "Completed result published change implemented.",
        gateDecisions: [],
        emittedEvents: [{ slot: "implemented", eventType: "change.implemented.v1", dedupeKey: "decision-only-event" }]
      }]
    });

    const trace = new TraceService(db).byRun(run!.runId);
    const emitted = trace.entries.find((entry) => entry.id.startsWith(`emitted-event:${run!.runId}`));

    expect(emitted).toMatchObject({
      kind: "event_emitted",
      title: "Event emitted",
      summary: "Published change.implemented.v1 from implemented.",
      status: "emitted",
      runId: run!.runId,
      technicalDetails: expect.objectContaining({
        emissionPolicyId: "emit-change-implemented",
        emittedEvent: expect.objectContaining({
          eventType: "change.implemented.v1",
          dedupeKey: "decision-only-event"
        })
      })
    });
    db.close();
  });

  it("infers an agent-started trace step for completed leased runs without an explicit start log", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      payload: { goal: "Ship start traces" }
    }, definitions);

    const leased = db.leaseNextRun({ owner: "worker-1", leaseSeconds: 60 });
    expect(leased?.attempt).toBe(1);
    db.completeRun({
      runId: leased!.runId,
      status: "completed",
      output: { status: "completed", summary: "Implemented.", result: {}, evidence: {} },
      outputContractId: "agent-output",
      outputContractVersion: 1,
      outputContractHash: contractSchemaHash(contracts.find((item) => item.id === "agent-output")!)
    });

    const trace = new TraceService(db).byRun(leased!.runId);
    const startedEntries = trace.entries.filter((entry) => entry.kind === "agent_started");

    expect(startedEntries).toHaveLength(1);
    expect(startedEntries[0]).toMatchObject({
      title: "Agent started",
      summary: expect.stringContaining("was picked up by an agent"),
      status: "started",
      runId: leased!.runId,
      technicalDetails: expect.objectContaining({ attempt: 1 })
    });
    expect(trace.entries.map((entry) => entry.kind)).toEqual(expect.arrayContaining(["agent_queued", "agent_started", "agent_completed"]));
    db.close();
  });

  it("includes structured output validation errors in failed run traces", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      payload: { goal: "Ship validation traces" }
    }, definitions);

    const leased = db.leaseNextRun({ owner: "worker-1", leaseSeconds: 60 });
    db.completeRun({
      runId: leased!.runId,
      status: "failed",
      output: { status: "completed" },
      outputContractId: "agent-output",
      outputContractVersion: 1,
      outputContractHash: contractSchemaHash(contracts.find((item) => item.id === "agent-output")!),
      outputValidationErrors: [{
        instancePath: "",
        schemaPath: "#/required",
        message: "must have required property 'summary'",
        keyword: "required"
      }],
      error: "Agent output failed contract agent-output@1 validation."
    });

    const trace = new TraceService(db).byRun(leased!.runId);
    const failed = trace.entries.find((entry) => entry.kind === "agent_failed");

    expect(failed).toMatchObject({
      title: "Agent failed",
      status: "failed",
      runId: leased!.runId,
      technicalDetails: expect.objectContaining({
        outputContractId: "agent-output",
        outputValidationErrors: [{
          instancePath: "",
          schemaPath: "#/required",
          message: "must have required property 'summary'",
          keyword: "required"
        }]
      })
    });
    db.close();
  });

  it("shows loop exhaustion in correlation traces even when no run is queued", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const exhaustedLoop = {
      ...deliveryLoop,
      limits: { ...deliveryLoop.limits, maxRuns: 0 }
    };
    const loopDefinitions: RuntimeDefinitions = {
      ...definitions,
      loopDefinitions: [exhaustedLoop],
      routingPolicies: [definitions.routingPolicies[0]!]
    };

    const intake = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      source: "test",
      subject: "work-1",
      payload: { goal: "Ship exhausted trace" },
      loopDefinitionId: exhaustedLoop.id,
      loopDefinitionVersion: exhaustedLoop.version
    }, loopDefinitions);

    expect(intake.runs).toHaveLength(0);
    expect(intake.event.loopInstanceId).toBeTruthy();
    const correlationId = intake.event.correlationId;
    if (!correlationId) throw new Error("Expected exhausted loop event to have a correlation ID.");
    const trace = new TraceService(db).byCorrelation(correlationId);
    const loopExhausted = trace.entries.find((entry) => entry.kind === "loop_exhausted");

    expect(loopExhausted).toMatchObject({
      title: "Flow exhausted",
      summary: "maxRuns 0 exceeded",
      loopInstanceId: intake.event.loopInstanceId
    });
    expect(trace.entries.map((entry) => entry.kind)).toContain("event_received");
    db.close();
  });
});
