import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../shared/domain.js";
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
        summary: { type: "string" }
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
  createdAt: at,
  updatedAt: at
});

const definitions = (loopDefinition: LoopDefinition) => ({
  agents: [agent],
  contracts,
  operations: [operation],
  routingPolicies: [policy],
  emissionPolicies: [],
  eventDefinitions: [],
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
    db.close();
  });
});
