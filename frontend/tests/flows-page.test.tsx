// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRun, AppData } from "../../backend/shared/domain";
import type { FlowComposerResult, FlowCreateDraft, FlowTestResult, FlowViewModel } from "../../backend/shared/flow";
import { routeFromPath } from "../src/app/routes";
import { FlowsPage } from "../src/features/flows/pages/FlowsPage";

const apiMocks = vi.hoisted(() => ({
  validateFlow: vi.fn(),
  createFlow: vi.fn(),
  updateFlow: vi.fn(),
  testFlow: vi.fn(),
  activateFlow: vi.fn(),
  pauseFlow: vi.fn()
}));

vi.mock("@/api", () => ({
  api: apiMocks
}));

const at = "2026-06-25T08:00:00.000Z";

const run = (input: Partial<AgentRun> & Pick<AgentRun, "runId" | "operationId" | "operationVersion" | "status" | "updatedAt">): AgentRun => ({
  runId: input.runId,
  triggerEventId: `${input.runId}-event`,
  policyId: input.policyId ?? "on-customer-onboarding",
  policyVersion: input.policyVersion ?? 1,
  agentRole: input.agentRole ?? "qa-agent",
  operationId: input.operationId,
  operationVersion: input.operationVersion,
  status: input.status,
  attempt: input.attempt ?? 1,
  createdAt: input.createdAt ?? at,
  updatedAt: input.updatedAt
});

const data: AppData = {
  projects: [],
  goals: [],
  adrs: [],
  agents: [
    {
      id: "developer-agent",
      name: "Developer",
      description: "Implements changes.",
      instructions: "Implement changes.",
      skills: [],
      enabled: true,
      status: "offline",
      createdAt: at,
      updatedAt: at
    },
    {
      id: "qa-agent",
      name: "QA reviewer",
      description: "Reviews launches.",
      instructions: "Review launches.",
      skills: [],
      enabled: true,
      status: "offline",
      createdAt: at,
      updatedAt: at
    }
  ],
  skills: [],
  runtimes: [],
  contracts: [
    {
      id: "customer-onboarding-trigger-data",
      version: 1,
      name: "Customer onboarding trigger data",
      description: "Data supplied when onboarding starts.",
      kind: "event-data",
      active: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["subject", "goal", "acceptanceCriteria"],
        properties: {
          subject: { type: "string", description: "Customer or launch item." },
          goal: { type: "string" },
          acceptanceCriteria: { type: "array", items: { type: "string" } }
        }
      },
      examples: [{ subject: "acme", goal: "Launch Acme", acceptanceCriteria: ["Account exists"] }],
      createdAt: at,
      updatedAt: at
    },
    {
      id: "customer-onboarding-task-input",
      version: 1,
      name: "Customer onboarding task input",
      description: "Input for preparing the customer account.",
      kind: "agent-input",
      active: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["subject", "goal", "acceptanceCriteria"],
        properties: {
          subject: { type: "string" },
          goal: { type: "string" },
          acceptanceCriteria: { type: "array", items: { type: "string" } }
        }
      },
      examples: [],
      createdAt: at,
      updatedAt: at
    },
    {
      id: "customer-onboarding-task-output",
      version: 1,
      name: "Customer onboarding task output",
      description: "Output from preparing the account.",
      kind: "agent-output",
      active: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["status", "summary"],
        properties: {
          status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
          summary: { type: "string" },
          result: {
            type: "object",
            additionalProperties: false,
            properties: {
              decision: { type: "string" },
              notes: { type: "array", items: { type: "string" } }
            }
          },
          evidence: { type: "object", properties: { checks: { type: "array", items: { type: "object" } } } }
        }
      },
      examples: [],
      createdAt: at,
      updatedAt: at
    },
    {
      id: "customer-onboarding-result-data",
      version: 1,
      name: "Customer onboarding result data",
      description: "Event data after account preparation.",
      kind: "event-data",
      active: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["summary"],
        properties: { summary: { type: "string" } }
      },
      examples: [],
      createdAt: at,
      updatedAt: at
    },
    {
      id: "customer-onboarding-verify-launch-readiness-task-input",
      version: 1,
      name: "Verify launch readiness input",
      description: "Input for the verification task.",
      kind: "agent-input",
      active: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["summary"],
        properties: { summary: { type: "string" } }
      },
      examples: [],
      createdAt: at,
      updatedAt: at
    },
    {
      id: "customer-onboarding-verify-launch-readiness-task-output",
      version: 1,
      name: "Verify launch readiness output",
      description: "Output from the verification task.",
      kind: "agent-output",
      active: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["status", "summary"],
        properties: {
          status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
          summary: { type: "string" },
          result: {
            type: "object",
            additionalProperties: false,
            properties: { decision: { type: "string" } }
          },
          evidence: { type: "object", properties: { checks: { type: "array", items: { type: "object" } } } }
        }
      },
      examples: [],
      createdAt: at,
      updatedAt: at
    },
    {
      id: "customer-onboarding-verify-launch-readiness-result-data",
      version: 1,
      name: "Customer onboarding completed data",
      description: "Terminal onboarding event data.",
      kind: "event-data",
      active: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["summary"],
        properties: {
          summary: { type: "string" },
          decision: { type: "string" }
        }
      },
      examples: [],
      createdAt: at,
      updatedAt: at
    }
  ],
  operations: [
    {
      id: "qa-agent/customer-onboarding",
      version: 1,
      name: "Prepare account",
      description: "Prepare a customer account for launch.",
      active: true,
      agentId: "qa-agent",
      instructions: "Prepare the account and capture launch evidence.",
      inputContract: { id: "customer-onboarding-task-input", version: 1 },
      outputContract: { id: "customer-onboarding-task-output", version: 1 },
      emissionRequired: true,
      createdAt: at,
      updatedAt: at
    },
    {
      id: "developer-agent/customer-onboarding-verify-launch-readiness",
      version: 1,
      name: "Verify launch readiness",
      description: "Verify the prepared account.",
      active: true,
      agentId: "developer-agent",
      instructions: "Verify the account and publish the final launch decision.",
      inputContract: { id: "customer-onboarding-verify-launch-readiness-task-input", version: 1 },
      outputContract: { id: "customer-onboarding-verify-launch-readiness-task-output", version: 1 },
      emissionRequired: true,
      createdAt: at,
      updatedAt: at
    }
  ],
  policies: [
    {
      id: "on-customer-onboarding",
      name: "When onboarding starts, prepare account",
      description: "Route the onboarding trigger to account preparation.",
      active: true,
      consumes: { eventType: "customer-onboarding.started.v1" },
      dispatch: { operation: { id: "qa-agent/customer-onboarding", version: 1 } },
      input: {
        object: {
          subject: { from: "/event/subject" },
          goal: { from: "/event/data/goal" },
          acceptanceCriteria: { from: "/event/data/acceptanceCriteria" }
        }
      },
      selection: { mode: "fanout" },
      onInvalidInput: "reject-event",
      createdAt: at,
      updatedAt: at
    },
    {
      id: "on-customer-account-prepared",
      name: "When account is prepared, verify launch readiness",
      description: "Route the prepared account event to verification.",
      active: true,
      consumes: { eventType: "customer-onboarding.completed.v1" },
      dispatch: { operation: { id: "developer-agent/customer-onboarding-verify-launch-readiness", version: 1 } },
      input: { object: { summary: { from: "/event/data/summary" } } },
      selection: { mode: "fanout" },
      onInvalidInput: "reject-event",
      createdAt: at,
      updatedAt: at
    }
  ],
  emissionPolicies: [
    {
      id: "emit-customer-account-prepared",
      version: 1,
      name: "Publish Customer account prepared",
      description: "Publish account-prepared evidence after preparation.",
      active: true,
      observes: { operation: { id: "qa-agent/customer-onboarding", version: 1 } },
      when: { path: "/output/status", op: "eq", value: "completed" },
      emissions: [{
        slot: "completed",
        eventType: "customer-onboarding.completed.v1",
        subject: { from: "/input/subject" },
        data: { object: { summary: { from: "/output/summary" } } },
        dedupeKey: { template: "prepared:{{/run/id}}" }
      }],
      onGateFailure: "fail_run",
      createdAt: at,
      updatedAt: at
    },
    {
      id: "emit-customer-onboarding-completed",
      version: 1,
      name: "Publish Customer onboarding completed",
      description: "Publish the terminal onboarding event after verification.",
      active: true,
      observes: { operation: { id: "developer-agent/customer-onboarding-verify-launch-readiness", version: 1 } },
      when: { path: "/output/status", op: "eq", value: "completed" },
      emissions: [{
        slot: "completed",
        eventType: "customer-onboarding.verify-launch-readiness.completed.v1",
        subject: { from: "/input/summary" },
        data: {
          object: {
            summary: { from: "/output/summary" },
            decision: { from: "/output/result/decision", default: "approved" }
          }
        },
        dedupeKey: { template: "completed:{{/run/id}}" }
      }],
      onGateFailure: "fail_run",
      createdAt: at,
      updatedAt: at
    }
  ],
  loopDefinitions: [
    {
      id: "customer-onboarding",
      version: 1,
      name: "Customer onboarding",
      description: "Prepare a customer account for launch.",
      active: false,
      entryEventTypes: ["customer-onboarding.started.v1"],
      terminalEventTypes: ["customer-onboarding.verify-launch-readiness.completed.v1"],
      routingPolicyIds: ["on-customer-onboarding", "on-customer-account-prepared"],
      emissionPolicyIds: ["emit-customer-account-prepared", "emit-customer-onboarding-completed"],
      limits: { maxHops: 20, maxRuns: 20, maxIterationsPerStep: 3 },
      onLimitExceeded: { eventType: "customer-onboarding.aborted.v1" },
      createdAt: at,
      updatedAt: at
    }
  ],
  loopInstances: [],
  eventDefinitions: [
    {
      id: "customer-onboarding-started-v1",
      name: "Customer onboarding started",
      description: "Starts customer onboarding.",
      active: true,
      eventType: "customer-onboarding.started.v1",
      source: "*",
      tags: ["customer-onboarding"],
      dataContract: { id: "customer-onboarding-trigger-data", version: 1 },
      examples: [{ subject: "acme", goal: "Launch Acme", acceptanceCriteria: ["Account exists"] }],
      createdAt: at,
      updatedAt: at
    },
    {
      id: "customer-onboarding-completed-v1",
      name: "Customer account prepared",
      description: "The customer account is ready for verification.",
      active: true,
      eventType: "customer-onboarding.completed.v1",
      source: "agentd",
      tags: ["customer-onboarding"],
      dataContract: { id: "customer-onboarding-result-data", version: 1 },
      examples: [{ summary: "Account prepared" }],
      createdAt: at,
      updatedAt: at
    },
    {
      id: "customer-onboarding-verify-launch-readiness-completed-v1",
      name: "Customer onboarding completed",
      description: "Customer onboarding is complete.",
      active: true,
      eventType: "customer-onboarding.verify-launch-readiness.completed.v1",
      source: "agentd",
      tags: ["customer-onboarding"],
      dataContract: { id: "customer-onboarding-verify-launch-readiness-result-data", version: 1 },
      examples: [{ summary: "Ready", decision: "approved" }],
      createdAt: at,
      updatedAt: at
    }
  ],
  events: [],
  agentRuns: []
};

