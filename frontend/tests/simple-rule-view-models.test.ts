import { describe, expect, it } from "vitest";
import type { AppData } from "../../backend/shared/domain";
import type { ContractDefinition } from "../../backend/shared/contracts";
import { autoMapOperationOutputToEventData, autoSubjectMapping, emissionPolicyFromSimpleDraft, emissionPresetCondition } from "../src/features/advanced/emissions/emission-rule-view-model";
import { deriveReachableRulesFromEntryEvent, loopDefinitionFromSimpleBoundaryDraft, suggestTerminalEvents } from "../src/features/advanced/loops/flow-boundary-view-model";
import { autoMapEventToOperationInput, routingPolicyFromSimpleDraft } from "../src/features/advanced/routing/routing-rule-view-model";

const at = "2026-06-25T08:00:00.000Z";

const contract = (id: string, kind: ContractDefinition["kind"], required: string[], properties: Record<string, unknown>): ContractDefinition => ({
  id,
  version: 1,
  name: id,
  description: id,
  kind,
  active: true,
  schema: { type: "object", additionalProperties: false, required, properties },
  examples: [],
  createdAt: at,
  updatedAt: at
});

const eventData = contract("change-data", "event-data", ["summary", "gitSha"], {
  summary: { type: "string" },
  gitSha: { type: "string" }
});

const inputData = contract("review-input", "agent-input", ["workItemId", "summary", "gitSha"], {
  workItemId: { type: "string" },
  summary: { type: "string" },
  gitSha: { type: "string" }
});

const outputData = contract("review-output", "agent-output", ["status", "summary"], {
  status: { type: "string" },
  summary: { type: "string" },
  result: {
    type: "object",
    additionalProperties: false,
    required: ["decision"],
    properties: {
      decision: { type: "string" },
      gitSha: { type: "string" }
    }
  }
});

const resultEventData = contract("review-result-data", "event-data", ["summary", "decision"], {
  summary: { type: "string" },
  decision: { type: "string" },
  tags: { type: "array", items: { type: "string" }, default: [] }
});

const data: AppData = {
  projects: [],
  goals: [],
  adrs: [],
  agents: [{ id: "reviewer", name: "Reviewer", description: "", instructions: "", skills: [], enabled: true, status: "offline", createdAt: at, updatedAt: at }],
  skills: [],
  runtimes: [],
  contracts: [eventData, inputData, outputData, resultEventData],
  operations: [{
    id: "reviewer/review",
    version: 1,
    name: "Review change",
    description: "",
    active: true,
    agentId: "reviewer",
    instructions: "",
    inputContract: { id: "review-input", version: 1 },
    outputContract: { id: "review-output", version: 1 },
    emissionRequired: true,
    createdAt: at,
    updatedAt: at
  }],
  eventDefinitions: [
    { id: "change-implemented", name: "Change implemented", description: "", active: true, eventType: "change.implemented.v1", tags: [], dataContract: { id: "change-data", version: 1 }, examples: [], createdAt: at, updatedAt: at },
    { id: "review-approved", name: "Review approved", description: "", active: true, eventType: "review.approved.v1", tags: [], dataContract: { id: "review-result-data", version: 1 }, examples: [], createdAt: at, updatedAt: at }
  ],
  policies: [{
    id: "route-review",
    name: "Route review",
    description: "",
    active: true,
    consumes: { eventType: "change.implemented.v1" },
    dispatch: { operation: { id: "reviewer/review", version: 1 } },
    input: { object: {} },
    createdAt: at,
    updatedAt: at
  }],
  emissionPolicies: [{
    id: "emit-review",
    version: 1,
    name: "Emit review",
    description: "",
    active: true,
    observes: { operation: { id: "reviewer/review", version: 1 } },
    when: { path: "/output/status", op: "eq", value: "completed" },
    emissions: [{ slot: "completed", eventType: "review.approved.v1", data: { object: {} } }],
    createdAt: at,
    updatedAt: at
  }],
  loopDefinitions: [{
    id: "delivery",
    version: 1,
    name: "Delivery",
    description: "",
    active: true,
    entryEventTypes: ["change.implemented.v1"],
    routingPolicyIds: ["route-review"],
    emissionPolicyIds: ["emit-review"],
    terminalEventTypes: ["review.approved.v1"],
    limits: { maxHops: 30, maxRuns: 50, maxIterationsPerStep: 5 },
    createdAt: at,
    updatedAt: at
  }],
  loopInstances: [],
  events: [],
  agentRuns: []
};

