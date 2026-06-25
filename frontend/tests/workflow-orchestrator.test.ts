import { describe, expect, it } from "vitest";
import type { EventDefinition, Policy } from "../../backend/shared/domain";
import {
  applyWorkflowToPolicy,
  buildPolicyName,
  derivePolicyWorkflows,
  mergeReadyProducer
} from "../src/workflow-orchestrator";

const basePolicy: Policy = {
  id: "policy-1",
  name: "Plan approval handling",
  description: "Route approved plans.",
  active: true,
  match: {
    eventTypes: ["plan.approved.v1"],
    projectId: "*",
    source: "*",
    subject: { operator: "exists" },
    tags: ["planning"],
    payload: {
      "metadata.severity": { operator: "equals", value: "high" }
    }
  },
  action: {
    type: "start_agent_run",
    targetAgentId: "developer-agent"
  },
  projectId: "*",
  eventTypes: ["plan.approved.v1"],
  source: "*",
  payloadMetadata: {},
  targetAgentId: "developer-agent",
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

const outputDefinition: EventDefinition = {
  id: "change-implemented",
  name: "Change implemented",
  description: "A developer completed a requested change.",
  active: true,
  eventType: "change.implemented.v1",
  source: "agentd",
  tags: [],
  producers: [
    {
      agentRole: "developer-agent",
      outcomes: ["ready"]
    }
  ],
  payloadExample: {},
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

describe("workflow orchestrator helpers", () => {
  it("builds automatic policy names from event type and target agent", () => {
    expect(buildPolicyName("change.implemented.v1", "architecture-reviewer")).toBe("on_change_implemented_start_architecture_reviewer_agent");
    expect(buildPolicyName("plan.approved.v1", "developer-agent")).toBe("on_plan_approved_start_developer_agent");
    expect(buildPolicyName("review-approved.v12", "qa.verification--reviewer_agent")).toBe("on_review_approved_start_qa_verification_reviewer_agent");
  });

  it("derives policy workflows from policy routing and event producers", () => {
    const workflows = derivePolicyWorkflows([basePolicy], [outputDefinition]);

    expect(workflows).toHaveLength(1);
    expect(workflows[0]).toMatchObject({
      id: "policy-1",
      inputEventType: "plan.approved.v1",
      targetAgentId: "developer-agent",
      outputEventType: "change.implemented.v1"
    });
  });

  it("preserves advanced match conditions when applying workflow changes", () => {
    const next = applyWorkflowToPolicy(basePolicy, {
      inputEventType: "review.approved.v1",
      targetAgentId: "qa-agent",
      outputEventType: "release.ready.v1"
    });

    expect(next.match).toMatchObject({
      eventTypes: ["review.approved.v1"],
      projectId: "*",
      source: "*",
      subject: { operator: "exists" },
      tags: ["planning"],
      payload: {
        "metadata.severity": { operator: "equals", value: "high" }
      }
    });
    expect(next.action).toEqual({ type: "start_agent_run", targetAgentId: "qa-agent" });
    expect(next.name).toBe("on_review_approved_start_qa_agent");
    expect(next.targetAgentId).toBe("qa-agent");
  });

  it("adds a ready producer for a new agent role", () => {
    const next = mergeReadyProducer(outputDefinition, "qa-agent");

    expect(next.producers).toContainEqual({
      agentRole: "qa-agent",
      outcomes: ["ready"]
    });
    expect(outputDefinition.producers).toHaveLength(1);
  });

  it("merges ready into an existing ungated producer without duplicates", () => {
    const definition: EventDefinition = {
      ...outputDefinition,
      producers: [
        {
          agentRole: "developer-agent",
          outcomes: ["approved"]
        }
      ]
    };

    const next = mergeReadyProducer(mergeReadyProducer(definition, "developer-agent"), "developer-agent");

    expect(next.producers).toHaveLength(1);
    expect(next.producers[0]).toEqual({
      agentRole: "developer-agent",
      outcomes: ["approved", "ready"]
    });
  });
});
