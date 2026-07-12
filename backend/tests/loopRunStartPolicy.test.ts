import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppData } from "../../shared/api/workspaceData.js";
import type { ProjectLoop } from "../../shared/domain/automation.js";
import { builtInLoopThemes, resolveLoopTheme } from "../../shared/domain/loopThemes.js";
import type { LoopRunDetails } from "../../shared/domain/runtime.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import type { LoopExecutionGateway } from "../services/LoopExecutionGateway.js";
import { LoopRunService } from "../services/LoopRunService.js";
import { validateLoopRunStart } from "../services/LoopRunStartPolicy.js";
import type { RuntimeDatabaseProvider } from "../services/RuntimeDatabaseProvider.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const loop = (id: string): ProjectLoop => ({
  id,
  theme: "open-ai",
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
    nodeSize: "medium",
    on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
  }]
});

const data = (projectRoot: string, loopIds: string[]): AppData => ({
  projects: [],
  goals: [],
  adrs: [],
  agents: [],
  skills: [],
  policies: [],
  eventDefinitions: [],
  events: [],
  loopRuns: [],
  scheduleStates: [],
  automation: { version: 6, loops: loopIds.map(loop) },
  automationIssues: [],
  loopThemes: [...builtInLoopThemes],
  loopThemeIssues: [],
  projectRoot
});

const projectWithTasks = async (content = "# Tasks\n\n## task-001\n") => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-loop-policy-"));
  roots.push(root);
  const outputs = path.join(root, ".ballet", "outputs");
  await mkdir(outputs, { recursive: true });
  await writeFile(path.join(outputs, "TASKS.md"), content, "utf8");
  return root;
};

const service = (workspace: AppData) => {
  const run: LoopRunDetails = {
    runId: "run-1",
    loopId: workspace.automation.loops[0]!.id,
    rootRunId: "run-1",
    source: "manual",
    status: "running",
    snapshot: workspace.automation.loops[0]!,
    themeSnapshot: resolveLoopTheme(builtInLoopThemes, workspace.automation.loops[0]!.theme),
    transitionCount: 0,
    stepRuns: [],
    createdAt: "2026-07-11T08:00:00.000Z",
    updatedAt: "2026-07-11T08:00:00.000Z"
  };
  const runtime = {
    startLoopRun: vi.fn(() => run),
    getLoopRun: vi.fn(() => run)
  } as unknown as RuntimeDatabase;
  const gateway: LoopExecutionGateway = {
    prepare: vi.fn(async () => undefined),
    enqueuePending: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    finalizeIfTerminal: vi.fn(async () => undefined)
  };
  const instance = new LoopRunService(
    async () => workspace,
    { runtimeDatabase: () => runtime } as RuntimeDatabaseProvider
  );
  instance.setExecutionGateway(gateway);
  return { instance, runtime, gateway };
};

describe("loop engineering root-start policy", () => {
  it("blocks a Run when a reachable Loop references an unknown theme", async () => {
    const root = await projectWithTasks();
    const workspace = data(root, ["delivery", "release"]);
    const rootStep = workspace.automation.loops[0]!.steps[0]!;
    if (!("approved" in rootStep.on)) throw new Error("Expected executable root step.");
    rootStep.on.approved = { loop: "release" };
    workspace.automation.loops[1]!.theme = "missing-project-theme";
    const test = service(workspace);

    await expect(test.instance.start("delivery", "Ship it"))
      .rejects.toThrow("Cannot start a loop while its theme is invalid.");
    expect(test.gateway.prepare).not.toHaveBeenCalled();
    expect(test.runtime.startLoopRun).not.toHaveBeenCalled();
  });

  it.each(["ui-design", "implementation"])("accepts one known task for %s", async (loopId) => {
    const root = await projectWithTasks();
    const test = service(data(root, [loopId]));
    await expect(test.instance.start(loopId, "context\ntask_id: task-001")).resolves.toMatchObject({ loopId });
    expect(test.gateway.prepare).toHaveBeenCalledOnce();
    expect(test.runtime.startLoopRun).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing", "Ship it"],
    ["malformed", "task_id: task-1"],
    ["multiple", "task_id: task-001\ntask_id: task-002"]
  ])("rejects a %s task declaration before execution", async (_case, input) => {
    const root = await projectWithTasks("# Tasks\n\ntask-001\ntask-002\n");
    const test = service(data(root, ["implementation"]));
    await expect(test.instance.start("implementation", input))
      .rejects.toThrow("exactly one line in the form task_id: task-NNN");
    expect(test.gateway.prepare).not.toHaveBeenCalled();
    expect(test.runtime.startLoopRun).not.toHaveBeenCalled();
  });

  it("rejects an unknown task before execution", async () => {
    const root = await projectWithTasks();
    const test = service(data(root, ["implementation"]));
    await expect(test.instance.start("implementation", "task_id: task-999"))
      .rejects.toThrow("task_id task-999 must have exactly one ## task-999 declaration");
    expect(test.gateway.prepare).not.toHaveBeenCalled();
  });

  it("does not treat a task cross-reference as a declaration", async () => {
    const root = await projectWithTasks("# Tasks\n\n## task-001 — Active\n\nDepends on removed task-999.\n");
    const test = service(data(root, ["implementation"]));
    await expect(test.instance.start("implementation", "task_id: task-999"))
      .rejects.toThrow("exactly one ## task-999 declaration");
  });

  it("rejects duplicate task declarations", async () => {
    const root = await projectWithTasks("# Tasks\n\n## task-001 — First\n\n## task-001 — Duplicate\n");
    const test = service(data(root, ["implementation"]));
    await expect(test.instance.start("implementation", "task_id: task-001"))
      .rejects.toThrow("exactly one ## task-001 declaration");
  });

  it("rejects a task-scoped run when TASKS.md is unavailable", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ballet-loop-policy-"));
    roots.push(root);
    const test = service(data(root, ["ui-design"]));
    await expect(test.instance.start("ui-design", "task_id: task-001"))
      .rejects.toThrow(".ballet/outputs/TASKS.md is unavailable");
  });

  it("blocks direct root starts of the gated deployment loop", async () => {
    const root = await projectWithTasks();
    const test = service(data(root, ["dev-deployment"]));
    await expect(test.instance.start("dev-deployment", "task_id: task-001"))
      .rejects.toThrow("can only start from its approved human-gate transition");
    expect(test.gateway.prepare).not.toHaveBeenCalled();
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
      description: "Start implementation on schedule.",
      nodeSize: "small",
      schedule: { kind: "once", date: "2026-07-12", time: "09:00", timeZone: "UTC" },
      on: { triggered: "work" }
    });

    await expect(validateLoopRunStart(workspace, "implementation"))
      .rejects.toThrow("implementation input must contain exactly one line in the form task_id: task-NNN.");
    await expect(validateLoopRunStart(workspace, "implementation", "task_id: task-001"))
      .resolves.toBeUndefined();
  });
});
