import { describe, expect, it } from "vitest";
import { assertQueuedSnapshotMatches, buildRunPrompt, emissionPoliciesForRun } from "../agentd.js";
import { ContractRegistry, contractSchemaHash, type ContractDefinition } from "../shared/contracts.js";
import type { AgentRun, AppData } from "../shared/domain.js";
import type { EmissionPolicy } from "../shared/emission-policy.js";
import type { AgentOperation } from "../shared/operations.js";
import { operationDefinitionHash } from "../runtime-db.js";

const operation: AgentOperation = {
  id: "developer-agent/implement-change",
  version: 1,
  name: "Implement change",
  description: "Implement a change.",
  active: true,
  agentId: "developer-agent",
  instructions: "Use the mapped input only.",
  inputContract: { id: "implement-change-input", version: 1 },
  outputContract: { id: "implement-change-output", version: 1 },
  emissionRequired: true,
  createdAt: "2026-06-25T08:00:00.000Z",
  updatedAt: "2026-06-25T08:00:00.000Z"
};

const at = "2026-06-25T08:00:00.000Z";

const inputContract: ContractDefinition = {
  id: "implement-change-input",
  version: 1,
  name: "Implement change input",
  description: "Input for implementation.",
  kind: "agent-input",
  active: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["workItemId"],
    properties: {
      workItemId: { type: "string" }
    }
  },
  examples: [],
  createdAt: at,
  updatedAt: at
};

const outputContract: ContractDefinition = {
  id: "implement-change-output",
  version: 1,
  name: "Implement change output",
  description: "Output for implementation.",
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
};

const queuedRun: AgentRun = {
  runId: "run-1",
  triggerEventId: "event-1",
  policyId: "policy-1",
  policyVersion: 1,
  agentRole: "developer-agent",
  operationId: operation.id,
  operationVersion: operation.version,
  operationHash: operationDefinitionHash(operation),
  inputJson: { workItemId: "work-1" },
  inputContractId: inputContract.id,
  inputContractVersion: inputContract.version,
  inputContractHash: contractSchemaHash(inputContract),
  outputContractId: outputContract.id,
  outputContractVersion: outputContract.version,
  outputContractHash: contractSchemaHash(outputContract),
  status: "running",
  attempt: 1,
  createdAt: at,
  updatedAt: at
};

const emissionPolicy = (version: number): EmissionPolicy => ({
  id: "emit-change-implemented",
  version,
  name: `Emit change implemented v${version}`,
  description: "Publish implementation.",
  active: true,
  observes: { operation: { id: operation.id, version: operation.version } },
  emissions: [{
    slot: "implemented",
    eventType: "change.implemented.v1",
    data: { object: {} }
  }],
  createdAt: at,
  updatedAt: at
});

const appDataForEmissionPolicies = (emissionPolicies: EmissionPolicy[]): AppData => ({
  projects: [],
  goals: [],
  adrs: [],
  agents: [],
  skills: [],
  runtimes: [],
  contracts: [inputContract, outputContract],
  operations: [operation],
  policies: [],
  emissionPolicies,
  loopDefinitions: [{
    id: "delivery-loop",
    version: 1,
    name: "Delivery loop",
    description: "Delivery loop.",
    active: true,
    entryEventTypes: [],
    terminalEventTypes: [],
    routingPolicyIds: [],
    emissionPolicyIds: ["emit-change-implemented"],
    limits: { maxHops: 10, maxRuns: 10, maxIterationsPerStep: 3 },
    createdAt: at,
    updatedAt: at
  }],
  loopInstances: [],
  eventDefinitions: [],
  events: [],
  agentRuns: []
});

describe("agent prompt isolation", () => {
  it("includes operation instructions and mapped input without orchestration metadata", () => {
    const prompt = buildRunPrompt(operation, {
      workItemId: "work-1",
      goal: "Implement isolation",
      acceptanceCriteria: ["prompt excludes event metadata"],
      constraints: []
    });

    expect(prompt).toContain("Use the mapped input only.");
    expect(prompt).toContain('"workItemId": "work-1"');
    expect(prompt).not.toContain("event_id");
    expect(prompt).not.toContain("eventType");
    expect(prompt).not.toContain("policy_id");
    expect(prompt).not.toContain("run_id");
    expect(prompt).not.toContain("correlationId");
    expect(prompt).not.toContain("causationId");
  });

  it("rejects queued runs when operation or contract snapshots no longer match", () => {
    const registry = new ContractRegistry([inputContract, outputContract]);
    expect(() => assertQueuedSnapshotMatches(queuedRun, operation, registry)).not.toThrow();

    expect(() => assertQueuedSnapshotMatches(
      queuedRun,
      { ...operation, instructions: "Mutated after queueing." },
      registry
    )).toThrow("Queued operation snapshot");

    expect(() => assertQueuedSnapshotMatches(
      queuedRun,
      { ...operation, name: "Renamed after queueing.", description: "Retitled after queueing." },
      registry
    )).toThrow("Queued operation snapshot");

    expect(() => assertQueuedSnapshotMatches(queuedRun, operation, new ContractRegistry([
      {
        ...inputContract,
        schema: {
          ...inputContract.schema,
          required: ["workItemId", "goal"],
          properties: {
            workItemId: { type: "string" },
            goal: { type: "string" }
          }
        }
      },
      outputContract
    ]))).toThrow("Queued input contract snapshot");

    expect(() => assertQueuedSnapshotMatches(queuedRun, operation, new ContractRegistry([
      inputContract,
      {
        ...outputContract,
        schema: {
          ...outputContract.schema,
          required: ["status", "summary", "result"],
          properties: {
            status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
            summary: { type: "string" },
            result: { type: "object", additionalProperties: true },
            evidence: { type: "object", additionalProperties: true }
          }
        }
      }
    ]))).toThrow("Queued output contract snapshot");
  });

  it("fails clearly when a loop includes multiple active emission policy versions", () => {
    const loopRun = {
      ...queuedRun,
      loopDefinitionId: "delivery-loop",
      loopDefinitionVersion: 1
    };

    expect(() => emissionPoliciesForRun(appDataForEmissionPolicies([
      emissionPolicy(1),
      emissionPolicy(2)
    ]), loopRun)).toThrow("Loop delivery-loop@1 includes emission policy emit-change-implemented, but multiple active versions exist.");
    expect(emissionPoliciesForRun(appDataForEmissionPolicies([
      emissionPolicy(1),
      { ...emissionPolicy(2), active: false }
    ]), loopRun).map((policy) => `${policy.id}@${policy.version}`)).toEqual([
      "emit-change-implemented@1",
      "emit-change-implemented@2"
    ]);
  });

  it("selects only emission policies included in the running loop definition", () => {
    const loopRun = {
      ...queuedRun,
      loopDefinitionId: "delivery-loop",
      loopDefinitionVersion: 1
    };
    const outsidePolicy = {
      ...emissionPolicy(1),
      id: "emit-outside-loop",
      name: "Emit outside loop"
    };

    expect(emissionPoliciesForRun(appDataForEmissionPolicies([
      outsidePolicy,
      emissionPolicy(1)
    ]), loopRun).map((policy) => policy.id)).toEqual([
      "emit-change-implemented"
    ]);
  });
});
