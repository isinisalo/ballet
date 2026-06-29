import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent, ProjectAutomationConfig } from "../shared/domain.js";
import {
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
  events: [
    { id: "task.created", title: "Task created", source: "user" },
    { id: "agent.output.completed", title: "Agent output completed", source: "runtime" },
    { id: "agent.output.failed", title: "Agent output failed", source: "runtime" }
  ],
  policies: [
    {
      id: "assign-developer",
      title: "Assign developer",
      on: "task.created",
      run: {
        agent: "developer-agent",
        runtime: "codex-runtime"
      },
      enabled: true
    }
  ],
  workflows: [
    {
      id: "delivery",
      title: "Delivery",
      steps: ["assign-developer"]
    }
  ],
  runtimes: [
    {
      id: "codex-runtime",
      title: "Codex runtime",
      command: "codex",
      args: ["app-server", "--listen", "stdio://"],
      outputEvents: {
        completed: "agent.output.completed",
        failed: "agent.output.failed"
      }
    }
  ]
});

describe("project automation config", () => {
  it("returns default config when .ballet/project.json is missing", async () => {
    await expect(loadProjectAutomationConfig(await tempRoot())).resolves.toEqual({
      version: 1,
      events: [],
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
    expect(saved.workflows[0]?.steps).toEqual(["assign-developer"]);
    expect(await readFile(instructionPath, "utf8")).toBe("# Code review\n");
  });

  it("validates event, policy, runtime, and workflow references", () => {
    expect(validateProjectAutomationConfig(validConfig(), [agent])).toEqual([]);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      events: [{ id: "", title: "Missing id", source: "runtime" }]
    }, [agent]).some((issue) => issue.message === "Event id is required.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      events: [
        { id: "task.created", title: "Task created", source: "user" },
        { id: "task.created", title: "Duplicate", source: "runtime" }
      ]
    }, [agent]).some((issue) => issue.message === "Duplicate event id: task.created.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{ ...validConfig().policies[0]!, on: "" }]
    }, [agent]).some((issue) => issue.message === "Policy on event is required.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{ ...validConfig().policies[0]!, on: "missing.event" }]
    }, [agent]).some((issue) => issue.message === "Policy references unknown event: missing.event.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{ ...validConfig().policies[0]!, run: { agent: "developer-agent", runtime: "missing-runtime" } }]
    }, [agent]).some((issue) => issue.message === "Policy references unknown runtime: missing-runtime.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      policies: [{ ...validConfig().policies[0]!, run: { agent: "missing-agent", runtime: "codex-runtime" } }]
    }, [agent]).some((issue) => issue.message === "Policy references unknown agent: missing-agent.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      runtimes: [{ ...validConfig().runtimes[0]!, command: "" }]
    }, [agent]).some((issue) => issue.message === "Runtime command is required.")).toBe(true);

    expect(validateProjectAutomationConfig({
      ...validConfig(),
      runtimes: [{ ...validConfig().runtimes[0]!, outputEvents: { completed: "missing.event" } }]
    }, [agent]).some((issue) => issue.message === "Runtime output event references unknown event: missing.event.")).toBe(true);
  });

  it("rejects object workflow steps instead of migrating them", () => {
    const issues = validateProjectAutomationConfig({
      ...validConfig(),
      workflows: [{
        id: "legacy",
        title: "Legacy",
        steps: [{ policy: "assign-developer", on: "task.created", agent: "developer-agent", runtime: "codex-runtime" }]
      }]
    }, [agent]);

    expect(issues.some((issue) => issue.message === "Workflow step must be a policy id string.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Workflow step must not contain on.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Workflow step must not contain agent.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Workflow step must not contain runtime.")).toBe(true);
  });

  it("rejects workflow steps that reference missing policies", () => {
    const issues = validateProjectAutomationConfig({
      ...validConfig(),
      workflows: [{ id: "bad-workflow", title: "Bad workflow", steps: ["missing-policy"] }]
    }, [agent]);

    expect(issues.some((issue) => issue.message === "Workflow references unknown policy: missing-policy.")).toBe(true);
  });
});
