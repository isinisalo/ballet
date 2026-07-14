import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppData } from "../../shared/api/workspace-contracts.js";
import type { ProjectLoop } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import { validateLoopRunStart } from "../services/LoopRunStartPolicy.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const loop = (id: string): ProjectLoop => ({
  id,
  start: "work",
  steps: [{
    id: "work",
    type: "agent",
    agentId: ({
      "ui-design": "ui-design-agent",
      implementation: "implementation-agent",
      "dev-deployment": "dev-deploy-agent"
    } as Record<string, string>)[id] ?? "worker",
    description: "Work.",
    nodeStyle: "terra",
    on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
  }]
});

const data = (projectRoot: string, loopIds: string[]): AppData => ({
  project: {
    id: "fixture", name: "Fixture", description: "Fixture checkout", status: "active",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
  },
  agents: [],
  skills: [],
  loopRuns: [],
  scheduleStates: [],
  automation: { version: 7, loops: loopIds.map(loop) },
  automationIssues: [],
  loopTheme: structuredClone(defaultLoopTheme),
  loopThemeIssues: [],
  runtime: {
    instanceId: "fixture", hostname: "localhost", platform: "darwin", architecture: "arm64",
    checkout: { path: projectRoot, headSha: "a".repeat(40), configHash: "config", dirty: false },
    uptimeSeconds: 0, startedAt: "2026-01-01T00:00:00.000Z", providers: [], activeRunCount: 0,
    logsPath: path.join(projectRoot, ".git", "ballet", "logs", "ballet.log")
  },
  agentRuntimeConfigurations: {},
  executionStates: [],
  runTargets: { loops: [], agents: [] },
  projectDocumentTree: []
});

const projectWithTasks = async (content = "# Tasks\n\n## task-001\n") => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-loop-policy-"));
  roots.push(root);
  const outputs = path.join(root, ".ballet", "outputs");
  await mkdir(outputs, { recursive: true });
  await writeFile(path.join(outputs, "TASKS.md"), content, "utf8");
  return root;
};

describe("loop engineering root-start policy", () => {
  it.each(["ui-design", "implementation"])("accepts one known task for %s", async (loopId) => {
    const root = await projectWithTasks();
    await expect(validateLoopRunStart(data(root, [loopId]), loopId, "context\ntask_id: task-001"))
      .resolves.toBeUndefined();
  });

  it.each([
    ["missing", "Ship it"],
    ["malformed", "task_id: task-1"],
    ["multiple", "task_id: task-001\ntask_id: task-002"]
  ])("rejects a %s task declaration before execution", async (_case, input) => {
    const root = await projectWithTasks("# Tasks\n\ntask-001\ntask-002\n");
    await expect(validateLoopRunStart(data(root, ["implementation"]), "implementation", input))
      .rejects.toThrow("exactly one line in the form task_id: task-NNN");
  });

  it("rejects an unknown task before execution", async () => {
    const root = await projectWithTasks();
    await expect(validateLoopRunStart(data(root, ["implementation"]), "implementation", "task_id: task-999"))
      .rejects.toThrow("task_id task-999 must have exactly one ## task-999 declaration");
  });

  it("does not treat a task cross-reference as a declaration", async () => {
    const root = await projectWithTasks("# Tasks\n\n## task-001 — Active\n\nDepends on removed task-999.\n");
    await expect(validateLoopRunStart(data(root, ["implementation"]), "implementation", "task_id: task-999"))
      .rejects.toThrow("exactly one ## task-999 declaration");
  });

  it("rejects duplicate task declarations", async () => {
    const root = await projectWithTasks("# Tasks\n\n## task-001 — First\n\n## task-001 — Duplicate\n");
    await expect(validateLoopRunStart(data(root, ["implementation"]), "implementation", "task_id: task-001"))
      .rejects.toThrow("exactly one ## task-001 declaration");
  });

  it("rejects a task-scoped run when TASKS.md is unavailable", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ballet-loop-policy-"));
    roots.push(root);
    await expect(validateLoopRunStart(data(root, ["ui-design"]), "ui-design", "task_id: task-001"))
      .rejects.toThrow(".ballet/outputs/TASKS.md is unavailable");
  });

  it("blocks direct root starts of the gated deployment loop", async () => {
    const root = await projectWithTasks();
    await expect(validateLoopRunStart(data(root, ["dev-deployment"]), "dev-deployment", "task_id: task-001"))
      .rejects.toThrow("can only start from its approved human-gate transition");
  });

  it("does not impose the task contract on other loops", async () => {
    const root = await projectWithTasks();
    await expect(validateLoopRunStart(data(root, ["delivery-planning"]), "delivery-planning"))
      .resolves.toBeUndefined();
  });

  it("does not apply the convention to a same-named loop with another start agent", async () => {
    const root = await projectWithTasks();
    const workspace = data(root, ["implementation"]);
    const start = workspace.automation.loops[0]!.steps[0]!;
    if (start.type === "agent") start.agentId = "custom-worker";
    await expect(validateLoopRunStart(workspace, "implementation")).resolves.toBeUndefined();
  });

  it("enforces task input behind a scheduled start", async () => {
    const root = await projectWithTasks();
    const workspace = data(root, ["implementation"]);
    const implementation = workspace.automation.loops[0]!;
    implementation.start = "timer";
    implementation.steps.unshift({
      id: "timer",
      type: "scheduled",
      agentId: "implementation-agent",
      description: "Start implementation on schedule.",
      nodeStyle: "luna",
      schedule: { kind: "once", date: "2026-07-12", time: "09:00", timeZone: "UTC" },
      on: { approved: "work", rejected: { end: "blocked" } }
    });

    await expect(validateLoopRunStart(workspace, "implementation"))
      .rejects.toThrow("implementation input must contain exactly one line in the form task_id: task-NNN.");
    await expect(validateLoopRunStart(workspace, "implementation", "task_id: task-001"))
      .resolves.toBeUndefined();
  });
});
