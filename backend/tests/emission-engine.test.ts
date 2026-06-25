import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { evaluateEmissionPolicies } from "../emission-engine.js";
import { ContractRegistry } from "../shared/contracts.js";
import type { ContractDefinition } from "../shared/contracts.js";
import type { EventDefinition, AgentRun, RuntimeEvent } from "../shared/domain.js";
import type { EmissionPolicy } from "../shared/emission-policy.js";
import type { AgentOperation } from "../shared/operations.js";

const at = "2026-06-25T08:00:00.000Z";
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const contracts: ContractDefinition[] = [
  {
    id: "change-implemented-data",
    version: 1,
    name: "Change implemented data",
    description: "Change implemented data",
    kind: "event-data",
    active: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "gitSha", "changedFiles", "checks"],
      properties: {
        summary: { type: "string" },
        gitSha: { type: "string" },
        changedFiles: { type: "array", items: { type: "string" } },
        checks: { type: "array", items: { type: "object", additionalProperties: true } }
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
  name: "Implement change",
  description: "Implement.",
  active: true,
  agentId: "developer-agent",
  instructions: "Implement.",
  inputContract: { id: "implement-change-input", version: 1 },
  outputContract: { id: "implement-change-output", version: 1 },
  emissionRequired: true,
  createdAt: at,
  updatedAt: at
};

const run: AgentRun = {
  runId: "run-1",
  triggerEventId: "event-1",
  policyId: "policy-1",
  policyVersion: 1,
  agentRole: "developer-agent",
  operationId: operation.id,
  operationVersion: operation.version,
  inputJson: { workItemId: "work-1" },
  status: "running",
  attempt: 1,
  createdAt: at,
  updatedAt: at
};

const trigger: RuntimeEvent = {
  seq: 1,
  eventId: "event-1",
  type: "plan.approved.v1",
  source: "test",
  subject: "work-1",
  correlationId: "corr-1",
  correlationDepth: 0,
  occurredAt: at,
  projectId: "project",
  tags: [],
  payload: {},
  status: "routed"
};

const eventDefinitions: EventDefinition[] = [{
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
}];

const policy: EmissionPolicy = {
  id: "emit-change-implemented",
  version: 1,
  name: "Emit change implemented",
  description: "Emit.",
  active: true,
  observes: { operation: { id: operation.id, version: operation.version } },
  when: { path: "/output/status", op: "eq", value: "completed" },
  gates: [
    { type: "git_commit_exists", path: "/output/result/gitSha" },
    { type: "no_failed_checks", path: "/output/evidence/checks" }
  ],
  emissions: [{
    slot: "implemented",
    eventType: "change.implemented.v1",
    subject: { from: "/input/workItemId" },
    data: {
      object: {
        summary: { from: "/output/summary" },
        gitSha: { from: "/output/result/gitSha" },
        changedFiles: { from: "/output/result/changedFiles", default: [] },
        checks: { from: "/output/evidence/checks", default: [] }
      }
    }
  }],
  onGateFailure: "fail_run",
  createdAt: at,
  updatedAt: at
};

describe("emission engine", () => {
  it("explicitly emits mapped events and records gate decisions", () => {
    const result = evaluateEmissionPolicies({
      projectRoot: process.cwd(),
      operation,
      run,
      trigger,
      input: { workItemId: "work-1" },
      output: {
        status: "completed",
        summary: "Implemented.",
        result: { gitSha: head, changedFiles: ["backend/runtime-db.ts"] },
        evidence: { checks: [{ name: "npm test", status: "passed" }] }
      },
      policies: [policy],
      eventDefinitions,
      contracts: new ContractRegistry(contracts)
    });

    expect(result.events).toEqual([expect.objectContaining({
      type: "change.implemented.v1",
      subject: "work-1",
      payload: expect.objectContaining({ gitSha: head })
    })]);
    expect(result.decisions[0]?.gateDecisions.every((gate) => gate.passed)).toBe(true);
  });

  it("fails when a technical gate fails", () => {
    expect(() => evaluateEmissionPolicies({
      projectRoot: process.cwd(),
      operation,
      run,
      trigger,
      input: { workItemId: "work-1" },
      output: {
        status: "completed",
        summary: "Implemented.",
        result: { gitSha: "not-a-real-commit", changedFiles: [] },
        evidence: { checks: [{ name: "npm test", status: "passed" }] }
      },
      policies: [policy],
      eventDefinitions,
      contracts: new ContractRegistry(contracts)
    })).toThrow("Emission gate failed");
  });
});

