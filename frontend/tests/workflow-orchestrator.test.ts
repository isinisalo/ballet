import { describe, expect, it } from "vitest";
import type { EventDefinition } from "../../backend/shared/domain";
import type { RoutingPolicy } from "../../backend/shared/routing-policy";
import {
  applyWorkflowToPolicy,
  buildPolicyName,
  derivePolicyWorkflows,
  eventTypesForWorkflowPolicy,
  mergeReadyProducer,
  targetAgentIdForWorkflowPolicy
} from "../src/workflow-orchestrator";

const basePolicy: RoutingPolicy = {
  id: "policy-1",
  name: "Plan approval handling",
  description: "Route approved plans.",
  active: true,
  consumes: {
    eventType: "plan.approved.v1"
  },
  dispatch: {
    operation: {
      id: "developer-agent/implement-change",
      version: 1
    }
  },
  input: {
    object: {
      workItemId: { from: "/event/subject" }
    }
  },
  selection: {
    mode: "fanout"
  },
  onInvalidInput: "skip",
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

const eventDefinition: EventDefinition = {
  id: "change-implemented",
  name: "Change implemented",
  description: "A developer completed a requested change.",
  active: true,
  eventType: "change.implemented.v1",
  source: "agentd",
  tags: [],
  dataContract: { id: "change-implemented-data", version: 1 },
  examples: [],
  producers: [
    {
      agentRole: "developer-agent",
      outcomes: ["ready"]
    }
  ],
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

describe("workflow orchestrator helpers", () => {
  it("builds automatic policy names from event type and target operation", () => {
    expect(buildPolicyName("change.implemented.v1", "architecture-reviewer/review-change")).toBe("on_change_implemented_start_architecture_reviewer_review_change_operation");
    expect(buildPolicyName("plan.approved.v1", "developer-agent/implement-change")).toBe("on_plan_approved_start_developer_agent_implement_change_operation");
  });

  it("derives workflows from routing policy edges", () => {
    const workflows = derivePolicyWorkflows([basePolicy], [eventDefinition]);

    expect(workflows).toHaveLength(1);
    expect(workflows[0]).toMatchObject({
      id: "policy-1",
      inputEventType: "plan.approved.v1",
      targetAgentId: "developer-agent/implement-change"
    });
  });

  it("applies workflow changes to consumes and dispatch fields", () => {
    const next = applyWorkflowToPolicy(basePolicy, {
      inputEventType: "review.approved.v1",
      targetAgentId: "qa-verification-reviewer/verify-change",
      outputEventType: "release.ready.v1"
    });

    expect(next).toMatchObject({
      consumes: { eventType: "review.approved.v1" },
      dispatch: { operation: { id: "qa-verification-reviewer/verify-change", version: 1 } },
      input: basePolicy.input,
      selection: { mode: "fanout" }
    });
  });

  it("reads event type and operation target from routing policy fields", () => {
    expect(eventTypesForWorkflowPolicy(basePolicy)).toEqual(["plan.approved.v1"]);
    expect(targetAgentIdForWorkflowPolicy(basePolicy)).toBe("developer-agent/implement-change");
  });

  it("does not mutate event producers for the new emission-policy model", () => {
    const next = mergeReadyProducer(eventDefinition);

    expect(next).toBe(eventDefinition);
  });
});