const createdFlow: FlowViewModel = {
  id: "customer-onboarding",
  version: 1,
  name: "Customer onboarding",
  description: "Prepare a customer account for launch.",
  active: false,
  entryEvents: [{
    kind: "event",
    id: "event:customer-onboarding.started.v1",
    eventType: "customer-onboarding.started.v1",
    name: "Customer onboarding started",
    description: "Starts customer onboarding.",
    dataContract: { id: "customer-onboarding-trigger-data", version: 1 },
    active: true
  }],
  terminalEvents: [{
    kind: "event",
    id: "event:customer-onboarding.verify-launch-readiness.completed.v1",
    eventType: "customer-onboarding.verify-launch-readiness.completed.v1",
    name: "Customer onboarding completed",
    description: "Customer onboarding is complete.",
    dataContract: { id: "customer-onboarding-verify-launch-readiness-result-data", version: 1 },
    active: true
  }],
  nodes: [
    {
      kind: "event",
      id: "event:customer-onboarding.started.v1",
      eventType: "customer-onboarding.started.v1",
      name: "Customer onboarding started",
      description: "Starts customer onboarding.",
      dataContract: { id: "customer-onboarding-trigger-data", version: 1 },
      active: true
    },
    {
      kind: "operation",
      id: "operation:qa-agent/customer-onboarding@1",
      operationId: "qa-agent/customer-onboarding",
      version: 1,
      name: "Prepare account",
      description: "Prepare a customer account for launch.",
      agentId: "qa-agent",
      agentName: "QA reviewer",
      inputContract: { id: "customer-onboarding-task-input", version: 1 },
      outputContract: { id: "customer-onboarding-task-output", version: 1 },
      active: true
    },
    {
      kind: "event",
      id: "event:customer-onboarding.completed.v1",
      eventType: "customer-onboarding.completed.v1",
      name: "Customer account prepared",
      description: "The customer account is ready for verification.",
      dataContract: { id: "customer-onboarding-result-data", version: 1 },
      active: true
    },
    {
      kind: "operation",
      id: "operation:developer-agent/customer-onboarding-verify-launch-readiness@1",
      operationId: "developer-agent/customer-onboarding-verify-launch-readiness",
      version: 1,
      name: "Verify launch readiness",
      description: "Verify the prepared account.",
      agentId: "developer-agent",
      agentName: "Developer",
      inputContract: { id: "customer-onboarding-verify-launch-readiness-task-input", version: 1 },
      outputContract: { id: "customer-onboarding-verify-launch-readiness-task-output", version: 1 },
      active: true
    },
    {
      kind: "event",
      id: "event:customer-onboarding.verify-launch-readiness.completed.v1",
      eventType: "customer-onboarding.verify-launch-readiness.completed.v1",
      name: "Customer onboarding completed",
      description: "Customer onboarding is complete.",
      dataContract: { id: "customer-onboarding-verify-launch-readiness-result-data", version: 1 },
      active: true
    }
  ],
  edges: [
    {
      kind: "routing",
      id: "routing:on-customer-onboarding",
      from: "event:customer-onboarding.started.v1",
      to: "operation:qa-agent/customer-onboarding@1",
      policyId: "on-customer-onboarding",
      policyName: "When onboarding starts, prepare account",
      active: true
    },
    {
      kind: "emission",
      id: "emission:emit-customer-account-prepared",
      from: "operation:qa-agent/customer-onboarding@1",
      to: "event:customer-onboarding.completed.v1",
      policyId: "emit-customer-account-prepared",
      policyVersion: 1,
      slot: "completed",
      policyName: "Publish Customer account prepared",
      active: true
    },
    {
      kind: "routing",
      id: "routing:on-customer-account-prepared",
      from: "event:customer-onboarding.completed.v1",
      to: "operation:developer-agent/customer-onboarding-verify-launch-readiness@1",
      policyId: "on-customer-account-prepared",
      policyName: "When account is prepared, verify launch readiness",
      active: true
    },
    {
      kind: "emission",
      id: "emission:emit-customer-onboarding-completed",
      from: "operation:developer-agent/customer-onboarding-verify-launch-readiness@1",
      to: "event:customer-onboarding.verify-launch-readiness.completed.v1",
      policyId: "emit-customer-onboarding-completed",
      policyVersion: 1,
      slot: "completed",
      policyName: "Publish Customer onboarding completed",
      active: true
    }
  ],
  safetyLimits: { maxHops: 20, maxRuns: 20, maxIterationsPerStep: 3 },
  diagnostics: [],
  health: "ready"
};

