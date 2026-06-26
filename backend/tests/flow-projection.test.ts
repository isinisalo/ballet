import { describe, expect, it } from "vitest";
import type { Agent, AppData, EventDefinition } from "../shared/domain.js";
import type { ContractDefinition } from "../shared/contracts.js";
import type { AgentOperation } from "../shared/operations.js";
import type { RoutingPolicy } from "../shared/routing-policy.js";
import type { EmissionPolicy } from "../shared/emission-policy.js";
import type { LoopDefinition } from "../shared/loop.js";
import { projectFlows } from "../flow-projection.js";

const at = "2026-06-25T08:00:00.000Z";

const agent: Agent = {
  id: "developer",
  name: "Developer",
  description: "Builds.",
  instructions: "Build.",
  skills: [],
  enabled: true,
  status: "offline",
  createdAt: at,
  updatedAt: at
};

const contract = (id: string, kind: ContractDefinition["kind"]): ContractDefinition => ({
  id,
  version: 1,
  name: id,
  description: id,
  kind,
  active: true,
  schema: kind === "agent-output"
    ? {
        type: "object",
        additionalProperties: false,
        required: ["status", "summary"],
        properties: {
          status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
          summary: { type: "string" },
          result: { type: "object", additionalProperties: true },
          evidence: { type: "object", additionalProperties: true }
        }
      }
    : { type: "object", additionalProperties: true },
  examples: [],
  createdAt: at,
  updatedAt: at
});

const event = (id: string, eventType: string): EventDefinition => ({
  id,
  name: id.replace(/-/g, " "),
  description: id,
  active: true,
  eventType,
  tags: [],
  dataContract: { id: "event-data", version: 1 },
  examples: [],
  createdAt: at,
  updatedAt: at
});

const operation = (id: string): AgentOperation => ({
  id,
  version: 1,
  name: id,
  description: id,
  active: true,
  agentId: "developer",
  instructions: "Do it.",
  inputContract: { id: "input", version: 1 },
  outputContract: { id: "output", version: 1 },
  emissionRequired: true,
  createdAt: at,
  updatedAt: at
});

const route = (id: string, eventType: string, operationId: string): RoutingPolicy => ({
  id,
  name: id,
  description: id,
  active: true,
  consumes: { eventType },
  dispatch: { operation: { id: operationId, version: 1 } },
  input: { object: {} },
  createdAt: at,
  updatedAt: at
});

const emit = (id: string, operationId: string, eventType: string): EmissionPolicy => ({
  id,
  version: 1,
  name: id,
  description: id,
  active: true,
  observes: { operation: { id: operationId, version: 1 } },
  emissions: [{
    slot: "completed",
    eventType,
    data: { object: {} }
  }],
  createdAt: at,
  updatedAt: at
});

const loop = (routingPolicyIds: string[], emissionPolicyIds: string[], terminalEventTypes = ["done.v1"]): LoopDefinition => ({
  id: "delivery",
  version: 1,
  name: "Delivery",
  description: "Delivery flow.",
  active: true,
  entryEventTypes: ["start.v1"],
  terminalEventTypes,
  routingPolicyIds,
  emissionPolicyIds,
  limits: { maxHops: 10, maxRuns: 10, maxIterationsPerStep: 3 },
  createdAt: at,
  updatedAt: at
});

const appData = (overrides: Partial<AppData> = {}): AppData => ({
  projects: [],
  goals: [],
  adrs: [],
  agents: [agent],
  skills: [],
  runtimes: [],
  contracts: [contract("event-data", "event-data"), contract("input", "agent-input"), contract("output", "agent-output")],
  operations: [operation("implement"), operation("review"), operation("qa")],
  policies: [route("start-implement", "start.v1", "implement"), route("implemented-review", "implemented.v1", "review"), route("implemented-qa", "implemented.v1", "qa")],
  emissionPolicies: [emit("emit-implemented", "implement", "implemented.v1"), emit("emit-done", "review", "done.v1")],
  loopDefinitions: [loop(["start-implement", "implemented-review"], ["emit-implemented", "emit-done"])],
  loopInstances: [],
  eventDefinitions: [event("start", "start.v1"), event("implemented", "implemented.v1"), event("done", "done.v1")],
  events: [],
  agentRuns: [],
  ...overrides
});

