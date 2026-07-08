import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import type { ProjectAutomationConfig, ProjectPolicy } from "../../shared/domain/automation.js";
import { actionOutputIds, findProjectOutputRoute, humanGateApprovalTriggerId, humanGateResponseId, policyOutputEventType, workflowIdFromTrigger } from "../../shared/policy-actions.js";
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

const startTrigger = "project-brief-gate.approved";
const startWorkflowId = workflowIdFromTrigger(startTrigger);
const startPolicyId = `on.trigger.${startTrigger}.start.implementation`;

const startGateAction = () => ({
  id: "project-brief-gate",
  description: "Project brief approval.",
  outputIds: ["approved", "changes_requested"],
  agentIds: [],
  humanGate: true
});

const startPolicy = (): ProjectPolicy => ({
  id: startPolicyId,
  source: "trigger",
  trigger: startTrigger,
  action: "implementation",
  enabled: true
});

const validConfig = (): ProjectAutomationConfig => ({
  version: 1,
  actions: [
    {
      id: "implementation",
      description: "Implement approved work.",
      outputIds: ["ok", "failed"],
      agentIds: ["developer-agent"]
    },
    startGateAction()
  ],
  outputs: [{ id: "ok" }, { id: "failed" }, { id: "summary" }],
  outputRoutes: [],
  humanGateResponses: [],
  policies: [
    startPolicy(),
    {
      id: "on.implementation.failed.start.implementation",
      source: "event",
      event: "implementation.failed",
      action: "implementation",
      enabled: true
    }
  ],
  workflows: [
    {
      id: startWorkflowId,
      title: "Delivery",
      steps: [startPolicyId, "on.implementation.failed.start.implementation"]
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
        { id: "ok" },
        { id: "rework" }
      ],
      outputRoutes: [],
      humanGateResponses: [],
      policies: [],
      workflows: [],
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
      workflows: [],
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
      workflows: [],
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

  it("keeps the repository workflow config inside current validation rules", async () => {
    const config = JSON.parse(await readFile(path.join(process.cwd(), ".ballet/project.json"), "utf8")) as ProjectAutomationConfig;
    expect(validateProjectAutomationConfig(config)).toEqual([]);
  });

  it("keeps the repository workflow gates and outputs fully routed", async () => {
    const config = JSON.parse(await readFile(path.join(process.cwd(), ".ballet/project.json"), "utf8")) as ProjectAutomationConfig;
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
    const triggerPoliciesByTrigger = new Map(config.policies
      .filter((policy): policy is ProjectPolicy & { trigger: string } => policy.source === "trigger" && Boolean(policy.trigger))
      .map((policy) => [policy.trigger, policy]));

    expect(humanGateIds).toEqual(expectedGateIds);
    expect(config).not.toHaveProperty("triggers");
    expect(config.outputRoutes.every((route) => route.target.type === "event")).toBe(true);
    expect(triggerPoliciesByTrigger.get("dev-deployment-validation-gate.approved")?.action).toBe("done");
    expect(automationPoliciesToEventDefinitions(
      config.policies,
      config.actions,
      config.outputs,
      config.outputRoutes
    ).map((event) => event.eventType)).toEqual(expect.arrayContaining([
      "trigger.project-brief-gate.approved",
      "trigger.roadmap-gate.approved",
      "trigger.code-gate.approved"
    ]));

    config.policies.forEach((policy) => {
      actionOutputIds(config.actions, policy.action).forEach((outputId) => {
        const route = findProjectOutputRoute(config.outputRoutes, policy.id, outputId);
        const eventType = policyOutputEventType(policy, outputId);
        if (eventType.endsWith(".approved") && config.actions.find((action) => action.id === policy.action)?.humanGate) return;
        expect(route || eventPoliciesByEvent.has(eventType)).toBeTruthy();
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
    expect(saved.workflows[0]?.id).toBe(startWorkflowId);
    expect(saved.workflows[0]?.steps).toEqual([startPolicyId, "on.implementation.failed.start.implementation"]);
    expect(await readFile(instructionPath, "utf8")).toBe("# Code review\n");
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
          trigger: startTrigger,
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
      workflows: [{ id: "delivery", title: "Delivery", steps: ["start-delivery", "assign-developer"] }],
      runtimes: [{ id: "codex-runtime", title: "Codex runtime", command: "codex", args: [], outputEvents: { completed: "agent.output.completed" } }]
    };

    await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify(legacy), "utf8");

    const loaded = await loadProjectAutomationConfig(root, [agent]);
    expect(loaded).not.toHaveProperty("events");
    expect(loaded).not.toHaveProperty("gates");
    expect(loaded).not.toHaveProperty("gateDecisions");
    expect(loaded.humanGateResponses).toEqual([]);
    expect(loaded.actions).toEqual(expect.arrayContaining([
      { id: "run", description: "Run", outputIds: ["ok", "rework"], agentIds: ["developer-agent"] },
      expect.objectContaining({ id: "project-brief-gate", humanGate: true })
    ]));
    expect(loaded.outputs).toEqual(expect.arrayContaining([
      { id: "ok" },
      { id: "rework" },
      { id: "approved" },
      { id: "changes_requested" }
    ]));
    expect(loaded.outputRoutes).toEqual([]);
    expect(loaded.policies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: startPolicyId.replace(".start.implementation", ".start.run"),
        source: "trigger",
        trigger: startTrigger,
        action: "run"
      }),
      expect.objectContaining({
      id: "on.run.ok.start.run",
      source: "event",
      event: "run.ok",
      action: "run"
      })
    ]));
    expect(loaded.workflows[0]?.id).toBe(startWorkflowId);
    expect(loaded.workflows[0]?.steps).toEqual([startPolicyId.replace(".start.implementation", ".start.run"), "on.run.ok.start.run"]);
    expect(loaded.runtimes[0]).not.toHaveProperty("outputEvents");
  });

  it("normalizes legacy v1 output events and remaps workflow policy ids", async () => {
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
      workflows: [{
        id: "delivery",
        title: "Delivery",
        steps: ["start-delivery", "on.developer.implementation.ready.v1.then.developer.start.implementation"]
      }],
      runtimes: []
    }), "utf8");

    const loaded = await loadProjectAutomationConfig(root, [agent]);

    expect(loaded.policies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "on.trigger.intent_changed.ok.start.implementation",
        trigger: "intent_changed.ok"
      }),
      expect.objectContaining({
      id: "on.implementation.ok.start.implementation",
      event: "implementation.ok"
      })
    ]));
    expect(loaded).not.toHaveProperty("gates");
    expect(loaded).not.toHaveProperty("gateDecisions");
    expect(loaded.humanGateResponses).toEqual([]);
    expect(loaded.actions.some((action) => action.id === "intent_changed" && action.humanGate)).toBe(true);
    expect(loaded.outputs).toEqual([{ id: "ok" }, { id: "rework" }]);
    expect(loaded.outputRoutes).toEqual([]);
    expect(loaded.actions[0]?.outputIds).toEqual(["ok", "rework"]);
    expect(loaded.workflows[0]?.id).toBe("intent_changed.ok.loop");
    expect(loaded.workflows[0]?.steps).toEqual(["on.trigger.intent_changed.ok.start.implementation", "on.implementation.ok.start.implementation"]);
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
      workflows: [{
        id: startWorkflowId,
        title: "Delivery",
        steps: [startPolicyId, "on.implementation.roadmap_ready.start.implementation"]
      }]
    };

    const saved = await saveProjectAutomationConfig(root, config, [agent]);

    expect(saved.actions[0]?.outputIds).toEqual(["roadmap_ready"]);
    expect(saved.outputs).toEqual([{ id: "roadmap_ready" }, { id: "approved" }, { id: "changes_requested" }]);
    expect(automationPoliciesToEventDefinitions(
      saved.policies,
      saved.actions,
      saved.outputs
    ).map((event) => event.eventType)).toEqual(expect.arrayContaining(["implementation.roadmap_ready"]));
  });

  it("validates policy, runtime, and workflow references while ignoring legacy event definitions", () => {
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
    }, [agent]).some((issue) => issue.message === "Policy references unknown event: missing.event.")).toBe(true);

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
      actions: [...validConfig().actions, { id: "manual-gate", description: "Manual workflow stop.", outputIds: [], agentIds: [] }]
    };
    expect(validateProjectAutomationConfig(agentlessConfig, [agent])).toEqual([]);
    expect(validateProjectAutomationConfig({
      ...agentlessConfig,
      actions: agentlessConfig.actions.map((action) => action.id === "manual-gate" ? { ...action, outputIds: ["failed"] } : action)
    }, [agent]).some((issue) => issue.message === "Action without agents cannot select outputs.")).toBe(true);
    expect(agentlessConfig.actions.some((action) => action.id === "manual-gate")).toBe(true);

    const humanGateTrigger = humanGateApprovalTriggerId("human-review", "ok");
    const humanGatePolicy = {
      id: `on.trigger.${humanGateTrigger}.start.human-review`,
      source: "trigger" as const,
      trigger: humanGateTrigger,
      action: "human-review",
      enabled: true
    };
    const humanGateConfig: ProjectAutomationConfig = {
      ...validConfig(),
      actions: [{ id: "human-review", description: "Human review.", outputIds: ["ok", "failed"], agentIds: [], humanGate: true }],
      policies: [humanGatePolicy],
      workflows: [{ id: workflowIdFromTrigger(humanGateTrigger), title: "Delivery", steps: [humanGatePolicy.id] }]
    };
    const humanGateResponseBase = {
      workflowId: workflowIdFromTrigger(humanGateTrigger),
      policyId: humanGatePolicy.id,
      actionId: "human-review",
      outputId: "ok",
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
      actions: [{ ...validConfig().actions[0]!, outputIds: ["failed", "summary", "extra", "too-many"] }],
      outputs: [...validConfig().outputs, { id: "extra" }, { id: "too-many" }]
    }, [agent]).some((issue) => issue.message === "Action must define 1 or 2 outputs: approval and optional rework.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, outputIds: ["failed", "failed"] }]
    }, [agent]).some((issue) => issue.message === "Duplicate action output id: failed.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, outputIds: ["missing"] }]
    }, [agent]).some((issue) => issue.message === "Action references unknown output: missing.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, outputIds: ["summary"] }],
      policies: [startPolicy(), { ...validConfig().policies[1]!, event: "implementation.failed" }]
    }, [agent]).some((issue) => issue.message === "Policy references unknown event: implementation.failed.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, outputIds: ["ready"] }, startGateAction()],
      outputs: [{ id: "ready" }],
      policies: [
        startPolicy(),
        {
          id: "on.implementation.ready.start.implementation",
          source: "event",
          event: "implementation.ready",
          action: "implementation",
          enabled: true
        }
      ],
      workflows: [{ id: startWorkflowId, title: "Delivery", steps: [startPolicyId, "on.implementation.ready.start.implementation"] }]
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
          id: "on.implementation.completed.start.implementation",
          source: "event",
          event: "implementation.completed",
          action: "implementation",
          enabled: true
        }
      ],
      workflows: [{
        id: startWorkflowId,
        title: "Delivery",
        steps: [startPolicyId, "on.implementation.completed.start.implementation"]
      }]
    };
  expect(validateProjectAutomationConfig(completedConfig, [agent])).toEqual([]);
  expect(validateProjectAutomationConfig({
    ...completedConfig,
    policies: [completedConfig.policies[0]!, { ...completedConfig.policies[1]!, event: "implementation.unknown-output" }]
  }, [agent]).some((issue) => issue.message === "Policy references unknown event: implementation.unknown-output.")).toBe(true);
  });

  it("rejects object workflow steps instead of migrating them", () => {
    const issues = validateProjectAutomationConfig({
      ...validConfig(),
      workflows: [{
        id: "legacy",
        title: "Legacy",
        steps: [{ policy: "assign-developer", on: "task.created", agent: "developer-agent", action: "implementation", runtime: "codex-runtime" }]
      }]
    }, [agent]);

    expect(issues.some((issue) => issue.message === "Workflow step must be a policy id string.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Workflow step must not contain on.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Workflow step must not contain agent.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Workflow step must not contain action.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Workflow step must not contain runtime.")).toBe(true);
  });

  it("rejects workflow steps that reference missing policies", () => {
    const issues = validateProjectAutomationConfig({
      ...validConfig(),
      workflows: [{ id: "bad-workflow", title: "Bad workflow", steps: ["missing-policy"] }]
    }, [agent]);

    expect(issues.some((issue) => issue.message === "Workflow references unknown policy: missing-policy.")).toBe(true);
  });

  it("rejects workflows with multiple trigger entry policies", () => {
    const triggerId = humanGateApprovalTriggerId("human-review", "ok");
    const firstPolicy = {
      id: `on.trigger.${triggerId}.start.implementation`,
      source: "trigger" as const,
      trigger: triggerId,
      action: "implementation",
      enabled: true
    };
    const secondPolicy = {
      id: `on.trigger.${triggerId}.start.human-review`,
      source: "trigger" as const,
      trigger: triggerId,
      action: "human-review",
      enabled: true
    };
    const issues = validateProjectAutomationConfig({
      ...validConfig(),
      actions: [
        ...validConfig().actions,
        { id: "human-review", description: "Human review.", outputIds: ["ok", "failed"], agentIds: [], humanGate: true }
      ],
      policies: [firstPolicy, secondPolicy],
      workflows: [{ id: "bad-workflow", title: "Bad workflow", steps: [firstPolicy.id, secondPolicy.id] }]
    }, [agent]);

    expect(issues.some((issue) => issue.message === "Workflow can start from only one trigger policy.")).toBe(true);
  });

  it("validates output route references", () => {
    const humanGatePolicy = {
      id: "on.implementation.failed.start.human-review",
      source: "event" as const,
      event: "implementation.failed",
      action: "human-review",
      enabled: true
    };
    const routeConfig: ProjectAutomationConfig = {
      ...validConfig(),
      actions: [
        ...validConfig().actions,
        { id: "human-review", description: "Human review.", outputIds: ["ok", "failed"], agentIds: [], humanGate: true }
      ],
      policies: [...validConfig().policies, humanGatePolicy],
      outputRoutes: [{
        sourcePolicyId: humanGatePolicy.id,
        outputId: "failed",
        target: { type: "event", eventType: "human-review.failed.external" }
      }]
    };

    expect(validateProjectAutomationConfig(routeConfig, [agent])).toEqual([]);
    expect(validateProjectAutomationConfig({
      ...routeConfig,
      outputRoutes: [{ ...routeConfig.outputRoutes[0]!, target: { type: "trigger", trigger: "missing-trigger" } }]
    }, [agent]).some((issue) => issue.message === "Output route target type must be event.")).toBe(true);
    expect(validateProjectAutomationConfig({
      ...routeConfig,
      outputRoutes: [{ ...routeConfig.outputRoutes[0]!, outputId: "summary" }]
    }, [agent]).some((issue) =>
      issue.message === "Output route references unavailable output summary for policy on.implementation.failed.start.human-review."
    )).toBe(true);
    expect(validateProjectAutomationConfig({
      ...routeConfig,
      outputRoutes: [{
        sourcePolicyId: "on.implementation.failed.start.implementation",
        outputId: "ok",
        target: { type: "trigger", trigger: "manual-start" }
      }]
    }, [agent]).some((issue) => issue.message === "Output route target type must be event.")).toBe(true);
    expect(validateProjectAutomationConfig({
      ...routeConfig,
      outputRoutes: [{ ...routeConfig.outputRoutes[0]!, outputId: "ok" }]
    }, [agent]).some((issue) => issue.message === "Human gate approval output routes are derived automatically.")).toBe(true);
    expect(validateProjectAutomationConfig({
      ...routeConfig,
      policies: [
        ...routeConfig.policies,
        {
          id: "on.trigger.human-review.ok.start.human-review",
          source: "trigger",
          trigger: "human-review.ok",
          action: "human-review",
          enabled: true
        },
        {
          id: "on.trigger.human-review.ok.start.implementation",
          source: "trigger",
          trigger: "human-review.ok",
          action: "implementation",
          enabled: true
        }
      ]
    }, [agent]).some((issue) => issue.message === "Trigger human-review.ok can start only one policy/action.")).toBe(true);
  });

  it("migrates legacy gate output routes to human gate actions", () => {
    const gateRouteConfig = {
      ...validConfig(),
      gates: [{ id: "human-review", title: "Human review", description: "Review generated output." }],
      outputRoutes: [{
        sourcePolicyId: "on.implementation.failed.start.implementation",
        outputId: "ok",
        target: { type: "gate", gate: "human-review" }
      }]
    };
    const normalized = normalizeProjectAutomationConfig(gateRouteConfig);

    expect(normalized).not.toHaveProperty("gates");
    expect(normalized.outputRoutes).toEqual([]);
    expect(normalized.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "human-review", humanGate: true, agentIds: [], outputIds: ["ok", "rework"] })
    ]));
    expect(normalized.policies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "on.implementation.ok.start.human-review",
        source: "event",
        event: "implementation.ok",
        action: "human-review"
      })
    ]));
    expect(normalized.workflows[0]?.steps).toEqual([
      startPolicyId,
      "on.implementation.failed.start.implementation",
      "on.implementation.ok.start.human-review"
    ]);
    expect(validateProjectAutomationConfig(gateRouteConfig, [agent]).some((issue) =>
      issue.message === "Output route target type must be event."
    )).toBe(true);
    expect(validateProjectAutomationConfig(normalized, [agent])).toEqual([]);
  });

  it("validates automation field lengths", () => {
    const issues = validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, id: "a".repeat(41) }],
      outputs: [{ id: "x".repeat(33) }],
      workflows: [{ ...validConfig().workflows[0]!, title: "" }]
    }, [agent]);

    expect(issues.some((issue) => issue.message === "Action id must be 40 characters or fewer.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Output id must be 32 characters or fewer.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Workflow title is required.")).toBe(true);
  });

  it("accepts events derived from saved action outputs", () => {
    const reviewer: Agent = {
      ...agent,
      id: "reviewer-agent",
      name: "Reviewer Agent"
    };

    expect(validateProjectAutomationConfig(validConfig(), [agent, reviewer])).toEqual([]);
  });

  it("validates derived trigger-backed policies", () => {
    const triggerId = humanGateApprovalTriggerId("human-review", "ok");
    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [
        ...validConfig().actions,
        { id: "human-review", description: "Human review.", outputIds: ["ok", "failed"], agentIds: [], humanGate: true }
      ],
      policies: [{
        id: `on.trigger.${triggerId}.start.implementation`,
        source: "trigger",
        trigger: triggerId,
        action: "implementation",
        enabled: true
      }],
      workflows: [{ id: workflowIdFromTrigger(triggerId), title: "Delivery", steps: [`on.trigger.${triggerId}.start.implementation`] }]
    }, [agent])).toEqual([]);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{
        id: "on.trigger.missing.start.implementation",
        source: "trigger",
        trigger: "missing",
        action: "implementation",
        enabled: true
      }],
      workflows: [{ id: workflowIdFromTrigger("missing"), title: "Missing trigger", steps: ["on.trigger.missing.start.implementation"] }]
    }, [agent])).toEqual([]);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [
        ...validConfig().actions,
        { id: "human-review", description: "Human review.", outputIds: ["ok", "failed"], agentIds: [], humanGate: true }
      ],
      policies: [{
        id: "bad-policy",
        source: "trigger",
        event: "implementation.failed",
        trigger: triggerId,
        action: "implementation",
        enabled: true
      }]
    }, [agent]).some((issue) => issue.message === "Policy must reference either event or trigger, not both.")).toBe(true);

    expect(automationPoliciesToPolicies([{
      id: `on.trigger.${triggerId}.start.implementation`,
      source: "trigger",
      trigger: triggerId,
      action: "implementation",
      enabled: true
    }], [{ id: "implementation", description: "Implementation", outputIds: ["ok", "failed"], agentIds: ["developer-agent"] }])[0]?.eventTypes).toEqual([`trigger.${triggerId}`]);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{
        id: "on.trigger.plan-approved.start.implementation",
        source: "event",
        event: "trigger.plan-approved",
        action: "implementation",
        enabled: true
      }],
      workflows: [{ id: workflowIdFromTrigger("plan-approved"), title: "Delivery", steps: ["on.trigger.plan-approved.start.implementation"] }]
    }, [agent])).toEqual([]);
  });
});