const createdFlowV2: FlowViewModel = {
  ...createdFlow,
  version: 2,
  name: "Customer onboarding v2",
  description: "Second version of the customer onboarding Flow.",
  safetyLimits: { maxHops: 30, maxRuns: 20, maxIterationsPerStep: 3 }
};

const invalidFlow: FlowViewModel = {
  ...createdFlow,
  id: "broken-onboarding",
  name: "Broken onboarding",
  active: false,
  health: "invalid",
  diagnostics: [{
    severity: "error",
    title: "Missing task",
    explanation: "This Flow references a task that no longer exists.",
    affectedResource: { type: "operation", id: "qa-agent/missing-task", version: 1 },
    suggestedFix: "Choose an existing task before activating this Flow."
  }]
};

const notifyInputContract: AppData["contracts"][number] = {
  id: "customer-onboarding-notify-customer-task-input",
  version: 1,
  name: "Notify customer input",
  description: "Input for customer notification.",
  kind: "agent-input",
  active: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary"],
    properties: {
      summary: { type: "string" },
      decision: { type: "string" }
    }
  },
  examples: [],
  createdAt: at,
  updatedAt: at
};

const notifyOutputContract: AppData["contracts"][number] = {
  id: "customer-onboarding-notify-customer-task-output",
  version: 1,
  name: "Notify customer output",
  description: "Output from customer notification.",
  kind: "agent-output",
  active: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["status", "summary"],
    properties: {
      status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
      summary: { type: "string" },
      result: {
        type: "object",
        additionalProperties: false,
        properties: { notificationId: { type: "string" } }
      },
      evidence: { type: "object", properties: { checks: { type: "array", items: { type: "object" } } } }
    }
  },
  examples: [],
  createdAt: at,
  updatedAt: at
};

const notifiedEventContract: AppData["contracts"][number] = {
  id: "customer-onboarding-notify-customer-result-data",
  version: 1,
  name: "Customer notified data",
  description: "Terminal customer notification event data.",
  kind: "event-data",
  active: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary"],
    properties: {
      summary: { type: "string" },
      notificationId: { type: "string" }
    }
  },
  examples: [],
  createdAt: at,
  updatedAt: at
};

const notifyOperation: AppData["operations"][number] = {
  id: "qa-agent/customer-onboarding-notify-customer",
  version: 1,
  name: "Notify customer",
  description: "Notify the customer that onboarding is complete.",
  active: true,
  agentId: "qa-agent",
  instructions: "Notify the customer and capture the notification reference.",
  inputContract: { id: notifyInputContract.id, version: notifyInputContract.version },
  outputContract: { id: notifyOutputContract.id, version: notifyOutputContract.version },
  emissionRequired: true,
  createdAt: at,
  updatedAt: at
};

const notifyRoutingPolicy: AppData["policies"][number] = {
  id: "on-customer-onboarding-verified",
  name: "When onboarding is verified, notify customer",
  description: "Route the verified onboarding event to customer notification.",
  active: true,
  consumes: { eventType: "customer-onboarding.verify-launch-readiness.completed.v1" },
  dispatch: { operation: { id: notifyOperation.id, version: notifyOperation.version } },
  input: {
    object: {
      summary: { from: "/event/data/summary" },
      decision: { from: "/event/data/decision", default: "approved" }
    }
  },
  selection: { mode: "fanout" },
  onInvalidInput: "reject-event",
  createdAt: at,
  updatedAt: at
};

