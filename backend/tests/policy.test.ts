import { describe, expect, it } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import type { Policy } from "../../shared/domain/automation.js";
import type { EventRecord } from "../../shared/domain/events.js";
import { policyMatchesEvent, policyVersion, routeEvent } from "../../shared/policy.js";

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
  projectId: "project-1",
  eventTypes: ["deployment.failed"],
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
  it("matches active policies by project, event type, source, and payload metadata", () => {
    expect(policyMatchesEvent(policy, event)).toBe(true);
  });

  it("does not require event tags for policy matching", () => {
    expect(policyMatchesEvent(policy, { ...event, tags: [] })).toBe(true);
  });

  it("routes deterministically by policy name without priority", () => {
    const laterPolicy = { ...policy, id: "policy-2", name: "Zulu policy" };
    const result = routeEvent(event, [laterPolicy, policy], [agent]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      status: "routed",
      policyId: "policy-1",
      targetAgentId: "agent-1"
    });
  });

  it("marks events unassigned when no policy matches", () => {
    const result = routeEvent({ ...event, eventType: "cost.anomaly" }, [policy], [agent]);

    expect(result).toEqual([]);
  });

  it("does not match policies without exactly one explicit event type", () => {
    const wildcardPolicy = {
      ...policy,
      eventTypes: [],
      match: {
        projectId: "*",
        source: "*",
        eventTypes: []
      }
    };

    expect(policyMatchesEvent(wildcardPolicy, event)).toBe(false);
    expect(routeEvent(event, [wildcardPolicy], [agent])).toEqual([]);

    const multiEventPolicy = {
      ...policy,
      eventTypes: ["deployment.failed", "deployment.succeeded"],
      match: {
        projectId: "*",
        source: "*",
        eventTypes: ["deployment.failed", "deployment.succeeded"]
      }
    };

    expect(policyMatchesEvent(multiEventPolicy, event)).toBe(false);
    expect(routeEvent(event, [multiEventPolicy], [agent])).toEqual([]);
  });

  it("explains when a matching policy points to a disabled agent", () => {
    const result = routeEvent(event, [policy], [{ ...agent, enabled: false }]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      status: "skipped",
      policyId: "policy-1",
      targetAgentId: "agent-1"
    });
    expect(result[0]?.reason).toContain("disabled or missing");
  });

  it("matches typed predicates across envelope, tags, and payload paths", () => {
    const typedPolicy: Policy = {
      ...policy,
      payloadMetadata: {},
      match: {
        eventTypes: ["deployment.failed"],
        projectId: { operator: "equals", value: "project-1" },
        source: { operator: "in", value: ["runtime-codex", "runtime-copilot"] },
        subject: { operator: "exists" },
        tags: { operator: "in", value: ["kubernetes"] },
        payload: {
          "metadata.severity": { operator: "equals", value: "high" },
          "metadata.service": { operator: "exists" }
        }
      }
    };

    expect(policyMatchesEvent(typedPolicy, { ...event, subject: "checkout" })).toBe(true);
    expect(policyMatchesEvent(typedPolicy, { ...event, subject: "checkout", tags: ["finops"] })).toBe(false);
  });

  it("changes policy version when match content changes", () => {
    const baseVersion = policyVersion(policy);
    const nextVersion = policyVersion({
      ...policy,
      match: {
        eventTypes: ["deployment.failed"],
        payload: { "metadata.severity": { operator: "equals", value: "critical" } }
      }
    });

    expect(nextVersion).not.toBe(baseVersion);
  });
});
