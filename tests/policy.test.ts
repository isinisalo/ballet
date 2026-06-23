import { describe, expect, it } from "vitest";
import type { Agent, EventRecord, Policy } from "../shared/domain.js";
import { policyMatchesEvent, routeEvent } from "../shared/policy.js";

const event: EventRecord = {
  id: "event-1",
  projectId: "project-1",
  source: "runtime-codex",
  eventType: "deployment.failed",
  tags: ["kubernetes", "checkout"],
  payload: { metadata: { severity: "high", service: "checkout" } },
  status: "received",
  createdAt: "2026-06-23T08:00:00.000Z"
};

const policy: Policy = {
  id: "policy-1",
  name: "Kubernetes deployment failures",
  description: "Route failed Kubernetes deployments.",
  active: true,
  priority: 10,
  projectId: "project-1",
  eventTypes: ["deployment.failed"],
  tags: ["kubernetes"],
  source: "*",
  payloadMetadata: { severity: "high" },
  targetAgentId: "agent-1",
  createdAt: "2026-06-23T08:00:00.000Z",
  updatedAt: "2026-06-23T08:00:00.000Z"
};

const agent: Agent = {
  id: "agent-1",
  name: "k8s-operator",
  description: "Handles deployment failures.",
  instructions: "Triage and remediate rollout failures.",
  enabled: true,
  skills: [],
  createdAt: "2026-06-23T08:00:00.000Z",
  updatedAt: "2026-06-23T08:00:00.000Z"
};

describe("policy interpreter", () => {
  it("matches active policies by project, event type, tag, source, and payload metadata", () => {
    expect(policyMatchesEvent(policy, event)).toBe(true);
  });

  it("routes to the highest-priority enabled target agent", () => {
    const lowerPriority = { ...policy, id: "policy-2", name: "lower", priority: 1 };
    const result = routeEvent(event, [lowerPriority, policy], [agent]);

    expect(result.status).toBe("routed");
    expect(result.matchedPolicyId).toBe("policy-1");
    expect(result.assignedAgentId).toBe("agent-1");
  });

  it("marks events unassigned when no policy matches", () => {
    const result = routeEvent({ ...event, eventType: "cost.anomaly" }, [policy], [agent]);

    expect(result.status).toBe("unassigned");
    expect(result.handlingResult).toContain("No active policy matched");
  });

  it("explains when a matching policy points to a disabled agent", () => {
    const result = routeEvent(event, [policy], [{ ...agent, enabled: false }]);

    expect(result.status).toBe("unassigned");
    expect(result.handlingResult).toContain("disabled or missing");
  });
});