const notifyEmissionPolicy: AppData["emissionPolicies"][number] = {
  id: "emit-customer-notified",
  version: 1,
  name: "Publish Customer notified",
  description: "Publish the terminal customer-notified event after notification.",
  active: true,
  observes: { operation: { id: notifyOperation.id, version: notifyOperation.version } },
  when: { path: "/output/status", op: "eq", value: "completed" },
  emissions: [{
    slot: "completed",
    eventType: "customer-onboarding.notify-customer.completed.v1",
    subject: { from: "/input/summary" },
    data: {
      object: {
        summary: { from: "/output/summary" },
        notificationId: { from: "/output/result/notificationId", default: "notice-1" }
      }
    },
    dedupeKey: { template: "notified:{{/run/id}}" }
  }],
  onGateFailure: "fail_run",
  createdAt: at,
  updatedAt: at
};

const notifiedEventDefinition: AppData["eventDefinitions"][number] = {
  id: "customer-onboarding-notify-customer-completed-v1",
  name: "Customer notified",
  description: "The customer has been notified.",
  active: true,
  eventType: "customer-onboarding.notify-customer.completed.v1",
  source: "agentd",
  tags: ["customer-onboarding"],
  dataContract: { id: notifiedEventContract.id, version: notifiedEventContract.version },
  examples: [{ summary: "Customer notified", notificationId: "notice-1" }],
  createdAt: at,
  updatedAt: at
};

const notifyOperationNode: Extract<FlowViewModel["nodes"][number], { kind: "operation" }> = {
  kind: "operation",
  id: "operation:qa-agent/customer-onboarding-notify-customer@1",
  operationId: notifyOperation.id,
  version: notifyOperation.version,
  name: notifyOperation.name,
  description: notifyOperation.description,
  agentId: notifyOperation.agentId,
  agentName: "QA reviewer",
  inputContract: notifyOperation.inputContract,
  outputContract: notifyOperation.outputContract,
  active: true
};

const notifiedEventNode: Extract<FlowViewModel["nodes"][number], { kind: "event" }> = {
  kind: "event",
  id: "event:customer-onboarding.notify-customer.completed.v1",
  eventType: notifiedEventDefinition.eventType,
  name: notifiedEventDefinition.name,
  description: notifiedEventDefinition.description,
  dataContract: notifiedEventDefinition.dataContract,
  active: true
};

const threeStepData: AppData = {
  ...data,
  contracts: [...data.contracts, notifyInputContract, notifyOutputContract, notifiedEventContract],
  operations: [...data.operations, notifyOperation],
  policies: [...data.policies, notifyRoutingPolicy],
  emissionPolicies: [...data.emissionPolicies, notifyEmissionPolicy],
  loopDefinitions: [{
    ...data.loopDefinitions[0]!,
    terminalEventTypes: [notifiedEventDefinition.eventType],
    routingPolicyIds: [...data.loopDefinitions[0]!.routingPolicyIds, notifyRoutingPolicy.id],
    emissionPolicyIds: [...data.loopDefinitions[0]!.emissionPolicyIds, notifyEmissionPolicy.id]
  }],
  eventDefinitions: [...data.eventDefinitions, notifiedEventDefinition]
};

const threeStepFlow: FlowViewModel = {
  ...createdFlow,
  terminalEvents: [notifiedEventNode],
  nodes: [
    ...createdFlow.nodes,
    notifyOperationNode,
    notifiedEventNode
  ],
  edges: [
    ...createdFlow.edges,
    {
      kind: "routing",
      id: `routing:${notifyRoutingPolicy.id}`,
      from: "event:customer-onboarding.verify-launch-readiness.completed.v1",
      to: notifyOperationNode.id,
      policyId: notifyRoutingPolicy.id,
      policyName: notifyRoutingPolicy.name,
      active: true
    },
    {
      kind: "emission",
      id: `emission:${notifyEmissionPolicy.id}`,
      from: notifyOperationNode.id,
      to: notifiedEventNode.id,
      policyId: notifyEmissionPolicy.id,
      policyVersion: notifyEmissionPolicy.version,
      slot: "completed",
      policyName: notifyEmissionPolicy.name,
      active: true
    }
  ]
};

const composerResult: FlowComposerResult = {
  resources: {},
  validation: { valid: true, diagnostics: [] },
  flow: createdFlow,
  test: {
    matched: true,
    trigger: {
      name: "Customer onboarding started",
      summary: "The trigger example can route into the Flow.",
      exampleData: { subject: "acme", goal: "Launch Acme", acceptanceCriteria: ["Ready"] }
    },
    operationInputs: [{
      taskName: "Prepare account",
      agentName: "QA reviewer",
      status: "routed",
      summary: "Input mapped and passed validation.",
      input: { subject: "acme", goal: "Launch Acme", acceptanceCriteria: ["Ready"] }
    }],
    exampleOutputs: [{
      taskName: "Prepare account",
      status: "completed",
      summary: "Example completed result.",
      result: { decision: "approved" }
    }],
    resultBranches: [{
      taskName: "Prepare account",
      branchName: "Completed",
      matched: true,
      summary: "Emission policy produced events.",
      gateSummary: "Required value passed",
      gateFailureBehavior: "Fail this run"
    }],
    emittedEvents: [{
      name: "Customer account prepared",
      eventType: "customer-onboarding.completed.v1",
      subject: "acme",
      summary: "Customer account prepared would be published.",
      data: { summary: "Example completed result." }
    }],
    downstreamTasks: [{
      taskName: "Verify launch readiness",
      agentName: "Developer",
      summary: "Customer account prepared can continue to Verify launch readiness."
    }],
    diagnostics: [],
    trace: [
      { title: "Trigger checked", summary: "Customer onboarding started uses example data and can start this Flow." },
      { title: "Operation input mapped", summary: "Prepare account receives 3 mapped fields." },
      { title: "Input validated", summary: "Prepare account input matches its contract." },
      { title: "Result branch matched", summary: "Completed branch would publish Customer account prepared." }
    ]
  }
};

const testResult: FlowTestResult = {
  flowId: createdFlow.id,
  matched: true,
  trace: [
    { title: "Trigger checked", summary: "Customer onboarding started uses example data and can start this Flow." },
    { title: "Operation input mapped", summary: "Prepare account receives 3 mapped fields." },
    { title: "Input validated", summary: "Prepare account input matches its contract." },
    { title: "Result branch matched", summary: "Completed matched for Prepare account." },
    { title: "Event emitted", summary: "Customer account prepared would be published." }
  ],
  routing: {},
  diagnostics: []
};

