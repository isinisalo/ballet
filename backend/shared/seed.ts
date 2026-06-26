import type { AppData } from "./domain.js";

const now = "2026-06-23T08:00:00.000Z";

export const seedData: AppData = {
  projects: [
    {
      id: "project-platform",
      name: "Acme Platform Migration",
      description: "Modernize the application platform while recording goals, decisions, and routed operational events.",
      status: "active",
      createdAt: now,
      updatedAt: now
    }
  ],
  goals: [
    {
      id: "goal-k8s",
      projectId: "project-platform",
      title: "Migrate API services to Kubernetes",
      description: "Move priority services to the shared cluster with service ownership docs.",
      status: "in-progress",
      targetDate: "2026-07-31",
      owner: "platform-team",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "goal-observability",
      projectId: "project-platform",
      title: "Improve deployment observability",
      description: "Emit deployment events and route failures to the right agent.",
      status: "at-risk",
      targetDate: "2026-08-15",
      owner: "sre-team",
      createdAt: now,
      updatedAt: now
    }
  ],
  adrs: [
    {
      id: "adr-codex-cli",
      projectId: "project-platform",
      title: "Use Codex CLI as the first runtime",
      context: "The MVP needs a real execution environment model without committing to plugin execution.",
      decision: "Store Codex CLI as a configurable runtime with command, config, enabled state, and timestamps.",
      consequences: "Future runtimes can add configuration fields without changing event routing semantics.",
      status: "accepted",
      createdAt: now,
      updatedAt: now
    }
  ],
  agents: [
    {
      id: "agent-k8s",
      name: "k8s-operator",
      description: "Handles Kubernetes deployment and readiness failures.",
      instructions: "Inspect deployment payloads, identify failing service and namespace, then recommend remediation steps.",
      enabled: true,
      status: "offline",
      createdAt: now,
      updatedAt: now,
      skills: [
        {
          id: "skill-kubernetes",
          name: "Kubernetes triage",
          description: "Reads deployment, pod, and namespace metadata from event payloads.",
          metadata: { domain: "platform" }
        },
        {
          id: "skill-remediation",
          name: "Remediation planning",
          description: "Produces concise operator actions for failed rollouts.",
          metadata: { output: "runbook" }
        }
      ]
    },
    {
      id: "agent-architect",
      name: "platform-architect",
      description: "Reviews architectural decisions and policy-impacting events.",
      instructions: "Connect events back to project goals and ADRs, then propose a decision record when needed.",
      enabled: true,
      status: "offline",
      createdAt: now,
      updatedAt: now,
      skills: [
        {
          id: "skill-adr",
          name: "ADR writing",
          description: "Drafts Architecture Decision Records with context, decision, and consequences.",
          metadata: { artifact: "adr" }
        }
      ]
    }
  ],
  skills: [],
  runtimes: [
    {
      id: "runtime-codex",
      name: "codex-cli",
      type: "codex-cli",
      command: "codex",
      config: { cwd: ".", approvalPolicy: "never" },
      enabled: true,
      createdAt: now,
      updatedAt: now
    }
  ],
  contracts: [
    {
      id: "deployment-failed-data",
      version: 1,
      name: "Deployment failed data",
      description: "Deployment failure event data.",
      kind: "event-data",
      active: true,
      schema: { type: "object", additionalProperties: true },
      examples: [{ metadata: { severity: "high", service: "checkout-service" } }],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "k8s-remediation-input",
      version: 1,
      name: "Kubernetes remediation input",
      description: "Mapped input for Kubernetes remediation.",
      kind: "agent-input",
      active: true,
      schema: { type: "object", additionalProperties: true },
      examples: [{ severity: "high", service: "checkout-service" }],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "k8s-remediation-output",
      version: 1,
      name: "Kubernetes remediation output",
      description: "Generic operation output.",
      kind: "agent-output",
      active: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["status", "summary"],
        properties: {
          status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
          summary: { type: "string" },
          result: { type: "object", additionalProperties: true }
        }
      },
      examples: [{ status: "completed", summary: "Remediation drafted." }],
      createdAt: now,
      updatedAt: now
    }
  ],
  operations: [
    {
      id: "agent-k8s/remediate-deployment",
      version: 1,
      name: "Remediate deployment failure",
      description: "Investigate and remediate a failed deployment.",
      active: true,
      agentId: "agent-k8s",
      instructions: "Inspect mapped deployment failure input and return remediation output.",
      inputContract: { id: "k8s-remediation-input", version: 1 },
      outputContract: { id: "k8s-remediation-output", version: 1 },
      emissionRequired: false,
      createdAt: now,
      updatedAt: now
    }
  ],
  policies: [
    {
      id: "policy-deploy-fail",
      name: "Deployment failures to k8s operator",
      description: "Route Kubernetes deployment failures to the operator agent.",
      active: true,
      consumes: { eventType: "deployment.failed" },
      when: { path: "/event/data/metadata/severity", op: "eq", value: "high" },
      dispatch: { operation: { id: "agent-k8s/remediate-deployment", version: 1 } },
      input: {
        object: {
          severity: { from: "/event/data/metadata/severity" },
          service: { from: "/event/data/metadata/service" },
          namespace: { from: "/event/data/namespace", default: "" },
          pod: { from: "/event/data/pod", default: "" }
        }
      },
      createdAt: now,
      updatedAt: now
    }
  ],
  emissionPolicies: [],
  loopDefinitions: [],
  loopInstances: [],
  eventDefinitions: [
    {
      id: "deployment-failed",
      name: "Deployment failed",
      description: "A deployment failed and can be routed to an operator.",
      active: true,
      eventType: "deployment.failed",
      source: "*",
      tags: ["kubernetes"],
      dataContract: { id: "deployment-failed-data", version: 1 },
      examples: [{ metadata: { severity: "high", service: "checkout-service" } }],
      payloadExample: {
        metadata: { severity: "high", service: "checkout-service" }
      },
      createdAt: now,
      updatedAt: now
    }
  ],
  events: [
    {
      id: "event-seed-routed",
      projectId: "project-platform",
      source: "runtime-codex",
      eventType: "deployment.failed",
      tags: ["kubernetes", "checkout"],
      payload: {
        metadata: { severity: "high", service: "checkout-service" },
        namespace: "payments",
        pod: "checkout-7d9f8cdd4"
      },
      status: "routed",
      matchedPolicyId: "policy-deploy-fail",
      assignedAgentId: "agent-k8s",
      handlingResult: "Routed by \"Deployment failures to k8s operator\" to k8s-operator.",
      createdAt: now
    },
    {
      id: "event-seed-unassigned",
      projectId: "project-platform",
      source: "external-monitor",
      eventType: "cost.anomaly",
      tags: ["finops"],
      payload: { metadata: { severity: "medium" }, amount: 1200 },
      status: "unassigned",
      handlingResult: "No active policy matched project, event type, tags, source, and payload metadata.",
      createdAt: now
    }
  ],
  agentRuns: []
};