describe("simple routing, emission, and Flow boundary helpers", () => {
  it("auto-maps event data to operation input and saves canonical routing defaults", () => {
    const auto = autoMapEventToOperationInput(data.eventDefinitions[0], eventData, data.operations[0], inputData);

    expect(auto.summary).toEqual([
      { targetField: "workItemId", sourceLabel: "from Event subject", required: true, status: "mapped" },
      { targetField: "summary", sourceLabel: "from Event data > summary", required: true, status: "mapped" },
      { targetField: "gitSha", sourceLabel: "from Event data > gitSha", required: true, status: "mapped" }
    ]);

    const policy = routingPolicyFromSimpleDraft(data.policies[0]!, {
      inputEventType: "change.implemented.v1",
      targetOperationId: "reviewer/review",
      targetOperationVersion: 1,
      description: "Review implemented changes.",
      active: true
    }, data);

    expect(policy).toMatchObject({
      consumes: { eventType: "change.implemented.v1" },
      dispatch: { operation: { id: "reviewer/review", version: 1 } },
      selection: { mode: "fanout" },
      onInvalidInput: "reject-event",
      input: { object: {
        workItemId: { from: "/event/subject" },
        summary: { from: "/event/data/summary" },
        gitSha: { from: "/event/data/gitSha" }
      } }
    });
  });

  it("auto-maps operation output to event data and saves canonical emission defaults", () => {
    expect(autoSubjectMapping(inputData)).toEqual({
      mapping: { from: "/input/workItemId" },
      label: "from Agent input > workItemId",
      needsSelection: false
    });

    const auto = autoMapOperationOutputToEventData(data.operations[0], outputData, data.eventDefinitions[1], resultEventData);
    expect(auto.summary).toEqual([
      { targetField: "summary", sourceLabel: "from Agent summary", required: true, status: "mapped" },
      { targetField: "decision", sourceLabel: "from Agent result > decision", required: true, status: "mapped" },
      { targetField: "tags", sourceLabel: "default: []", required: false, status: "defaulted" }
    ]);

    const policy = emissionPolicyFromSimpleDraft(data.emissionPolicies[0]!, {
      operationId: "reviewer/review",
      operationVersion: 1,
      condition: emissionPresetCondition("approved"),
      emittedEventType: "review.approved.v1",
      description: "Publish approval.",
      active: true,
      gates: []
    }, data);

    expect(policy.emissions[0]).toMatchObject({
      slot: "completed",
      eventType: "review.approved.v1",
      subject: { from: "/input/workItemId" },
      data: { object: {
        summary: { from: "/output/summary" },
        decision: { from: "/output/result/decision" },
        tags: { const: [] }
      } },
      dedupeKey: { template: "emission:{{/run/id}}:emit-review:completed" }
    });
  });

  it("derives reachable rules, terminal events, and canonical Flow boundary updates", () => {
    expect(deriveReachableRulesFromEntryEvent(data, "change.implemented.v1")).toEqual({
      routingPolicyIds: ["route-review"],
      emissionPolicyIds: ["emit-review"]
    });
    expect(suggestTerminalEvents(data, ["route-review"], ["emit-review"])).toEqual(["review.approved.v1"]);

    const loop = loopDefinitionFromSimpleBoundaryDraft(data.loopDefinitions[0]!, {
      name: "Delivery Flow",
      description: "Review delivery.",
      active: true,
      entryEventTypes: ["change.implemented.v1"],
      routingPolicyIds: ["route-review"],
      emissionPolicyIds: ["emit-review"],
      terminalEventTypes: ["review.approved.v1"],
      limitExceededEventType: "review.approved.v1",
      limits: { maxHops: 30, maxRuns: 50, maxIterationsPerStep: 5, deadlineSeconds: 7200 }
    });

    expect(loop).toMatchObject({
      entryEventTypes: ["change.implemented.v1"],
      routingPolicyIds: ["route-review"],
      emissionPolicyIds: ["emit-review"],
      terminalEventTypes: ["review.approved.v1"],
      limits: { maxHops: 30, maxRuns: 50, maxIterationsPerStep: 5, deadlineSeconds: 7200 },
      onLimitExceeded: { eventType: "review.approved.v1" }
    });
  });
});