function Harness() {
  const [flows, setFlows] = useState<FlowViewModel[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | undefined>();
  const [selectedFlowVersion, setSelectedFlowVersion] = useState<number | undefined>();
  return (
    <FlowsPage
      data={data}
      flows={flows}
      selectedFlowId={selectedFlowId}
      selectedFlowVersion={selectedFlowVersion}
      refresh={async () => setFlows([createdFlow])}
      navigate={(path) => {
        const route = routeFromPath(path);
        if (route.main === "flows") {
          setSelectedFlowId(route.id);
          setSelectedFlowVersion(route.version);
        }
      }}
    />
  );
}

beforeEach(() => {
  apiMocks.validateFlow.mockReset();
  apiMocks.createFlow.mockReset();
  apiMocks.updateFlow.mockReset();
  apiMocks.testFlow.mockReset();
  apiMocks.activateFlow.mockReset();
  apiMocks.pauseFlow.mockReset();
  apiMocks.validateFlow.mockResolvedValue(composerResult);
  apiMocks.createFlow.mockResolvedValue(createdFlow);
  apiMocks.updateFlow.mockResolvedValue({
    ...createdFlow,
    name: "Customer launch readiness",
    safetyLimits: { maxHops: 12, maxRuns: 6, maxIterationsPerStep: 2, deadlineSeconds: 3600 }
  });
  apiMocks.testFlow.mockResolvedValue(testResult);
  apiMocks.activateFlow.mockResolvedValue({ ...createdFlow, active: true });
});

afterEach(() => {
  cleanup();
});

describe("FlowsPage human UI", () => {
  it("shows the newest Flow run status in plain language in the catalog", () => {
    const dataWithRuns: AppData = {
      ...data,
      agentRuns: [
        run({
          runId: "older-prepare-run",
          operationId: "qa-agent/customer-onboarding",
          operationVersion: 1,
          status: "completed",
          updatedAt: "2026-06-25T09:00:00.000Z"
        }),
        run({
          runId: "newer-verify-run",
          agentRole: "developer-agent",
          operationId: "developer-agent/customer-onboarding-verify-launch-readiness",
          operationVersion: 1,
          status: "needs_input",
          updatedAt: "2026-06-25T10:00:00.000Z"
        })
      ]
    };

    render(<FlowsPage data={dataWithRuns} flows={[createdFlow]} selectedFlowId={createdFlow.id} selectedFlowVersion={createdFlow.version} refresh={async () => undefined} navigate={vi.fn()} />);

    const catalog = screen.getByText("Flow Catalog").closest("section");
    expect(within(catalog!).getByText("Most recent run: Needs input")).toBeVisible();
    expect(within(catalog!).queryByText("Most recent run: completed")).not.toBeInTheDocument();
    expect(within(catalog!).queryByText("Most recent run: needs_input")).not.toBeInTheDocument();
  });

  it("lets a normal user create, test, and activate a Flow without raw editors", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getAllByRole("button", { name: /create flow/i })[0]!);
    expect(screen.queryByText(/json schema|json pointer|yaml editor|raw json/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Flow name"), "Customer onboarding");
    await user.type(screen.getByLabelText("Purpose"), "Prepare a customer account for launch.");
    await user.click(screen.getByText("Optional details"));
    await user.type(screen.getAllByLabelText("Description")[0]!, "Create the launch-ready customer account.");
    await user.selectOptions(screen.getByLabelText("Agent"), "qa-agent");
    await user.type(screen.getByLabelText("Task name"), "Prepare account");
    await user.type(screen.getByLabelText("Task instructions"), "Prepare the account and capture launch evidence.");

    const triggerField = screen.getByDisplayValue("requirements");
    await user.clear(triggerField);
    await user.type(triggerField, "acceptanceCriteria");

    await user.click(screen.getByRole("button", { name: /auto-map/i }));
    const inputPreview = screen.getByText("Live operation input preview").closest("div");
    expect(inputPreview).toBeTruthy();
    expect(within(inputPreview!).getByText("Example subject")).toBeVisible();
    expect(within(inputPreview!).getAllByText("Goal")).toHaveLength(2);
    expect(within(inputPreview!).getByText("[\"Example\"]")).toBeVisible();
    await user.clear(screen.getByLabelText("Published event"));
    await user.type(screen.getByLabelText("Published event"), "Customer account prepared");
    await user.clear(screen.getByLabelText("Event description"));
    await user.type(screen.getByLabelText("Event description"), "The customer account is ready for verification.");

    await user.click(screen.getByRole("button", { name: /add next agent task/i }));
    await user.selectOptions(screen.getByLabelText("Next agent"), "developer-agent");
    await user.type(screen.getByLabelText("Next task name"), "Verify launch readiness");
    await user.type(screen.getByLabelText("Next task instructions"), "Verify the account and publish the final launch decision.");
    expect(screen.getByText("Next input mapping")).toBeVisible();
    const publishedEventFields = screen.getAllByLabelText("Published event");
    const eventDescriptionFields = screen.getAllByLabelText("Event description");
    await user.clear(publishedEventFields[1]!);
    await user.type(publishedEventFields[1]!, "Customer onboarding completed");
    await user.clear(eventDescriptionFields[1]!);
    await user.type(eventDescriptionFields[1]!, "The customer account is ready.");

    expect(screen.getByLabelText("Maximum steps")).toHaveValue(20);
    expect(screen.getByLabelText("Maximum agent runs")).toHaveValue(20);
    expect(screen.getByLabelText("Maximum repetitions of one step")).toHaveValue(3);
    expect(screen.getByLabelText("Maximum duration")).toHaveValue(86400);
    expect(screen.getByLabelText("Limit-exceeded behavior")).toHaveValue("publish");

    await user.click(screen.getByRole("button", { name: /^test$/i }));
    expect(await screen.findByText("Flow can be saved")).toBeVisible();
    expect(screen.getByText(/valid trigger, 2 agent tasks, input mappings, and result events/i)).toBeVisible();
    expect(screen.getByText("Trigger test")).toBeVisible();
    expect(screen.getByText("Example trigger data")).toBeVisible();
    expect(screen.getByText("Operation input: Prepare account")).toBeVisible();
    expect(screen.getByText("Input valid")).toBeVisible();
    expect(screen.getByText("Mapped operation input")).toBeVisible();
    expect(screen.getByText("Example operation output: Prepare account")).toBeVisible();
    expect(screen.getByText("Matching result branch: Completed")).toBeVisible();
    expect(screen.getByText("Emitted event: Customer account prepared")).toBeVisible();
    expect(screen.getByText("Downstream tasks")).toBeVisible();
    expect(screen.getByText("Plain-language trace")).toBeVisible();

    const draftDetails = screen.getByText("Technical details").closest("details");
    expect(draftDetails).not.toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: /save flow/i }));
    expect(await screen.findByRole("heading", { name: "Customer onboarding" })).toBeVisible();
    expect(apiMocks.createFlow).toHaveBeenCalledWith(expect.objectContaining({
      name: "Customer onboarding",
      agentTask: expect.objectContaining({
        agentId: "qa-agent",
        name: "Prepare account"
      }),
      resultEvent: expect.objectContaining({
        name: "Customer account prepared"
      }),
      followUpTasks: [expect.objectContaining({
        agentId: "developer-agent",
        name: "Verify launch readiness",
        resultEvent: expect.objectContaining({
          name: "Customer onboarding completed"
        }),
        inputMapping: expect.objectContaining({
          object: expect.objectContaining({
            summary: expect.objectContaining({ from: "/event/data/summary" })
          })
        })
      })],
      safetyLimits: {
        maxHops: 20,
        maxRuns: 20,
        maxIterationsPerStep: 3,
        deadlineSeconds: 86400
      },
      limitExceeded: expect.objectContaining({
        enabled: true,
        name: "Customer onboarding limit exceeded",
        description: "Published when Customer onboarding stops because a safety limit is exceeded."
      }),
      inputMapping: expect.objectContaining({
        object: expect.objectContaining({
          acceptanceCriteria: expect.objectContaining({ from: "/event/data/acceptanceCriteria" })
        })
      })
    }));
    expect(screen.getByText("Verify launch readiness")).toBeVisible();
    expect(screen.getByText("Trigger inspector")).toBeVisible();
    expect(screen.getByText("When this happens")).toBeVisible();
    expect(screen.getByText("Example data")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /GIVE THE AGENT\s+Input mapping\s+Customer onboarding started data for Prepare account/i }));
    expect(screen.getByText("Routing inspector")).toBeVisible();
    expect(screen.getByText("Give the agent")).toBeVisible();
    expect(screen.getByText("Field mappings")).toBeVisible();
    expect(screen.getByText("Acceptance Criteria")).toBeVisible();
    expect(screen.getByText("Trigger data: Acceptance Criteria")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /ASK\s+QA reviewer\s+Prepare account/i }));
    expect(screen.getByText("Operation inspector")).toBeVisible();
    expect(screen.getByText("Ask this agent")).toBeVisible();
    expect(screen.getByText("Task instructions")).toBeVisible();
    expect(screen.getByText("Prepare the account and capture launch evidence.")).toBeVisible();
    expect(screen.getByText("Required input fields")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /WHEN COMPLETED\s+Customer account prepared/i }));
    expect(screen.getByText("Result inspector")).toBeVisible();
    expect(screen.getByText("When completed")).toBeVisible();
    expect(screen.getByText("Event field mappings")).toBeVisible();
    expect(screen.getByText("Gate failure behavior")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /flow settings/i }));
    const settingsName = screen.getByLabelText("Flow name");
    expect(settingsName).toHaveValue("Customer onboarding");
    await user.clear(settingsName);
    await user.type(settingsName, "Customer launch readiness");
    const settingsMaxSteps = screen.getByLabelText("Maximum steps");
    expect(settingsMaxSteps).toHaveValue(20);
    await user.clear(settingsMaxSteps);
    await user.type(settingsMaxSteps, "12");
    const settingsMaxRuns = screen.getByLabelText("Maximum agent runs");
    await user.clear(settingsMaxRuns);
    await user.type(settingsMaxRuns, "6");
    const settingsMaxRepetitions = screen.getByLabelText("Maximum repetitions of one step");
    await user.clear(settingsMaxRepetitions);
    await user.type(settingsMaxRepetitions, "2");
    const settingsMaxDuration = screen.getByLabelText("Maximum duration");
    await user.clear(settingsMaxDuration);
    await user.type(settingsMaxDuration, "3600");
    expect(screen.getByLabelText("Limit-exceeded behavior")).toHaveValue("publish");
    await user.type(screen.getByLabelText("Limit-exceeded event"), "Customer onboarding aborted");
    await user.click(screen.getByRole("button", { name: /save settings/i }));
    expect(apiMocks.updateFlow).toHaveBeenCalledWith(
      createdFlow.id,
      expect.objectContaining({
        name: "Customer launch readiness",
        safetyLimits: {
          maxHops: 12,
          maxRuns: 6,
          maxIterationsPerStep: 2,
          deadlineSeconds: 3600
        },
        limitExceeded: expect.objectContaining({
          enabled: true,
          name: "Customer onboarding aborted"
        })
      }),
      createdFlow.version
    );

    const flowDetailsSummary = screen.getAllByText("Technical details").at(-1)!;
    const flowDetails = flowDetailsSummary.closest("details");
    expect(flowDetails).not.toHaveAttribute("open");
    expect(within(flowDetails!).getByText(/operationId/)).not.toBeVisible();
    await user.click(flowDetailsSummary);
    expect(within(flowDetails!).getByText(/operationId/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: /^test$/i }));
    expect(await screen.findByText("Test matched the trigger")).toBeVisible();
    expect(apiMocks.testFlow).toHaveBeenCalledWith(createdFlow.id, {}, createdFlow.version);
    expect(screen.getByText("Trigger checked")).toBeVisible();
    expect(screen.getByText("Operation input mapped")).toBeVisible();
    expect(screen.getByText("Result branch matched")).toBeVisible();
    expect(screen.getByText("Event emitted")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /activate/i }));
    expect(apiMocks.activateFlow).toHaveBeenCalledWith(createdFlow.id, createdFlow.version);
  }, 20_000);

  it("lets a normal user reuse an existing trigger and agent task when creating a Flow", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getAllByRole("button", { name: /create flow/i })[0]!);
    await user.type(screen.getByLabelText("Flow name"), "Customer onboarding");
    await user.type(screen.getByLabelText("Purpose"), "Reuse the existing onboarding task.");
    await user.selectOptions(screen.getByLabelText("Trigger"), "customer-onboarding-started-v1");
    await user.selectOptions(screen.getByLabelText("Agent task"), "qa-agent/customer-onboarding");
    const eventToPublish = screen.getByLabelText("Result event");
    await user.selectOptions(
      eventToPublish,
      within(eventToPublish).getByRole("option", { name: "Customer account prepared" })
    );

    await user.click(screen.getByText("Optional details"));
    expect(screen.getByDisplayValue("acceptanceCriteria")).toBeVisible();
    expect(screen.getByLabelText("Task name")).toHaveValue("Prepare account");
    expect(screen.getByLabelText("Agent")).toHaveValue("qa-agent");
    expect(screen.getByLabelText("Task instructions")).toHaveValue("Prepare the account and capture launch evidence.");

    await user.click(screen.getByRole("button", { name: /save flow/i }));

    const selectedDraft = apiMocks.createFlow.mock.calls.at(-1)?.[0] as FlowCreateDraft;
    expect(selectedDraft.trigger).toEqual(expect.objectContaining({
      eventId: "customer-onboarding-started-v1"
    }));
    expect(selectedDraft.agentTask).toEqual(expect.objectContaining({
      operationId: "qa-agent/customer-onboarding",
      agentId: "qa-agent",
      name: "Prepare account",
      instructions: "Prepare the account and capture launch evidence."
    }));
    expect(selectedDraft.inputMapping).toEqual(expect.objectContaining({
      object: expect.objectContaining({
        subject: expect.objectContaining({ from: "/event/subject" }),
        goal: expect.objectContaining({ from: "/event/data/goal" }),
        acceptanceCriteria: expect.objectContaining({ from: "/event/data/acceptanceCriteria" })
      })
    }));
    expect(selectedDraft.resultEvent).toEqual(expect.objectContaining({
      eventId: "customer-onboarding-completed-v1",
      name: "Customer account prepared",
      subjectField: "subject"
    }));
  });

  it("exposes labels, keyboard focus, validation messages, and branch controls", async () => {
    const user = userEvent.setup();
    render(<FlowsPage data={data} flows={[]} refresh={async () => undefined} navigate={() => undefined} />);

    await user.tab();
    expect(screen.getAllByRole("button", { name: /create flow/i })[0]).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByLabelText("Flow name")).toBeVisible();
    expect(screen.getByLabelText("Purpose")).toBeVisible();
    expect(screen.getByLabelText("Trigger")).toBeVisible();
    expect(screen.getByLabelText("Agent task")).toBeVisible();
    expect(screen.getByLabelText("Result event")).toBeVisible();
    expect(screen.getByText("Optional details").closest("details")).not.toHaveAttribute("open");
    await user.click(screen.getByText("Optional details"));
    expect(screen.getByLabelText("Agent")).toBeVisible();
    expect(screen.getByLabelText("Published event")).toBeVisible();
    expect(screen.getByLabelText("Result field")).toBeVisible();
    expect(screen.getByLabelText("Condition")).toBeVisible();
    expect(screen.getByLabelText("Value source for subject")).toBeVisible();
    expect(screen.getByLabelText("Subject source")).toBeVisible();
    expect(screen.getByLabelText("Gate failure behavior")).toBeVisible();
    expect(screen.getByLabelText(/Require summary before publishing/)).toBeVisible();
    expect(screen.getByLabelText("Maximum steps")).toBeVisible();
    expect(screen.getByLabelText("Maximum agent runs")).toBeVisible();
    expect(screen.getByLabelText("Maximum repetitions of one step")).toBeVisible();
    expect(screen.getByLabelText("Maximum duration")).toBeVisible();
    expect(screen.getByLabelText("Limit-exceeded behavior")).toBeVisible();
    expect(screen.getByLabelText("Limit-exceeded event")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /save flow/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Flow name is required.");
  });

  it("keeps Flow actions scoped to the selected version", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(
      <FlowsPage
        data={data}
        flows={[createdFlow, createdFlowV2]}
        selectedFlowId={createdFlow.id}
        selectedFlowVersion={createdFlowV2.version}
        refresh={async () => undefined}
        navigate={navigate}
      />
    );

    expect(screen.getByRole("heading", { name: "Customer onboarding v2" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^test$/i }));
    expect(apiMocks.testFlow).toHaveBeenCalledWith(createdFlowV2.id, {}, createdFlowV2.version);

    await user.click(screen.getByRole("button", { name: /activate/i }));
    expect(apiMocks.activateFlow).toHaveBeenCalledWith(createdFlowV2.id, createdFlowV2.version);

    await user.click(screen.getByRole("button", { name: /Customer onboarding v2/i }));
    expect(navigate).toHaveBeenLastCalledWith("/flows/customer-onboarding?version=2");
  });

  it("blocks activation for a Flow with configuration errors", async () => {
    const user = userEvent.setup();
    render(<FlowsPage data={data} flows={[invalidFlow]} selectedFlowId={invalidFlow.id} refresh={async () => undefined} navigate={() => undefined} />);

    expect(screen.getByText("Cannot run")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Fix missing task before activating this Flow.");

    const activateButton = screen.getByRole("button", { name: /activate/i });
    expect(activateButton).toBeDisabled();
    await user.click(activateButton);
    expect(apiMocks.activateFlow).not.toHaveBeenCalled();
  });

  it("prefills the create wizard from canonical resources when duplicating a Flow", async () => {
    const user = userEvent.setup();
    render(<FlowsPage data={data} flows={[createdFlow]} selectedFlowId={createdFlow.id} refresh={async () => undefined} navigate={() => undefined} />);

    await user.click(screen.getByRole("button", { name: /duplicate/i }));
    const wizard = screen.getByTestId("create-flow-wizard");
    await user.click(within(wizard).getByText("Optional details"));

    expect(within(wizard).getByLabelText("Flow name")).toHaveValue("Copy of Customer onboarding");
    expect(within(wizard).getByLabelText("Purpose")).toHaveValue("Prepare a customer account for launch.");
    expect(within(wizard).getByLabelText("Task name")).toHaveValue("Prepare account");
    expect(within(wizard).getByLabelText("Agent")).toHaveValue("qa-agent");
    expect(within(wizard).getByLabelText("Task instructions")).toHaveValue("Prepare the account and capture launch evidence.");
    expect(within(wizard).getByDisplayValue("acceptanceCriteria")).toBeVisible();
    expect(within(wizard).getAllByLabelText("Published event")[0]).toHaveValue("Customer account prepared");
    expect(within(wizard).getByRole("button", { name: /remove next task/i })).toBeVisible();
    expect(within(wizard).getByLabelText("Next task name")).toHaveValue("Verify launch readiness");
    expect(within(wizard).getByLabelText("Next agent")).toHaveValue("developer-agent");
    expect(within(wizard).getAllByLabelText("Published event")[1]).toHaveValue("Customer onboarding completed");
    expect(within(wizard).getByLabelText("Maximum steps")).toHaveValue(20);
    expect(within(wizard).getByLabelText("Limit-exceeded event")).toHaveValue("Copy of Customer onboarding limit exceeded");
    expect(screen.queryByText(/json schema|json pointer|yaml editor|raw json/i)).not.toBeInTheDocument();

    await user.click(within(wizard).getByRole("button", { name: /save flow/i }));
    const duplicatedDraft = apiMocks.createFlow.mock.calls.at(-1)?.[0] as FlowCreateDraft;
    expect(duplicatedDraft.id).toBeUndefined();
    expect(duplicatedDraft.name).toBe("Copy of Customer onboarding");
    expect(duplicatedDraft.active).toBe(false);
    expect(duplicatedDraft.trigger?.fields).toContainEqual(expect.objectContaining({
      name: "acceptanceCriteria",
      type: "text-list",
      required: true
    }));
    expect(duplicatedDraft.agentTask).toEqual(expect.objectContaining({
      agentId: "qa-agent",
      name: "Prepare account",
      instructions: "Prepare the account and capture launch evidence."
    }));
    expect(duplicatedDraft.inputMapping).toEqual(expect.objectContaining({
      object: expect.objectContaining({
        subject: expect.objectContaining({ from: "/event/subject" }),
        acceptanceCriteria: expect.objectContaining({ from: "/event/data/acceptanceCriteria" })
      })
    }));
    expect(duplicatedDraft.resultEvent).toEqual(expect.objectContaining({
      name: "Customer account prepared",
      subjectField: "subject",
      requireSummaryGate: false,
      onGateFailure: "fail_run"
    }));
    expect(duplicatedDraft.followUpTasks?.[0]).toEqual(expect.objectContaining({
      agentId: "developer-agent",
      name: "Verify launch readiness",
      inputMapping: expect.objectContaining({
        object: expect.objectContaining({
          summary: expect.objectContaining({ from: "/event/data/summary" })
        })
      }),
      resultEvent: expect.objectContaining({
        name: "Customer onboarding completed",
        subjectField: "summary"
      })
    }));
    expect(duplicatedDraft.safetyLimits).toEqual({
      maxHops: 20,
      maxRuns: 20,
      maxIterationsPerStep: 3
    });
    expect(duplicatedDraft.limitExceeded).toEqual(expect.objectContaining({
      enabled: true,
      name: "Copy of Customer onboarding limit exceeded"
    }));
  });

  it("opens an existing Flow in edit mode and saves an id-bearing visual draft", async () => {
    const user = userEvent.setup();
    render(<FlowsPage data={data} flows={[createdFlow]} selectedFlowId={createdFlow.id} refresh={async () => undefined} navigate={() => undefined} />);

    await user.click(screen.getByRole("button", { name: /edit flow/i }));
    const wizard = screen.getByTestId("create-flow-wizard");

    expect(within(wizard).getByText("Edit Flow")).toBeVisible();
    expect(within(wizard).getByLabelText("Flow name")).toHaveValue("Customer onboarding");
    const instructions = within(wizard).getByLabelText("Task instructions");
    await user.clear(instructions);
    await user.type(instructions, "Prepare the account and capture launch risk.");

    await user.click(within(wizard).getByRole("button", { name: /save flow/i }));
    const editDraft = apiMocks.createFlow.mock.calls.at(-1)?.[0] as FlowCreateDraft;
    expect(editDraft.id).toBe(createdFlow.id);
    expect(editDraft.name).toBe("Customer onboarding");
    expect(editDraft.active).toBe(createdFlow.active);
    expect(editDraft.agentTask).toEqual(expect.objectContaining({
      agentId: "qa-agent",
      name: "Prepare account",
      instructions: "Prepare the account and capture launch risk."
    }));
    expect(editDraft.trigger?.fields).toContainEqual(expect.objectContaining({
      name: "acceptanceCriteria",
      type: "text-list",
      required: true
    }));
  });

  it("preserves every sequential follow-up task when duplicating a longer Flow", async () => {
    const user = userEvent.setup();
    render(<FlowsPage data={threeStepData} flows={[threeStepFlow]} selectedFlowId={threeStepFlow.id} refresh={async () => undefined} navigate={() => undefined} />);

    await user.click(screen.getByRole("button", { name: /duplicate/i }));
    const wizard = screen.getByTestId("create-flow-wizard");

    const nextTaskNames = within(wizard).getAllByLabelText("Next task name");
    expect(nextTaskNames).toHaveLength(2);
    expect(nextTaskNames[0]).toHaveValue("Verify launch readiness");
    expect(nextTaskNames[1]).toHaveValue("Notify customer");
    const nextAgents = within(wizard).getAllByLabelText("Next agent");
    expect(nextAgents[0]).toHaveValue("developer-agent");
    expect(nextAgents[1]).toHaveValue("qa-agent");
    expect(within(wizard).getAllByText("Next input mapping")).toHaveLength(2);
    expect(within(wizard).getAllByRole("button", { name: /remove next task/i })).toHaveLength(2);

    await user.click(within(wizard).getByRole("button", { name: /save flow/i }));
    const duplicatedDraft = apiMocks.createFlow.mock.calls.at(-1)?.[0] as FlowCreateDraft;
    expect(duplicatedDraft.followUpTasks).toHaveLength(2);
    expect(duplicatedDraft.followUpTasks?.map((task) => task.name)).toEqual([
      "Verify launch readiness",
      "Notify customer"
    ]);
    expect(duplicatedDraft.followUpTasks?.[1]).toEqual(expect.objectContaining({
      agentId: "qa-agent",
      instructions: "Notify the customer and capture the notification reference.",
      inputMapping: expect.objectContaining({
        object: expect.objectContaining({
          summary: expect.objectContaining({ from: "/event/data/summary" }),
          decision: expect.objectContaining({ from: "/event/data/decision", default: "approved" })
        })
      }),
      resultEvent: expect.objectContaining({
        name: "Customer notified",
        subjectField: "summary"
      })
    }));
    expect(duplicatedDraft.followUpTasks?.[1]?.resultEvent?.fields).toContainEqual(expect.objectContaining({
      name: "notificationId",
      type: "text"
    }));
  });
});
