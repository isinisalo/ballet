import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import {
  automationPoliciesToEventDefinitions,
  automationPoliciesToPolicies,
  loadProjectAutomationConfig,
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

const validConfig = (): ProjectAutomationConfig => ({
  version: 1,
  triggers: [],
  actions: [
    {
      id: "implementation",
      description: "Implement approved work.",
      outputIds: ["ok", "failed"],
      agentIds: ["developer-agent"]
    }
  ],
  outputs: [{ id: "ok" }, { id: "failed" }, { id: "summary" }],
  policies: [
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
      id: "delivery",
      title: "Delivery",
      steps: ["on.implementation.failed.start.implementation"]
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
      triggers: [],
      actions: [],
      outputs: [
        { id: "ok" },
        { id: "rework" }
      ],
      policies: [],
      workflows: [],
      runtimes: []
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
    expect(saved.policies[0]?.id).toBe("on.implementation.failed.start.implementation");
    expect(saved.workflows[0]?.steps).toEqual(["on.implementation.failed.start.implementation"]);
    expect(await readFile(instructionPath, "utf8")).toBe("# Code review\n");
  });

  it("normalizes legacy policy fields to event and action agents", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    const legacy = {
      version: 1,
      events: [{ id: "task.created", title: "Task created", source: "user" }],
      policies: [{
        id: "assign-developer",
        title: "Assign developer",
        on: "developer.run.ready",
        run: { agent: "developer-agent", runtime: "codex-runtime" },
        enabled: true
      }],
      workflows: [{ id: "delivery", title: "Delivery", steps: ["assign-developer"] }],
      runtimes: [{ id: "codex-runtime", title: "Codex runtime", command: "codex", args: [], outputEvents: { completed: "agent.output.completed" } }]
    };

    await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify(legacy), "utf8");

    const loaded = await loadProjectAutomationConfig(root, [agent]);
    expect(loaded).not.toHaveProperty("events");
    expect(loaded).not.toHaveProperty("gates");
    expect(loaded.actions).toEqual([{ id: "run", description: "", outputIds: ["ok", "rework"], agentIds: ["developer-agent"] }]);
    expect(loaded.outputs).toEqual([
      { id: "ok" },
      { id: "rework" }
    ]);
    expect(loaded.policies[0]).toMatchObject({
      id: "on.run.ok.start.run",
      source: "event",
      event: "run.ok",
      action: "run"
    });
    expect(loaded.workflows[0]?.steps).toEqual(["on.run.ok.start.run"]);
    expect(loaded.runtimes[0]).not.toHaveProperty("outputEvents");
  });

  it("normalizes legacy v1 output events and remaps workflow policy ids", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify({
      version: 1,
      triggers: [],
      gates: [{ id: "intent_changed", description: "Intent changed gate" }],
      actions: [{ id: "implementation", description: "Implement approved work." }],
      outputs: [],
      policies: [{
        id: "on.developer.implementation.ready.v1.then.developer.start.implementation",
        source: "event",
        event: "developer.implementation.ready.v1",
        agent: "developer",
        action: "implementation",
        enabled: true
      }],
      workflows: [{
        id: "delivery",
        title: "Delivery",
        steps: ["on.developer.implementation.ready.v1.then.developer.start.implementation"]
      }],
      runtimes: []
    }), "utf8");

    const loaded = await loadProjectAutomationConfig(root, [agent]);

    expect(loaded.policies[0]).toMatchObject({
      id: "on.implementation.ok.start.implementation",
      event: "implementation.ok"
    });
    expect(loaded).not.toHaveProperty("gates");
    expect(loaded.outputs).toEqual([{ id: "ok" }, { id: "rework" }]);
    expect(loaded.actions[0]?.outputIds).toEqual(["ok", "rework"]);
    expect(loaded.workflows[0]?.steps).toEqual(["on.implementation.ok.start.implementation"]);
  });

  it("preserves one-output agent actions as approval-only actions", async () => {
    const root = await tempRoot();
    const config: ProjectAutomationConfig = {
      ...validConfig(),
      actions: [{
        id: "implementation",
        description: "Implement approved work.",
        outputIds: ["roadmap_ready"],
        agentIds: ["developer-agent"]
      }],
      outputs: [{ id: "roadmap_ready" }],
      policies: [{
        id: "on.implementation.roadmap_ready.start.implementation",
        source: "event",
        event: "implementation.roadmap_ready",
        action: "implementation",
        enabled: true
      }],
      workflows: [{
        id: "delivery",
        title: "Delivery",
        steps: ["on.implementation.roadmap_ready.start.implementation"]
      }]
    };

    const saved = await saveProjectAutomationConfig(root, config, [agent]);

    expect(saved.actions[0]?.outputIds).toEqual(["roadmap_ready"]);
    expect(saved.outputs).toEqual([{ id: "roadmap_ready" }]);
    expect(automationPoliciesToEventDefinitions(
      saved.policies,
      saved.triggers,
      saved.actions,
      saved.outputs
    ).map((event) => event.eventType)).toEqual(["implementation.roadmap_ready"]);
  });

  it("validates policy, runtime, and workflow references while ignoring legacy event definitions", () => {
    expect(validateProjectAutomationConfig(validConfig(), [agent])).toEqual([]);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      events: [{ id: "", title: "", source: "", payloadSchema: "not-an-object" }]
    }, [agent])).toEqual([]);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{ ...validConfig().policies[0]!, event: "" }]
    }, [agent]).some((issue) => issue.message === "Policy event is required.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{ ...validConfig().policies[0]!, event: "missing.event" }]
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
      actions: [{ id: "manual-gate", description: "Manual workflow stop.", outputIds: [], agentIds: [] }],
      policies: [{
        id: "on.trigger.manual-start.start.manual-gate",
        source: "trigger",
        trigger: "manual-start",
        action: "manual-gate",
        enabled: true
      }],
      triggers: [{ id: "manual-start", description: "Manual workflow start" }],
      workflows: [{ id: "delivery", title: "Delivery", steps: ["on.trigger.manual-start.start.manual-gate"] }]
    };
    expect(validateProjectAutomationConfig(agentlessConfig, [agent])).toEqual([]);
    expect(validateProjectAutomationConfig({
      ...agentlessConfig,
      actions: [{ ...agentlessConfig.actions[0]!, outputIds: ["failed"] }]
    }, [agent]).some((issue) => issue.message === "Action without agents cannot select outputs.")).toBe(true);
    expect(automationPoliciesToEventDefinitions(
      agentlessConfig.policies,
      agentlessConfig.triggers,
      agentlessConfig.actions,
      agentlessConfig.outputs
    ).map((event) => event.eventType)).toEqual(["trigger.manual-start"]);

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
      policies: [{ ...validConfig().policies[0]!, event: "implementation.failed" }]
    }, [agent]).some((issue) => issue.message === "Policy references unknown event: implementation.failed.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, outputIds: ["ready"] }],
      outputs: [{ id: "ready" }],
      policies: [{
        id: "on.implementation.ready.start.implementation",
        source: "event",
        event: "implementation.ready",
        action: "implementation",
        enabled: true
      }],
      workflows: [{ id: "delivery", title: "Delivery", steps: ["on.implementation.ready.start.implementation"] }]
    }, [agent])).toEqual([]);

    const completedConfig: ProjectAutomationConfig = {
      ...validConfig(),
      actions: [{ id: "implementation", description: "Implement approved work.", outputIds: ["completed", "failed", "blocked"], agentIds: ["developer-agent"] }],
      outputs: [
        { id: "completed" },
        { id: "failed" },
        { id: "blocked" }
      ],
      policies: [{
        id: "on.implementation.completed.start.implementation",
        source: "event",
        event: "implementation.completed",
        action: "implementation",
        enabled: true
      }],
      workflows: [{
        id: "delivery",
        title: "Delivery",
        steps: ["on.implementation.completed.start.implementation"]
      }]
    };
    expect(validateProjectAutomationConfig(completedConfig, [agent])).toEqual([]);
    expect(validateProjectAutomationConfig({
      ...completedConfig,
      policies: [{ ...completedConfig.policies[0]!, event: "implementation.unknown-output" }]
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

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{
        id: "on.implementation.failed.start.implementation",
        source: "event",
        event: "implementation.failed",
        action: "implementation",
        enabled: true
      }],
      workflows: [{
        id: "delivery",
        title: "Delivery",
        steps: ["on.implementation.failed.start.implementation"]
      }]
    }, [agent, reviewer])).toEqual([]);
  });

  it("validates trigger-backed policies", () => {
    expect(validateProjectAutomationConfig({
      ...validConfig(),
      triggers: [{ id: "plan_approved", description: "Plan approved" }],
      policies: [{
        id: "on.trigger.plan_approved.start.implementation",
        source: "trigger",
        trigger: "plan_approved",
        action: "implementation",
        enabled: true
      }],
      workflows: [{ id: "delivery", title: "Delivery", steps: ["on.trigger.plan_approved.start.implementation"] }]
    }, [agent])).toEqual([]);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{
        id: "on.trigger.missing.start.implementation",
        source: "trigger",
        trigger: "missing",
        action: "implementation",
        enabled: true
      }]
    }, [agent]).some((issue) => issue.message === "Policy references unknown trigger: missing.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      triggers: [{ id: "plan_approved", description: "Plan approved" }],
      policies: [{
        id: "bad-policy",
        source: "trigger",
        event: "implementation.failed",
        trigger: "plan_approved",
        action: "implementation",
        enabled: true
      }]
    }, [agent]).some((issue) => issue.message === "Policy must reference either event or trigger, not both.")).toBe(true);

    expect(automationPoliciesToPolicies([{
      id: "on.trigger.plan_approved.start.implementation",
      source: "trigger",
      trigger: "plan_approved",
      action: "implementation",
      enabled: true
    }], [{ id: "implementation", description: "Implementation", outputIds: ["ok", "failed"], agentIds: ["developer-agent"] }])[0]?.eventTypes).toEqual(["trigger.plan_approved"]);
  });
});
