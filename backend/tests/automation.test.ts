import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import type { ProjectAutomationConfig, ProjectPolicy } from "../../shared/domain/automation.js";
import { actionOutputIds, findProjectOutputRoute, generatedPolicyId, humanGateResponseId, loopIdForPolicy, policyOutputEventType } from "../../shared/policy-actions.js";
import { actionOutputEventType, aggregateActionOutputStatus } from "../automation/actionOutputAggregator.js";
import {
    automationPoliciesToEventDefinitions,
    automationPoliciesToPolicies,
    loadProjectAutomationConfig,
    normalizeProjectAutomationConfig,
    saveProjectAutomationConfig,
    validateProjectAutomationConfig
} from "../automation.js";

const tempRoots: string[] = [];

const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-automation-"));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const agent: Agent = {
  id: "developer-agent",
  name: "Developer Agent",
  description: "Implements work.",
  instructions: "Do the work.",
  skills: [],
  enabled: true,
  status: "online",
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

const startEvent = "project-brief-gate.approved";
const startLoopId = loopIdForPolicy({ event: startEvent });
const startPolicyId = generatedPolicyId({ loopId: startLoopId, event: startEvent, action: "implementation" });
const startRejectedEvent = policyOutputEventType({ action: "implementation", loopId: startLoopId }, "rejected");
const startRejectedPolicyId = generatedPolicyId({ loopId: startLoopId, event: startRejectedEvent, action: "implementation" });

const startGateAction = () => ({
  id: "project-brief-gate",
  description: "Project brief approval.",
  outputIds: ["approved", "rejected"],
  agentIds: [],
  humanGate: true
});

const startPolicy = (): ProjectPolicy => ({
  id: startPolicyId,
  loopId: startLoopId,
  source: "event",
  event: startEvent,
  action: "implementation",
  enabled: true
});

const validConfig = (): ProjectAutomationConfig => ({
  version: 1,
  actions: [
    {
      id: "implementation",
      description: "Implement approved work.",
      outputIds: ["approved", "rejected"],
      agentIds: ["developer-agent"]
    },
    startGateAction()
  ],
  outputs: [{ id: "approved" }, { id: "rejected" }],
  outputRoutes: [],
  humanGateResponses: [],
  policies: [
    startPolicy(),
    {
      id: startRejectedPolicyId,
      loopId: startLoopId,
      source: "event",
      event: policyOutputEventType({ action: "implementation", loopId: startLoopId }, "rejected"),
      action: "implementation",
      enabled: true
    }
  ],
  loops: [
    {
      id: startLoopId,
      steps: [startPolicyId, startRejectedPolicyId]
    }
  ],
  runtimes: [
    {
      id: "codex-runtime",
      title: "Codex runtime",
      command: "codex",
      args: ["app-server", "--listen", "stdio://"]
    }
  ]
});

