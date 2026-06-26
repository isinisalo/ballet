import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent, EventDefinition } from "../shared/domain.js";
import type { ContractDefinition } from "../shared/contracts.js";
import type { AgentOperation } from "../shared/operations.js";
import type { RoutingPolicy } from "../shared/routing-policy.js";
import type { LoopDefinition } from "../shared/loop.js";
import { RuntimeDatabase } from "../runtime-db.js";

const tempRoots: string[] = [];
const at = "2026-06-25T08:00:00.000Z";

const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-loop-"));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const agent: Agent = {
  id: "developer-agent",
  name: "Developer",
  description: "Developer.",
  instructions: "Implement.",
  skills: [],
  enabled: true,
  status: "offline",
  createdAt: at,
  updatedAt: at
};

const contracts: ContractDefinition[] = [
  {
    id: "loose-event-data",
    version: 1,
    name: "Loose event data",
    description: "Generic event data for runtime loop tests.",
    kind: "event-data",
    active: true,
    schema: { type: "object", additionalProperties: true },
    examples: [{}],
    createdAt: at,
    updatedAt: at
  },
  {
    id: "delivery-terminal-data",
    version: 1,
    name: "Delivery terminal data",
    description: "Terminal data.",
    kind: "event-data",
    active: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["reason"],
      properties: {
        reason: { type: "string" }
      }
    },
    examples: [{ reason: "limit" }],
    createdAt: at,
    updatedAt: at
  },
  {
    id: "input",
    version: 1,
    name: "Input",
    description: "Input.",
    kind: "agent-input",
    active: true,
    schema: { type: "object", additionalProperties: true },
    examples: [],
    createdAt: at,
    updatedAt: at
  },
  {
    id: "output",
    version: 1,
    name: "Output",
    description: "Output.",
    kind: "agent-output",
    active: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["status", "summary"],
      properties: {
        status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
        summary: { type: "string" },
        result: { type: "object", additionalProperties: true },
        evidence: { type: "object", additionalProperties: true }
      }
    },
    examples: [],
    createdAt: at,
    updatedAt: at
  }
];

const operation: AgentOperation = {
  id: "developer-agent/implement-change",
  version: 1,
  name: "Implement",
  description: "Implement.",
  active: true,
  agentId: "developer-agent",
  instructions: "Implement.",
  inputContract: { id: "input", version: 1 },
  outputContract: { id: "output", version: 1 },
  emissionRequired: false,
  createdAt: at,
  updatedAt: at
};

const policy: RoutingPolicy = {
  id: "on-plan-approved",
  name: "On plan approved",
  description: "Route.",
  active: true,
  consumes: { eventType: "plan.approved.v1" },
  dispatch: { operation: { id: operation.id, version: operation.version } },
  input: { object: { workItemId: { from: "/event/subject" } } },
  createdAt: at,
  updatedAt: at
};

const outsidePolicy: RoutingPolicy = {
  ...policy,
  id: "outside-policy",
  name: "Outside policy"
};

const terminalObserverPolicy: RoutingPolicy = {
  ...policy,
  id: "observe-terminal",
  name: "Observe terminal event",
  consumes: { eventType: "delivery.completed.v1" }
};

const eventDefinitions: EventDefinition[] = [
  {
    id: "plan-approved-v1",
    name: "Plan approved",
    description: "Starts delivery.",
    active: true,
    eventType: "plan.approved.v1",
    tags: ["delivery"],
    dataContract: { id: "loose-event-data", version: 1 },
    examples: [{}],
    createdAt: at,
    updatedAt: at
  },
  {
    id: "delivery-completed-v1",
    name: "Delivery completed",
    description: "Completes delivery.",
    active: true,
    eventType: "delivery.completed.v1",
    tags: ["delivery"],
    dataContract: { id: "loose-event-data", version: 1 },
    examples: [{}],
    createdAt: at,
    updatedAt: at
  },
  {
    id: "delivery-aborted-v1",
    name: "Delivery aborted",
    description: "Loop exhausted.",
    active: true,
    eventType: "delivery.aborted.v1",
    tags: ["delivery"],
    dataContract: { id: "delivery-terminal-data", version: 1 },
    examples: [{ reason: "maxRuns 0 exceeded" }],
    createdAt: at,
    updatedAt: at
  }
];

const loop = (limits: LoopDefinition["limits"]): LoopDefinition => ({
  id: "delivery-loop",
  version: 1,
  name: "Delivery loop",
  description: "Loop.",
  active: true,
  entryEventTypes: ["plan.approved.v1"],
  terminalEventTypes: ["delivery.completed.v1"],
  routingPolicyIds: [policy.id],
  emissionPolicyIds: [],
  limits,
  onLimitExceeded: { eventType: "delivery.aborted.v1" },
  createdAt: at,
  updatedAt: at
});

const definitions = (loopDefinition: LoopDefinition) => ({
  agents: [agent],
  contracts,
  operations: [operation],
  routingPolicies: [policy],
  emissionPolicies: [],
  eventDefinitions,
  loopDefinitions: [loopDefinition]
});

