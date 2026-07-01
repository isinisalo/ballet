import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent, ProjectAutomationConfig } from "../../shared/domain.js";
import {
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
      description: "Implement approved work."
    }
  ],
  policies: [
    {
      id: "on.developer.implementation.failed.then.developer.start.implementation",
      source: "event",
      event: "developer.implementation.failed",
      agent: "developer",
      action: "implementation",
      enabled: true
    }
  ],
  workflows: [
    {
      id: "delivery",
      title: "Delivery",
      steps: ["on.developer.implementation.failed.then.developer.start.implementation"]
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
    expect(saved.policies[0]?.id).toBe("on.developer.implementation.failed.then.developer.start.implementation");
    expect(saved.workflows[0]?.steps).toEqual(["on.developer.implementation.failed.then.developer.start.implementation"]);
    expect(await readFile(instructionPath, "utf8")).toBe("# Code review\n");
  });

  it("normalizes legacy policy fields to event, agent, and action", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    const legacy = {
      version: 1,
      events: [{ id: "task.created", title: "Task created", source: "user" }],
      policies: [{
        id: "assign-developer",
        title: "Assign developer",
        on: "developer.run.failed",
        run: { agent: "developer-agent", runtime: "codex-runtime" },
        enabled: true
      }],
      workflows: [{ id: "delivery", title: "Delivery", steps: ["assign-developer"] }],
      runtimes: [{ id: "codex-runtime", title: "Codex runtime", command: "codex", args: [], outputEvents: { completed: "agent.output.completed" } }]
    };

    await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify(legacy), "utf8");

    const loaded = await loadProjectAutomationConfig(root, [agent]);
    expect(loaded).not.toHaveProperty("events");
    expect(loaded.actions).toEqual([{ id: "run", description: "" }]);
    expect(loaded.policies[0]).toMatchObject({
      id: "on.developer.run.failed.then.developer.start.run",
      source: "event",
      event: "developer.run.failed",
      agent: "developer",
      action: "run"
    });
    expect(loaded.workflows[0]?.steps).toEqual(["on.developer.run.failed.then.developer.start.run"]);
    expect(loaded.runtimes[0]).not.toHaveProperty("outputEvents");
  });

  it("normalizes legacy v1 output events and remaps workflow policy ids", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify({
      version: 1,
      triggers: [],
      actions: [{ id: "implementation", description: "Implement approved work." }],
      policies: [{
        id: "on.developer.implementation.failed.v1.then.developer.start.implementation",
        source: "event",
        event: "developer.implementation.failed.v1",
        agent: "developer",
        action: "implementation",
        enabled: true
      }],
      workflows: [{
        id: "delivery",
        title: "Delivery",
        steps: ["on.developer.implementation.failed.v1.then.developer.start.implementation"]
      }],
      runtimes: []
    }), "utf8");

    const loaded = await loadProjectAutomationConfig(root, [agent]);

    expect(loaded.policies[0]).toMatchObject({
      id: "on.developer.implementation.failed.then.developer.start.implementation",
      event: "developer.implementation.failed"
    });
    expect(loaded.workflows[0]?.steps).toEqual(["on.developer.implementation.failed.then.developer.start.implementation"]);
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
      policies: [{ ...validConfig().policies[0]!, agent: "missing-agent" }]
    }, [agent]).some((issue) => issue.message === "Policy references unknown agent: missing-agent.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      runtimes: [{ ...validConfig().runtimes[0]!, command: "" }]
    }, [agent]).some((issue) => issue.message === "Runtime command is required.")).toBe(true);

    const configWithLegacyRuntimeOutput = {
      ...validConfig(),
      runtimes: [{ ...validConfig().runtimes[0]!, outputEvents: { completed: "missing.event" } }]
    };
    expect(validateProjectAutomationConfig(configWithLegacyRuntimeOutput, [agent])).toEqual([]);
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

  it("accepts events derived from any saved agent and action pair", () => {
    const reviewer: Agent = {
      ...agent,
      id: "reviewer-agent",
      name: "Reviewer Agent"
    };

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{
        id: "on.reviewer.implementation.complete.then.developer.start.implementation",
        source: "event",
        event: "reviewer.implementation.complete",
        agent: "developer",
        action: "implementation",
        enabled: true
      }],
      workflows: [{
        id: "delivery",
        title: "Delivery",
        steps: ["on.reviewer.implementation.complete.then.developer.start.implementation"]
      }]
    }, [agent, reviewer])).toEqual([]);
  });

  it("validates trigger-backed policies", () => {
    expect(validateProjectAutomationConfig({
      ...validConfig(),
      triggers: [{ id: "plan_approved", description: "Plan approved" }],
      policies: [{
        id: "on.trigger.plan_approved.then.developer.start.implementation",
        source: "trigger",
        trigger: "plan_approved",
        agent: "developer",
        action: "implementation",
        enabled: true
      }],
      workflows: [{ id: "delivery", title: "Delivery", steps: ["on.trigger.plan_approved.then.developer.start.implementation"] }]
    }, [agent])).toEqual([]);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{
        id: "on.trigger.missing.then.developer.start.implementation",
        source: "trigger",
        trigger: "missing",
        agent: "developer",
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
        event: "developer.implementation.failed",
        trigger: "plan_approved",
        agent: "developer",
        action: "implementation",
        enabled: true
      }]
    }, [agent]).some((issue) => issue.message === "Policy must reference either event or trigger, not both.")).toBe(true);

    expect(automationPoliciesToPolicies([{
      id: "on.trigger.plan_approved.then.developer.start.implementation",
      source: "trigger",
      trigger: "plan_approved",
      agent: "developer",
      action: "implementation",
      enabled: true
    }], [agent])[0]?.eventTypes).toEqual(["trigger.plan_approved"]);
  });
});