describe("FlowProjection", () => {
  it("derives a sequential chain from loop policy membership", () => {
    const [flow] = projectFlows(appData());
    expect(flow?.health).toBe("ready");
    expect(flow?.entryEvents.map((item) => item.eventType)).toEqual(["start.v1"]);
    expect(flow?.edges.map((edge) => edge.kind)).toContain("routing");
    expect(flow?.edges.map((edge) => edge.kind)).toContain("emission");
  });

  it("derives fan-out branches from one event", () => {
    const [flow] = projectFlows(appData({
      loopDefinitions: [loop(["start-implement", "implemented-review", "implemented-qa"], ["emit-implemented", "emit-done"])]
    }));
    const implementedRoutes = flow?.edges.filter((edge) => edge.kind === "routing" && edge.from === "event:implemented.v1");
    expect(implementedRoutes).toHaveLength(2);
  });

  it("derives output branches from one operation result", () => {
    const branchEmission: EmissionPolicy = {
      ...emit("emit-review-result", "review", "approved.v1"),
      emissions: [
        { slot: "approved", eventType: "approved.v1", data: { object: {} } },
        { slot: "changes-requested", eventType: "changes-requested.v1", data: { object: {} } }
      ]
    };
    const [flow] = projectFlows(appData({
      emissionPolicies: [emit("emit-implemented", "implement", "implemented.v1"), branchEmission],
      loopDefinitions: [loop(["start-implement", "implemented-review"], ["emit-implemented", "emit-review-result"], ["approved.v1", "changes-requested.v1"])],
      eventDefinitions: [
        event("start", "start.v1"),
        event("implemented", "implemented.v1"),
        event("approved", "approved.v1"),
        event("changes-requested", "changes-requested.v1")
      ]
    }));

    const reviewResultEdges = flow?.edges.filter((edge) => edge.kind === "emission" && edge.from === "operation:review@1");
    expect(reviewResultEdges?.map((edge) => edge.to).sort()).toEqual(["event:approved.v1", "event:changes-requested.v1"]);
    expect(flow?.terminalEvents.map((eventNode) => eventNode.eventType).sort()).toEqual(["approved.v1", "changes-requested.v1"]);
  });

  it("handles cyclic loops without recursive traversal", () => {
    const [flow] = projectFlows(appData({
      emissionPolicies: [emit("emit-implemented", "implement", "implemented.v1"), emit("emit-start", "review", "start.v1")],
      loopDefinitions: [loop(["start-implement", "implemented-review"], ["emit-implemented", "emit-start"], ["done.v1"])]
    }));
    expect(flow?.health).toBe("ready");
    expect(flow?.nodes.length).toBeLessThan(8);
  });

  it("reports missing operation, event definition, and contract diagnostics", () => {
    const [flow] = projectFlows(appData({
      contracts: [],
      policies: [route("broken", "missing.v1", "missing-op")],
      loopDefinitions: [loop(["broken"], [])],
      eventDefinitions: []
    }));
    expect(flow?.health).toBe("invalid");
    expect(flow?.diagnostics.map((diagnostic) => diagnostic.title)).toEqual(expect.arrayContaining([
      "Missing trigger or result",
      "Missing agent task"
    ]));
  });

  it("reports unavailable event, input, and output contracts", () => {
    const [flow] = projectFlows(appData({
      contracts: [
        { ...contract("event-data", "event-data"), active: false },
        contract("input", "agent-input")
      ]
    }));

    expect(flow?.health).toBe("invalid");
    expect(flow?.diagnostics.map((diagnostic) => diagnostic.title)).toEqual(expect.arrayContaining([
      "Missing data shape",
      "Missing task result shape"
    ]));
    expect(flow?.diagnostics.map((diagnostic) => diagnostic.explanation).join("\n")).toContain("event-data@1");
    expect(flow?.diagnostics.map((diagnostic) => diagnostic.explanation).join("\n")).toContain("output@1");
  });

  it("reports disabled agents used by active tasks", () => {
    const [flow] = projectFlows(appData({
      agents: [{ ...agent, enabled: false }]
    }));

    expect(flow?.health).toBe("invalid");
    expect(flow?.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Disabled agent",
        explanation: "Task \"implement\" uses disabled agent Developer.",
        suggestedFix: "Enable the agent or pause this task before activating the Flow."
      })
    ]));
  });

  it("reports inactive events and tasks referenced by a Flow", () => {
    const [flow] = projectFlows(appData({
      operations: [operation("implement"), { ...operation("review"), active: false }, operation("qa")],
      eventDefinitions: [
        event("start", "start.v1"),
        { ...event("implemented", "implemented.v1"), active: false },
        event("done", "done.v1")
      ]
    }));

    expect(flow?.health).toBe("invalid");
    expect(flow?.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Inactive event",
        explanation: "Event \"implemented\" is referenced by this Flow but is inactive.",
        suggestedFix: "Activate the event or remove it from the Flow."
      }),
      expect.objectContaining({
        title: "Inactive task",
        explanation: "Task \"review\" is referenced by this Flow but is inactive.",
        suggestedFix: "Activate the task or remove the routing or emission rule that references it."
      })
    ]));
  });

  it("prefers an active event definition over an inactive definition with the same event type", () => {
    const [flow] = projectFlows(appData({
      eventDefinitions: [
        event("start", "start.v1"),
        { ...event("old-implemented", "implemented.v1"), active: false },
        event("implemented", "implemented.v1"),
        event("done", "done.v1")
      ]
    }));

    expect(flow?.health).toBe("ready");
    expect(flow?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "event",
        eventType: "implemented.v1",
        name: "implemented",
        active: true
      })
    ]));
    expect(flow?.diagnostics.map((diagnostic) => diagnostic.title)).not.toContain("Inactive event");
  });

  it("uses the single active emission rule version for a Flow membership", () => {
    const [flow] = projectFlows(appData({
      emissionPolicies: [
        emit("emit-implemented", "implement", "implemented.v1"),
        { ...emit("emit-done", "review", "done.v1"), active: false },
        { ...emit("emit-done", "review", "done.v1"), version: 2, name: "emit-done v2" }
      ]
    }));

    const reviewEmissions = flow?.edges.filter((edge) => edge.kind === "emission" && edge.from === "operation:review@1");
    expect(flow?.health).toBe("ready");
    expect(reviewEmissions).toHaveLength(1);
    expect(reviewEmissions?.[0]).toEqual(expect.objectContaining({ policyId: "emit-done", policyVersion: 2 }));
  });

  it("reports active Flows with ambiguous active emission rule versions", () => {
    const [flow] = projectFlows(appData({
      emissionPolicies: [
        emit("emit-implemented", "implement", "implemented.v1"),
        emit("emit-done", "review", "done.v1"),
        { ...emit("emit-done", "review", "done.v1"), version: 2, name: "emit-done v2" }
      ]
    }));

    expect(flow?.health).toBe("invalid");
    expect(flow?.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Ambiguous emission rule version",
        explanation: "Delivery includes emit-done, but multiple active versions exist. Pause old versions or create a Flow membership that selects one version.",
        suggestedFix: "Keep only one active version of the emission rule for this Flow."
      })
    ]));
  });

  it("projects ungrouped resources instead of hiding them", () => {
    const flows = projectFlows(appData({
      loopDefinitions: []
    }));
    expect(flows.some((flow) => flow.id === "__ungrouped__")).toBe(true);
  });
});