describe("loop runtime tracking", () => {
  it("starts a loop from an entry event and stores loop metadata on queued runs", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));

    const result = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopDefinitionId: "delivery-loop"
    }, definitions(loop({ maxHops: 5, maxRuns: 5, maxIterationsPerStep: 2 })));

    const instances = db.listLoopInstances();
    expect(instances).toHaveLength(1);
    expect(instances[0]).toMatchObject({ loopDefinitionId: "delivery-loop", status: "running", runCount: 1 });
    expect(result.run).toMatchObject({ loopInstanceId: instances[0]?.loopInstanceId, loopDefinitionId: "delivery-loop" });
    db.close();
  });

  it("requires loopDefinitionVersion when an explicit loop id has multiple active versions", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const first = loop({ maxHops: 5, maxRuns: 5, maxIterationsPerStep: 2 });
    const second = { ...first, version: 2, name: "Delivery loop v2" };
    const defs = {
      ...definitions(first),
      loopDefinitions: [first, second]
    };

    expect(() => db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopDefinitionId: "delivery-loop"
    }, defs)).toThrow("Loop definition delivery-loop has multiple active versions. Specify loopDefinitionVersion.");

    const result = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopDefinitionId: "delivery-loop",
      loopDefinitionVersion: 2
    }, defs);

    expect(result.run).toMatchObject({ loopDefinitionId: "delivery-loop", loopDefinitionVersion: 2 });
    expect(db.listLoopInstances()[0]).toMatchObject({ loopDefinitionId: "delivery-loop", loopDefinitionVersion: 2 });
    db.close();
  });

  it("completes a loop on terminal event", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const started = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopDefinitionId: "delivery-loop"
    }, definitions(loop({ maxHops: 5, maxRuns: 5, maxIterationsPerStep: 2 })));

    db.intakeEvent({
      projectId: "project",
      eventType: "delivery.completed.v1",
      subject: "work-1",
      payload: {},
      loopInstanceId: started.run?.loopInstanceId,
      loopDefinitionId: "delivery-loop",
      loopDefinitionVersion: 1,
      causationId: started.event.eventId
    }, definitions(loop({ maxHops: 5, maxRuns: 5, maxIterationsPerStep: 2 })));

    expect(db.listLoopInstances()[0]).toMatchObject({ status: "completed", hopCount: 1 });
    db.close();
  });

  it("exhausts a loop when maxRuns would be exceeded", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));

    const result = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopDefinitionId: "delivery-loop"
    }, definitions(loop({ maxHops: 5, maxRuns: 0, maxIterationsPerStep: 2 })));

    expect(result.runs).toHaveLength(0);
    expect(db.listLoopInstances()[0]).toMatchObject({ status: "exhausted", runCount: 0 });
    expect(db.listRuntimeEvents().filter((event) => event.type === "delivery.aborted.v1")).toHaveLength(1);
    db.close();
  });

  it("keeps loop exhaustion durable when the limit event contract is unavailable", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const defs = {
      ...definitions(loop({ maxHops: 5, maxRuns: 0, maxIterationsPerStep: 2 })),
      contracts: contracts.filter((contract) => contract.id !== "delivery-terminal-data")
    };

    const result = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopDefinitionId: "delivery-loop"
    }, defs);

    expect(result.runs).toHaveLength(0);
    expect(db.listLoopInstances()[0]).toMatchObject({
      status: "exhausted",
      failureReason: "maxRuns 0 exceeded"
    });
    expect(db.listRuntimeEvents().some((event) => event.type === "plan.approved.v1")).toBe(true);
    expect(db.listRuntimeEvents().filter((event) => event.type === "delivery.aborted.v1")).toHaveLength(0);
    db.close();
  });

  it("evaluates only routing policies included in a running loop", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const loopDefinition = loop({ maxHops: 5, maxRuns: 5, maxIterationsPerStep: 2 });
    const result = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopDefinitionId: "delivery-loop"
    }, {
      ...definitions(loopDefinition),
      routingPolicies: [policy, outsidePolicy]
    });

    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]?.policyId).toBe("on-plan-approved");
    db.close();
  });

  it("lets outside policies observe terminal events without becoming loop steps", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const loopDefinition = loop({ maxHops: 5, maxRuns: 5, maxIterationsPerStep: 2 });
    const defs = {
      ...definitions(loopDefinition),
      routingPolicies: [policy, terminalObserverPolicy]
    };
    const started = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopDefinitionId: "delivery-loop"
    }, defs);
    const loopInstanceId = started.run?.loopInstanceId;
    if (!loopInstanceId) throw new Error("Expected initial loop event to queue a run.");

    const terminal = db.intakeEvent({
      projectId: "project",
      eventType: "delivery.completed.v1",
      subject: "work-1",
      payload: {},
      loopInstanceId,
      loopDefinitionId: "delivery-loop",
      loopDefinitionVersion: 1,
      causationId: started.event.eventId
    }, defs);

    expect(terminal.runs).toHaveLength(1);
    expect(terminal.runs[0]).toMatchObject({
      policyId: "observe-terminal",
      loopInstanceId: undefined,
      loopDefinitionId: undefined,
      loopDefinitionVersion: undefined,
      stepId: undefined,
      iteration: undefined
    });
    expect(db.listLoopInstances()[0]).toMatchObject({
      status: "completed",
      runCount: 1,
      terminalEventId: terminal.event.eventId
    });
    expect(db.listRuntimeEvents().find((event) => event.eventId === terminal.event.eventId)).toMatchObject({
      loopInstanceId,
      loopDefinitionId: "delivery-loop",
      loopDefinitionVersion: 1
    });
    db.close();
  });

  it("exhausts a loop when maxIterationsPerStep would be exceeded", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const defs = definitions(loop({ maxHops: 5, maxRuns: 5, maxIterationsPerStep: 1 }));

    const started = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopDefinitionId: "delivery-loop"
    }, defs);

    const next = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopInstanceId: started.run?.loopInstanceId,
      loopDefinitionId: "delivery-loop",
      loopDefinitionVersion: 1,
      causationId: started.event.eventId
    }, defs);

    expect(next.runs).toHaveLength(0);
    expect(db.listLoopInstances()[0]).toMatchObject({
      status: "exhausted",
      failureReason: "maxIterationsPerStep 1 exceeded for on-plan-approved"
    });
    const limitEvents = db.listRuntimeEvents().filter((event) => event.type === "delivery.aborted.v1");
    expect(limitEvents).toHaveLength(1);
    expect(limitEvents[0]).toMatchObject({
      causationId: next.event.eventId,
      loopInstanceId: started.run?.loopInstanceId,
      loopDefinitionId: "delivery-loop",
      loopDefinitionVersion: 1,
      payload: { reason: "maxIterationsPerStep 1 exceeded for on-plan-approved" }
    });
    db.close();
  });

  it("exhausts a loop when the deadline has passed", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const defs = definitions(loop({ maxHops: 5, maxRuns: 5, maxIterationsPerStep: 5, deadlineSeconds: -1 }));

    const started = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopDefinitionId: "delivery-loop"
    }, defs);

    expect(started.runs).toHaveLength(0);
    expect(db.listLoopInstances()[0]).toMatchObject({
      status: "exhausted",
      failureReason: "deadline -1s exceeded"
    });
    expect(db.listRuntimeEvents().filter((event) => event.type === "delivery.aborted.v1")).toHaveLength(1);
    db.close();
  });

  it("persists inherited maxHops exhaustion without throwing", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const defs = definitions(loop({ maxHops: 0, maxRuns: 5, maxIterationsPerStep: 5 }));

    const started = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopDefinitionId: "delivery-loop"
    }, defs);
    const next = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopInstanceId: started.run?.loopInstanceId,
      loopDefinitionId: "delivery-loop",
      loopDefinitionVersion: 1,
      causationId: started.event.eventId
    }, defs);

    expect(next.runs).toHaveLength(0);
    expect(db.listLoopInstances()[0]).toMatchObject({
      status: "exhausted",
      failureReason: "maxHops 0 exceeded"
    });
    expect(db.listRuntimeEvents().filter((event) => event.type === "delivery.aborted.v1")).toHaveLength(1);
    db.close();
  });

  it("persists inherited deadline exhaustion and emits the limit event once", async () => {
    const root = await tempRoot();
    const db = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
    const defs = definitions(loop({ maxHops: 5, maxRuns: 5, maxIterationsPerStep: 5, deadlineSeconds: 1 }));

    const started = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopDefinitionId: "delivery-loop"
    }, defs);
    const loopInstanceId = started.run?.loopInstanceId;
    if (!loopInstanceId) throw new Error("Expected initial loop event to queue a run.");

    db.connection().prepare(`
      UPDATE loop_instances
      SET started_at = @startedAt
      WHERE loop_instance_id = @loopInstanceId
    `).run({
      loopInstanceId,
      startedAt: new Date(Date.now() - 2_000).toISOString()
    });

    const inherited = db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: {},
      loopInstanceId,
      loopDefinitionId: "delivery-loop",
      loopDefinitionVersion: 1,
      causationId: started.event.eventId
    }, defs);

    expect(inherited.runs).toHaveLength(0);
    expect(db.listLoopInstances()[0]).toMatchObject({
      status: "exhausted",
      failureReason: "deadline 1s exceeded"
    });
    expect(db.listRuntimeEvents().filter((event) => event.type === "delivery.aborted.v1")).toHaveLength(1);

    expect(() => db.intakeEvent({
      projectId: "project",
      eventType: "plan.approved.v1",
      subject: "work-1",
      payload: { attempt: "after-exhaustion" },
      loopInstanceId,
      loopDefinitionId: "delivery-loop",
      loopDefinitionVersion: 1,
      causationId: inherited.event.eventId
    }, defs)).toThrow(`Loop instance ${loopInstanceId} is exhausted and cannot accept more events.`);

    expect(db.listRuntimeEvents().filter((event) => event.type === "delivery.aborted.v1")).toHaveLength(1);
    db.close();
  });
});