describe("project automation config", () => {
  it("returns default config when .ballet/project.json is missing", async () => {
    await expect(loadProjectAutomationConfig(await tempRoot())).resolves.toEqual({
      version: 1,
      actions: [],
      outputs: [
        { id: "approved" },
        { id: "rejected" }
      ],
      outputRoutes: [],
      humanGateResponses: [],
      policies: [],
      loops: [],
      runtimes: []
    });
  });

  it("upgrades old raw config shape with outputRoutes at the normalization boundary", () => {
    const oldRawConfig = {
      version: 1,
      triggers: [],
      actions: [],
      outputs: [],
      policies: [],
      loops: [],
      runtimes: []
    };

    expect(normalizeProjectAutomationConfig(oldRawConfig).outputRoutes).toEqual([]);
    expect(validateProjectAutomationConfig(oldRawConfig).some((issue) => issue.path === "triggers")).toBe(true);
  });

  it("normalizes missing humanGateResponses to an empty array", () => {
    const oldRawConfig = {
      version: 1,
      actions: [],
      outputs: [],
      outputRoutes: [],
      policies: [],
      loops: [],
      runtimes: []
    };

    expect(normalizeProjectAutomationConfig(oldRawConfig)).toMatchObject({
      humanGateResponses: []
    });
  });

  it("keeps repository automation configs in the current outputRoutes shape", async () => {
    for (const relativePath of [".ballet/project.json", ".fixture-ballet-project/.ballet/project.json"]) {
      const config = JSON.parse(await readFile(path.join(process.cwd(), relativePath), "utf8")) as { outputRoutes?: unknown; humanGateResponses?: unknown };
      expect(Array.isArray(config.outputRoutes)).toBe(true);
      expect(Array.isArray(config.humanGateResponses)).toBe(true);
      expect(config).not.toHaveProperty("gates");
      expect(config).not.toHaveProperty("gateDecisions");
    }
  });

  it("keeps the repository loop config inside current validation rules", async () => {
    const config = JSON.parse(await readFile(path.join(process.cwd(), ".ballet/project.json"), "utf8")) as ProjectAutomationConfig;
    expect(validateProjectAutomationConfig(config)).toEqual([]);
  });

  it("keeps the repository loop gates and outputs fully routed", async () => {
    const rawConfig = JSON.parse(await readFile(path.join(process.cwd(), ".ballet/project.json"), "utf8")) as unknown;
    const config = normalizeProjectAutomationConfig(rawConfig);
    const humanGateIds = config.actions.filter((action) => action.humanGate).map((action) => action.id);
    const expectedGateIds = [
      "project-brief-gate",
      "roadmap-gate",
      "ui-design-gate",
      "technical-plan-gate",
      "milestones-gate",
      "task-specs-gate",
      "code-gate",
      "dev-deployment-validation-gate"
    ];
    const eventPoliciesByEvent = new Map(config.policies
      .filter((policy): policy is ProjectPolicy & { event: string } => policy.source === "event" && Boolean(policy.event))
      .map((policy) => [policy.event, policy]));

    expect(humanGateIds).toEqual(expectedGateIds);
    expect(config).not.toHaveProperty("triggers");
    expect(config.outputRoutes.every((route) => route.target.type === "policy")).toBe(true);
    expect(eventPoliciesByEvent.get("code-gate.approved.loop.dev-deployment-validation-gate.approved")?.action).toBe("done");
    expect(automationPoliciesToEventDefinitions(
      config.policies,
      config.actions,
      config.outputs,
      config.outputRoutes
    ).map((event) => event.eventType)).toEqual(expect.arrayContaining([
      "project-brief-gate.approved",
      "roadmap-gate.approved",
      "code-gate.approved"
    ]));

    config.policies.forEach((policy) => {
      actionOutputIds(config.actions, policy.action).forEach((outputId) => {
        const route = findProjectOutputRoute(config.outputRoutes, policy.id, outputId);
        const targetPolicy = route
          ? config.policies.find((candidate) => candidate.id === route.target.policyId)
          : undefined;
        const eventType = targetPolicy?.event ?? policyOutputEventType(policy, outputId);
        expect(eventPoliciesByEvent.has(eventType)).toBeTruthy();
      });
    });
  });

  it("saves readable JSON without touching Markdown instructions", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet/instructions"), { recursive: true });
    const instructionPath = path.join(root, ".ballet/instructions/code-review.md");
    await writeFile(instructionPath, "# Code review\n", "utf8");

    await saveProjectAutomationConfig(root, validConfig(), [agent]);

    const saved = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8")) as ProjectAutomationConfig;
    expect(saved).not.toHaveProperty("events");
    expect(saved).not.toHaveProperty("gates");
    expect(saved).not.toHaveProperty("gateDecisions");
    expect(saved.humanGateResponses).toEqual([]);
    expect(saved.policies[0]?.id).toBe(startPolicyId);
    expect(saved.loops[0]?.id).toBe(startLoopId);
    expect(saved.loops[0]?.steps).toEqual([startPolicyId, startRejectedPolicyId]);
    expect(await readFile(instructionPath, "utf8")).toBe("# Code review\n");
  });

  it("derives default outputIds for persisted executable actions when outputIds is missing", () => {
    const normalized = normalizeProjectAutomationConfig({
      version: 1,
      actions: [{ id: "implementation", description: "Implement.", agentIds: ["developer-agent"] }],
      outputRoutes: [],
      humanGateResponses: [],
      policies: [],
      loops: [],
      runtimes: []
    }, [agent]);

    expect(normalized.actions[0]?.outputIds).toEqual(["approved", "rejected"]);
    expect(validateProjectAutomationConfig(normalized, [agent])).toEqual([]);
  });

  it("derives default outputIds for persisted human gate actions when outputIds is missing", () => {
    const normalized = normalizeProjectAutomationConfig({
      version: 1,
      actions: [{ id: "human-review", description: "Review.", agentIds: [], humanGate: true }],
      outputRoutes: [],
      humanGateResponses: [],
      policies: [],
      loops: [],
      runtimes: []
    }, [agent]);

    expect(normalized.actions[0]?.outputIds).toEqual(["approved", "rejected"]);
    expect(validateProjectAutomationConfig(normalized, [agent])).toEqual([]);
  });

  it("derives empty outputIds for persisted no-op actions when outputIds is missing", () => {
    const normalized = normalizeProjectAutomationConfig({
      version: 1,
      actions: [{ id: "done", description: "Done.", agentIds: [] }],
      outputRoutes: [],
      humanGateResponses: [],
      policies: [],
      loops: [],
      runtimes: []
    }, [agent]);

    expect(normalized.actions[0]?.outputIds).toEqual([]);
    expect(validateProjectAutomationConfig(normalized, [agent])).toEqual([]);
  });

  it("preserves explicit approval-only outputIds and does not emit a rejected output event", () => {
    const config = normalizeProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, outputIds: ["approved"] }, startGateAction()],
      policies: [
        startPolicy(),
        {
          id: "on.implementation.approved.start.implementation",
          loopId: startLoopId,
          source: "event",
          event: "implementation.approved",
          action: "implementation",
          enabled: true
        }
      ],
      loops: [{ id: startLoopId, steps: [startPolicyId, "on.implementation.approved.start.implementation"] }]
    }, [agent]);

    expect(config.actions[0]?.outputIds).toEqual(["approved"]);
    expect(actionOutputIds(config.actions, "implementation")).toEqual(["approved"]);
    expect(automationPoliciesToEventDefinitions(
      config.policies,
      config.actions,
      config.outputs,
      config.outputRoutes
    ).map((event) => event.eventType)).not.toContain("implementation.rejected");
  });

  it("keeps existing explicit default outputIds normalized unchanged", () => {
    const normalized = normalizeProjectAutomationConfig(validConfig(), [agent]);

    expect(normalized.actions[0]?.outputIds).toEqual(["approved", "rejected"]);
    expect(normalized.actions[1]?.outputIds).toEqual(["approved", "rejected"]);
  });

  it("saves compact JSON and loads it back into the same normalized config", async () => {
    const root = await tempRoot();
    const saved = await saveProjectAutomationConfig(root, validConfig(), [agent]);
    const rawSaved = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8")) as {
      actions: Array<{ id: string; outputIds?: string[] }>;
      outputs?: unknown;
    };

    expect(rawSaved.outputs).toBeUndefined();
    expect(rawSaved.actions.find((action) => action.id === "implementation")).not.toHaveProperty("outputIds");
    expect(rawSaved.actions.find((action) => action.id === "project-brief-gate")).not.toHaveProperty("outputIds");
    await expect(loadProjectAutomationConfig(root, [agent])).resolves.toEqual(saved);
  });

  it("keeps approval-only outputIds when saving compact JSON", async () => {
    const root = await tempRoot();
    await saveProjectAutomationConfig(root, {
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, outputIds: ["approved"] }, startGateAction()],
      policies: [
        startPolicy(),
        {
          id: "on.implementation.approved.start.implementation",
          source: "event",
          event: "implementation.approved",
          action: "implementation",
          enabled: true
        }
      ],
      loops: [{ id: startLoopId, steps: [startPolicyId, "on.implementation.approved.start.implementation"] }]
    }, [agent]);
    const rawSaved = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8")) as {
      actions: Array<{ id: string; outputIds?: string[] }>;
    };

    expect(rawSaved.actions.find((action) => action.id === "implementation")?.outputIds).toEqual(["approved"]);
    expect(rawSaved.actions.find((action) => action.id === "project-brief-gate")).not.toHaveProperty("outputIds");
  });

  it("maps runtime aggregation outcomes to approved and rejected output event types", () => {
    const config = validConfig();
    const policy = config.policies[0]!;

    const approved = aggregateActionOutputStatus([{
      runId: "run-approved",
      inputEventId: "event-approved",
      policyId: policy.id,
      policyVersion: 1,
      agentRole: "developer-agent",
      status: "completed",
      attempt: 1,
      createdAt: "2026-07-07T10:00:00.000Z",
      updatedAt: "2026-07-07T10:01:00.000Z",
      completedAt: "2026-07-07T10:01:00.000Z",
      outcome: { outcome: "ready", summary: "Ready.", checks: [] }
    }], policy, config.actions);
    const rejected = aggregateActionOutputStatus([{
      runId: "run-rejected",
      inputEventId: "event-rejected",
      policyId: policy.id,
      policyVersion: 1,
      agentRole: "developer-agent",
      status: "failed",
      attempt: 1,
      createdAt: "2026-07-07T10:00:00.000Z",
      updatedAt: "2026-07-07T10:01:00.000Z",
      completedAt: "2026-07-07T10:01:00.000Z",
      outcome: { outcome: "failed", summary: "Failed.", checks: [] }
    }], policy, config.actions);

    expect(approved).toBe("approved");
    expect(rejected).toBe("rejected");
    expect(actionOutputEventType(policy, approved!, config.outputRoutes, config.actions, config.policies)).toBe(
      policyOutputEventType(policy, "approved")
    );
    expect(actionOutputEventType(policy, rejected!, config.outputRoutes, config.actions, config.policies)).toBe(
      policyOutputEventType(policy, "rejected")
    );
  });

  it("normalizes legacy policy fields to event and action agents", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    const legacy = {
      version: 1,
      events: [{ id: "task.created", title: "Task created", source: "user" }],
      actions: [
        { id: "run", description: "Run", outputIds: ["ok", "rework"] },
        startGateAction()
      ],
      policies: [
        {
          id: "start-delivery",
          source: "trigger",
          trigger: startEvent,
          action: "run",
          enabled: true
        },
        {
          id: "assign-developer",
          title: "Assign developer",
          on: "developer.run.ready",
          run: { agent: "developer-agent", runtime: "codex-runtime" },
          enabled: true
        }
      ],
      loops: [{ id: "delivery", steps: ["start-delivery", "assign-developer"] }],
      runtimes: [{ id: "codex-runtime", title: "Codex runtime", command: "codex", args: [], outputEvents: { completed: "agent.output.completed" } }]
    };

    await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify(legacy), "utf8");

    const loaded = await loadProjectAutomationConfig(root, [agent]);
    expect(loaded).not.toHaveProperty("events");
    expect(loaded).not.toHaveProperty("gates");
    expect(loaded).not.toHaveProperty("gateDecisions");
    expect(loaded.humanGateResponses).toEqual([]);
    expect(loaded.actions).toEqual(expect.arrayContaining([
      { id: "run", description: "Run", outputIds: ["approved", "rejected"], agentIds: ["developer-agent"] },
      expect.objectContaining({ id: "project-brief-gate", humanGate: true })
    ]));
    expect(loaded.outputs).toEqual(expect.arrayContaining([
      { id: "approved" },
      { id: "rejected" }
    ]));
    expect(loaded.outputRoutes).toEqual([]);
    const legacyLoopId = "delivery";
    const startRunPolicyId = generatedPolicyId({ loopId: legacyLoopId, event: startEvent, action: "run" });
    const runApprovedEvent = policyOutputEventType({ action: "run", loopId: legacyLoopId }, "approved");
    const runApprovedPolicyId = generatedPolicyId({ loopId: legacyLoopId, event: runApprovedEvent, action: "run" });
    expect(loaded.policies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: startRunPolicyId,
        loopId: legacyLoopId,
        source: "event",
        event: startEvent,
        action: "run"
      }),
      expect.objectContaining({
        id: runApprovedPolicyId,
        loopId: legacyLoopId,
        source: "event",
        event: runApprovedEvent,
        action: "run"
      })
    ]));
    expect(loaded.loops[0]?.id).toBe(legacyLoopId);
    expect(loaded.loops[0]?.steps).toEqual([startRunPolicyId, runApprovedPolicyId]);
    expect(loaded.runtimes[0]).not.toHaveProperty("outputEvents");
  });

  it("normalizes legacy v1 output events and remaps loop policy ids", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify({
      version: 1,
      triggers: [],
      gates: [{ id: "intent_changed", title: "Intent changed", description: "Intent changed gate" }],
      gateDecisions: [],
      actions: [{ id: "implementation", description: "Implement approved work." }],
      outputs: [],
      policies: [
        {
          id: "start-delivery",
          source: "trigger",
          trigger: "intent_changed.ok",
          action: "implementation",
          enabled: true
        },
        {
          id: "on.developer.implementation.ready.v1.then.developer.start.implementation",
          source: "event",
          event: "developer.implementation.ready.v1",
          agent: "developer",
          action: "implementation",
          enabled: true
        }
      ],
      loops: [{
        id: "delivery",
        steps: ["start-delivery", "on.developer.implementation.ready.v1.then.developer.start.implementation"]
      }],
      runtimes: []
    }), "utf8");

    const loaded = await loadProjectAutomationConfig(root, [agent]);
    const intentLoopId = "delivery";
    const intentStartPolicyId = generatedPolicyId({ loopId: intentLoopId, event: "intent_changed.approved", action: "implementation" });
    const intentApprovedEvent = policyOutputEventType({ action: "implementation", loopId: intentLoopId }, "approved");
    const intentApprovedPolicyId = generatedPolicyId({ loopId: intentLoopId, event: intentApprovedEvent, action: "implementation" });

    expect(loaded.policies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: intentStartPolicyId,
        loopId: intentLoopId,
        source: "event",
        event: "intent_changed.approved"
      }),
      expect.objectContaining({
        id: intentApprovedPolicyId,
        loopId: intentLoopId,
        event: intentApprovedEvent
      })
    ]));
    expect(loaded).not.toHaveProperty("gates");
    expect(loaded).not.toHaveProperty("gateDecisions");
    expect(loaded.humanGateResponses).toEqual([]);
    expect(loaded.actions.some((action) => action.id === "intent_changed" && action.humanGate)).toBe(true);
    expect(loaded.outputs).toEqual([{ id: "approved" }, { id: "rejected" }]);
    expect(loaded.outputRoutes).toEqual([]);
    expect(loaded.actions[0]?.outputIds).toEqual(["approved", "rejected"]);
    expect(loaded.loops[0]?.id).toBe(intentLoopId);
    expect(loaded.loops[0]?.steps).toEqual([intentStartPolicyId, intentApprovedPolicyId]);
  });

  it("preserves one-output agent actions as approval-only actions", async () => {
    const root = await tempRoot();
    const config: ProjectAutomationConfig = {
      ...validConfig(),
      actions: [
        {
          id: "implementation",
          description: "Implement approved work.",
          outputIds: ["roadmap_ready"],
          agentIds: ["developer-agent"]
        },
        startGateAction()
      ],
      outputs: [{ id: "roadmap_ready" }],
      policies: [
        startPolicy(),
        {
          id: "on.implementation.roadmap_ready.start.implementation",
          source: "event",
          event: "implementation.roadmap_ready",
          action: "implementation",
          enabled: true
        }
      ],
      loops: [{
        id: startLoopId,
        steps: [startPolicyId, "on.implementation.roadmap_ready.start.implementation"]
      }]
    };

    const saved = await saveProjectAutomationConfig(root, config, [agent]);

    expect(saved.actions[0]?.outputIds).toEqual(["approved"]);
    expect(saved.outputs).toEqual([{ id: "approved" }, { id: "rejected" }]);
    expect(automationPoliciesToEventDefinitions(
      saved.policies,
      saved.actions,
      saved.outputs
    ).map((event) => event.eventType)).toEqual(expect.arrayContaining(["implementation.approved"]));
  });

  it("validates policy, runtime, and loop references while ignoring legacy event definitions", () => {
    expect(validateProjectAutomationConfig(validConfig(), [agent])).toEqual([]);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      events: [{ id: "", title: "", source: "", payloadSchema: "not-an-object" }]
    }, [agent])).toEqual([]);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [validConfig().policies[0]!, { ...validConfig().policies[1]!, event: "" }]
    }, [agent]).some((issue) => issue.message === "Policy event is required.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [validConfig().policies[0]!, { ...validConfig().policies[1]!, event: "missing.event" }]
    }, [agent]).some((issue) => issue.message.includes("unknown event"))).toBe(false);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{ ...validConfig().policies[0]!, action: "" }]
    }, [agent]).some((issue) => issue.message === "Policy action is required.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{ ...validConfig().policies[0]!, action: "missing-action" }]
    }, [agent]).some((issue) => issue.message === "Policy references unknown action: missing-action.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, agentIds: ["missing-agent"] }]
    }, [agent]).some((issue) => issue.message === "Action references unknown agent: missing-agent.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      runtimes: [{ ...validConfig().runtimes[0]!, command: "" }]
    }, [agent]).some((issue) => issue.message === "Runtime command is required.")).toBe(true);

    const configWithLegacyRuntimeOutput = {
      ...validConfig(),
      runtimes: [{ ...validConfig().runtimes[0]!, outputEvents: { completed: "missing.event" } }]
    };
    expect(validateProjectAutomationConfig(configWithLegacyRuntimeOutput, [agent])).toEqual([]);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      outputs: [{ id: "summary" }, { id: "summary" }]
    }, [agent]).some((issue) => issue.message === "Duplicate output id: summary.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      outputs: [{ id: "" }]
    }, [agent]).some((issue) => issue.message === "Output id is required.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, outputIds: [] }]
    }, [agent]).some((issue) => issue.message === "Action must define 1 or 2 outputs: approval and optional rework.")).toBe(true);

    const agentlessConfig: ProjectAutomationConfig = {
      ...validConfig(),
      actions: [...validConfig().actions, { id: "manual-gate", description: "Manual loop stop.", outputIds: [], agentIds: [] }]
    };
    expect(validateProjectAutomationConfig(agentlessConfig, [agent])).toEqual([]);
    expect(validateProjectAutomationConfig({
      ...agentlessConfig,
      actions: agentlessConfig.actions.map((action) => action.id === "manual-gate" ? { ...action, outputIds: ["failed"] } : action)
    }, [agent]).some((issue) => issue.message === "Action without agents cannot select outputs.")).toBe(true);
    expect(agentlessConfig.actions.some((action) => action.id === "manual-gate")).toBe(true);

    const humanGateEvent = policyOutputEventType({ action: "human-review" }, "approved");
    const humanGateLoopId = loopIdForPolicy({ event: humanGateEvent });
    const humanGatePolicy = {
      id: generatedPolicyId({ loopId: humanGateLoopId, event: humanGateEvent, action: "human-review" }),
      loopId: humanGateLoopId,
      source: "event" as const,
      event: humanGateEvent,
      action: "human-review",
      enabled: true
    };
    const humanGateConfig: ProjectAutomationConfig = {
      ...validConfig(),
      actions: [{ id: "human-review", description: "Human review.", outputIds: ["approved", "rejected"], agentIds: [], humanGate: true }],
      policies: [humanGatePolicy],
      loops: [{ id: humanGateLoopId, steps: [humanGatePolicy.id] }]
    };
    const humanGateResponseBase = {
      loopId: humanGateLoopId,
      policyId: humanGatePolicy.id,
      actionId: "human-review",
      outputId: "approved",
      prompt: "Continue with the approved path.",
      submittedAt: "2026-07-07T10:00:00.000Z"
    };
    const humanGateResponse = {
      ...humanGateResponseBase,
      id: humanGateResponseId(humanGateResponseBase)
    };
    expect(validateProjectAutomationConfig({
      ...humanGateConfig,
      humanGateResponses: [humanGateResponse]
    }, [agent])).toEqual([]);
    expect(validateProjectAutomationConfig({
      ...humanGateConfig,
      actions: [{ ...humanGateConfig.actions[0]!, agentIds: ["developer-agent"] }]
    }, [agent]).some((issue) => issue.message === "Human gate action cannot select agents.")).toBe(true);
    expect(validateProjectAutomationConfig({
      ...humanGateConfig,
      humanGateResponses: [{ ...humanGateResponse, prompt: "" }]
    }, [agent]).some((issue) => issue.message === "Human gate response prompt is required.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, outputIds: ["rejected", "summary", "extra", "too-many"] }],
      outputs: [...validConfig().outputs, { id: "extra" }, { id: "too-many" }]
    }, [agent]).some((issue) => issue.message === "Action must define 1 or 2 outputs: approval and optional rework.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, outputIds: ["rejected", "rejected"] }]
    }, [agent]).some((issue) => issue.message === "Duplicate action output id: rejected.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, outputIds: ["summary"] }],
      policies: [startPolicy(), { ...validConfig().policies[1]!, event: "implementation.rejected" }]
    }, [agent]).some((issue) => issue.message.includes("unknown event"))).toBe(false);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, outputIds: ["approved"] }, startGateAction()],
      outputs: [{ id: "approved" }, { id: "rejected" }],
      policies: [
        startPolicy(),
        {
          id: "on.implementation.approved.start.implementation",
          source: "event",
          event: "implementation.approved",
          action: "implementation",
          enabled: true
        }
      ],
      loops: [{ id: startLoopId, steps: [startPolicyId, "on.implementation.approved.start.implementation"] }]
    }, [agent])).toEqual([]);

    const completedConfig: ProjectAutomationConfig = {
      ...validConfig(),
      actions: [{ id: "implementation", description: "Implement approved work.", outputIds: ["completed", "failed", "blocked"], agentIds: ["developer-agent"] }, startGateAction()],
      outputs: [
        { id: "completed" },
        { id: "failed" },
        { id: "blocked" }
      ],
      policies: [
        startPolicy(),
        {
          id: "on.implementation.approved.start.implementation",
          source: "event",
          event: "implementation.approved",
          action: "implementation",
          enabled: true
        }
      ],
      loops: [{
        id: startLoopId,
        steps: [startPolicyId, "on.implementation.approved.start.implementation"]
      }]
    };
  expect(validateProjectAutomationConfig(completedConfig, [agent])).toEqual([]);
  expect(validateProjectAutomationConfig({
    ...completedConfig,
    policies: [completedConfig.policies[0]!, { ...completedConfig.policies[1]!, event: "implementation.unknown-output" }]
  }, [agent]).some((issue) => issue.message.includes("unknown event"))).toBe(false);
  });

  it("rejects object loop steps instead of migrating them", () => {
    const issues = validateProjectAutomationConfig({
      ...validConfig(),
      loops: [{
        id: "legacy",
        steps: [{ policy: "assign-developer", on: "task.created", agent: "developer-agent", action: "implementation", runtime: "codex-runtime" }]
      }]
    }, [agent]);

    expect(issues.some((issue) => issue.message === "Loop step must be a policy id string.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Loop step must not contain on.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Loop step must not contain agent.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Loop step must not contain action.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Loop step must not contain runtime.")).toBe(true);
  });

  it("rejects loop steps that reference missing policies", () => {
    const issues = validateProjectAutomationConfig({
      ...validConfig(),
      loops: [{ id: "bad-loop", steps: ["missing-policy"] }]
    }, [agent]);

    expect(issues.some((issue) => issue.message === "Loop references unknown policy: missing-policy.")).toBe(true);
  });

  it("rejects trigger source policies at the validation boundary", () => {
    const legacyPolicy = {
      id: "legacy-trigger-policy",
      source: "trigger",
      trigger: "human-review.approved",
      action: "implementation",
      enabled: true
    };
    const issues = validateProjectAutomationConfig({
      ...validConfig(),
      policies: [legacyPolicy],
      loops: [{ id: "bad-loop", steps: [legacyPolicy.id] }]
    }, [agent]);

    expect(issues.some((issue) => issue.message === "Policy source must be event.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Policy trigger is no longer supported. Use event.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Policy event is required.")).toBe(true);
  });

  it("validates output route references", () => {
    const humanGatePolicy = {
      id: "on.implementation.rejected.start.human-review",
      source: "event" as const,
      event: "implementation.rejected",
      action: "human-review",
      enabled: true
    };
    const routeConfig: ProjectAutomationConfig = {
      ...validConfig(),
      actions: [
        ...validConfig().actions,
        { id: "human-review", description: "Human review.", outputIds: ["approved", "rejected"], agentIds: [], humanGate: true }
      ],
      policies: [...validConfig().policies, humanGatePolicy],
      outputRoutes: [{
        sourcePolicyId: humanGatePolicy.id,
        outputId: "rejected",
        target: { type: "policy", policyId: startRejectedPolicyId }
      }]
    };

    expect(validateProjectAutomationConfig(routeConfig, [agent])).toEqual([]);
    const triggerTargetIssues = validateProjectAutomationConfig({
      ...routeConfig,
      outputRoutes: [{ ...routeConfig.outputRoutes[0]!, target: { type: "trigger", trigger: "missing-trigger" } }]
    }, [agent]);
    expect(triggerTargetIssues.some((issue) => issue.message === "Output route target type must be policy.")).toBe(true);
    expect(triggerTargetIssues.some((issue) => issue.message === "Output route target must reference an event policy.")).toBe(false);
    expect(validateProjectAutomationConfig({
      ...routeConfig,
      outputRoutes: [{ ...routeConfig.outputRoutes[0]!, target: { type: "policy", policyId: "missing-policy" } }]
    }, [agent]).some((issue) => issue.message === "Output route target must reference an event policy.")).toBe(true);
    expect(validateProjectAutomationConfig({
      ...routeConfig,
      outputRoutes: [{ ...routeConfig.outputRoutes[0]!, outputId: "summary" }]
    }, [agent]).some((issue) =>
      issue.message === "Output route references unavailable output summary for policy on.implementation.rejected.start.human-review."
    )).toBe(true);
    expect(validateProjectAutomationConfig({
      ...routeConfig,
      outputRoutes: [{
        sourcePolicyId: "on.implementation.rejected.start.implementation",
        outputId: "approved",
        target: { type: "trigger", trigger: "manual-start" }
      }]
    }, [agent]).some((issue) => issue.message === "Output route target type must be policy.")).toBe(true);
    expect(validateProjectAutomationConfig({
      ...routeConfig,
      outputRoutes: [{ ...routeConfig.outputRoutes[0]!, outputId: "approved" }]
    }, [agent])).toEqual([]);
  });

  it("normalizes legacy output route event targets to policy targets", () => {
    const humanGatePolicy = {
      id: "on.implementation.rejected.start.human-review",
      source: "event" as const,
      event: "implementation.rejected",
      action: "human-review",
      enabled: true
    };
    const legacyRouteConfig = {
      ...validConfig(),
      actions: [
        ...validConfig().actions,
        { id: "human-review", description: "Human review.", outputIds: ["approved", "rejected"], agentIds: [], humanGate: true }
      ],
      policies: [...validConfig().policies, humanGatePolicy],
      outputRoutes: [{
        sourcePolicyId: humanGatePolicy.id,
        outputId: "rejected",
        target: { type: "event", eventType: policyOutputEventType({ action: "implementation", loopId: startLoopId }, "rejected") }
      }]
    };

    expect(normalizeProjectAutomationConfig(legacyRouteConfig).outputRoutes).toEqual([{
      sourcePolicyId: humanGatePolicy.id,
      outputId: "rejected",
      target: { type: "policy", policyId: startRejectedPolicyId }
    }]);
    expect(validateProjectAutomationConfig(legacyRouteConfig, [agent])).toEqual([]);
  });

  it("migrates legacy gate output routes to human gate actions", () => {
    const gateRouteConfig = {
      ...validConfig(),
      gates: [{ id: "human-review", title: "Human review", description: "Review generated output." }],
      outputRoutes: [{
        sourcePolicyId: startRejectedPolicyId,
        outputId: "ok",
        target: { type: "gate", gate: "human-review" }
      }]
    };
    const normalized = normalizeProjectAutomationConfig(gateRouteConfig);
    const humanReviewEvent = policyOutputEventType({ action: "implementation", loopId: startLoopId }, "approved");
    const humanReviewPolicyId = generatedPolicyId({ loopId: startLoopId, event: humanReviewEvent, action: "human-review" });

    expect(normalized).not.toHaveProperty("gates");
    expect(normalized.outputRoutes).toEqual([]);
    expect(normalized.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "human-review", humanGate: true, agentIds: [], outputIds: ["approved", "rejected"] })
    ]));
    expect(normalized.policies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: humanReviewPolicyId,
        loopId: startLoopId,
        source: "event",
        event: humanReviewEvent,
        action: "human-review"
      })
    ]));
    expect(normalized.loops[0]?.steps).toEqual([
      startPolicyId,
      startRejectedPolicyId,
      humanReviewPolicyId
    ]);
    expect(validateProjectAutomationConfig(gateRouteConfig, [agent]).some((issue) =>
      issue.message === "Output route target type must be policy."
    )).toBe(true);
    expect(validateProjectAutomationConfig(normalized, [agent])).toEqual([]);
  });

  it("validates automation field lengths", () => {
    const issues = validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, id: "a".repeat(41) }],
      outputs: [{ id: "x".repeat(33) }]
    }, [agent]);

    expect(issues.some((issue) => issue.message === "Action id must be 40 characters or fewer.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Output id must be 32 characters or fewer.")).toBe(true);
  });

  it("accepts events derived from saved action outputs", () => {
    const reviewer: Agent = {
      ...agent,
      id: "reviewer-agent",
      name: "Reviewer Agent"
    };

    expect(validateProjectAutomationConfig(validConfig(), [agent, reviewer])).toEqual([]);
  });

  it("normalizes legacy trigger-backed policies to event-only policies", () => {
    const normalized = normalizeProjectAutomationConfig({
      ...validConfig(),
      policies: [{
        id: "legacy-start",
        source: "trigger",
        trigger: "human-review.approved",
        action: "implementation",
        enabled: true
      }, {
        id: "legacy-prefixed-event",
        source: "event",
        event: "trigger.plan-approved",
        action: "implementation",
        enabled: true
      }],
      loops: [{ id: "legacy-loop", steps: ["legacy-start", "legacy-prefixed-event"] }]
    }, [agent]);

    const startPolicyId = generatedPolicyId({ loopId: "legacy-loop", event: "human-review.approved", action: "implementation" });
    const prefixedEvent = "legacy-loop.plan-approved";
    const prefixedPolicyId = generatedPolicyId({ loopId: "legacy-loop", event: prefixedEvent, action: "implementation" });
    expect(normalized.policies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: startPolicyId,
        loopId: "legacy-loop",
        source: "event",
        event: "human-review.approved"
      }),
      expect.objectContaining({
        id: prefixedPolicyId,
        loopId: "legacy-loop",
        source: "event",
        event: prefixedEvent
      })
    ]));
    normalized.policies.forEach((policy) => expect(policy).not.toHaveProperty("trigger"));
    expect(normalized.loops[0]?.steps).toEqual([startPolicyId, prefixedPolicyId]);
    expect(validateProjectAutomationConfig(normalized, [agent])).toEqual([]);

    expect(automationPoliciesToPolicies([{
      id: startPolicyId,
      source: "event",
      event: "human-review.approved",
      action: "implementation",
      enabled: true
    }], [{ id: "implementation", description: "Implementation", outputIds: ["approved", "rejected"], agentIds: ["developer-agent"] }])[0]?.eventTypes).toEqual(["human-review.approved"]);
  });
});
