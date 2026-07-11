import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import type { AppData } from "../../shared/api/workspaceData.js";
import type { Agent } from "../../shared/domain/agents.js";
import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import type { AgentOutcome, RuntimeProvider } from "../../shared/domain/runtime.js";
import { createControlPlane } from "../control-plane/createControlPlane.js";
import type { DaemonIdentity } from "../control-plane/PairingStore.js";
import type { DaemonHeartbeat } from "../control-plane/RuntimeRegistryStore.js";
import { LoopExecutionCoordinator } from "../integration/LoopExecutionCoordinator.js";
import { RuntimeDatabase } from "../runtime-db.js";

const PROJECT_ID = "project";
const REPOSITORY_URL = "https://example.test/repo.git";
const SNAPSHOT_HASH = "c".repeat(64);
const NOW = "2026-07-11T08:00:00.000Z";
const roots: string[] = [];
const controls: Array<ReturnType<typeof createControlPlane>> = [];
const runtimes: RuntimeDatabase[] = [];

afterEach(async () => {
  controls.splice(0).forEach((control) => control.close());
  runtimes.splice(0).forEach((runtime) => runtime.close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

type TestContext = Awaited<ReturnType<typeof context>>;

const context = async (data: AppData, options: { freshCheckoutBeforeRun?: boolean } = {}) => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-loop-execution-"));
  roots.push(root);
  const runtime = new RuntimeDatabase(path.join(root, "runs.sqlite"), PROJECT_ID);
  runtimes.push(runtime);
  const execution: { coordinator?: LoopExecutionCoordinator } = {};
  const control = createControlPlane({
    dbPath: path.join(root, "control.sqlite"),
    maintenance: false,
    now: () => new Date(NOW),
    project: { id: PROJECT_ID, repositoryUrl: REPOSITORY_URL, checkoutPath: root },
    onTaskState: (task) => execution.coordinator?.markTaskState(task),
    onTaskTerminal: (task) => execution.coordinator?.handleTerminal(task),
    freshCheckoutBeforeRun: options.freshCheckoutBeforeRun,
    freshCheckoutTimeoutMs: 1_000
  });
  controls.push(control);
  const coordinator = new LoopExecutionCoordinator({
    controlPlane: control.service,
    database: () => runtime,
    readData: async () => data,
    now: () => new Date(NOW)
  });
  execution.coordinator = coordinator;
  return { root, data, runtime, control, coordinator };
};

const pairDevice = (test: TestContext, name: string, definitions: Array<{ provider: RuntimeProvider; model: string }>) => {
  const pairing = test.control.service.createPairing(name);
  test.control.service.approvePairing(pairing.id);
  const paired = test.control.service.pollPairing({
    deviceCode: pairing.deviceCode,
    hostname: `${name.toLowerCase().replaceAll(" ", "-")}.local`,
    displayName: name,
    platform: "darwin",
    architecture: "arm64",
    daemonVersion: "1.0.0",
    daemonId: uuid()
  });
  if (!paired.daemonToken || !paired.deviceId) throw new Error("Pairing did not return daemon credentials.");
  const identity = test.control.service.authenticateDaemon(paired.daemonToken);
  const backendIds: Partial<Record<RuntimeProvider, string>> = {};
  const backends = definitions.map(({ provider, model }) => {
    const id = uuid();
    backendIds[provider] = id;
    return {
      id,
      provider,
      cliVersion: "1.2.3",
      executablePath: `/usr/local/bin/${provider}`,
      authStatus: "ready" as const,
      health: "ready" as const,
      capabilities: {
        models: [{ id: model, label: model, reasoningOptions: ["high"], defaultReasoning: "high" }],
        supportsResume: true,
        supportsStructuredOutput: true,
        policy: { workspaceWrite: true, networkControl: true, readOnlyRoots: true },
        refreshedAt: NOW
      }
    };
  });
  const heartbeat: DaemonHeartbeat = {
    daemonVersion: "1.0.0",
    uptimeSeconds: 42,
    backends,
    checkout: {
      repositoryUrl: REPOSITORY_URL,
      path: path.join(test.root, name),
      headSha: "b".repeat(40),
      configHash: SNAPSHOT_HASH,
      dirty: false,
      lastInspectedAt: NOW
    }
  };
  test.control.service.heartbeat(identity, heartbeat);
  return { identity, deviceId: paired.deviceId, backendIds, heartbeat };
};

const bind = (test: TestContext, agentId: string, runtimeBackendId: string, model: string) =>
  test.control.service.putBinding(agentId, {
    runtimeBackendId,
    model,
    reasoning: "high",
    policy: { network: false, readOnlyRoots: [] }
  });

const agent = (id: string): Agent => ({
  id,
  name: id,
  description: `${id} agent`,
  instructions: `Execute ${id} work.`,
  skills: [],
  enabled: true,
  createdAt: NOW,
  updatedAt: NOW
});

const appData = (automation: ProjectAutomationConfig, agentIds: string[]): AppData => ({
  projects: [], goals: [], adrs: [], agents: agentIds.map(agent), skills: [], policies: [],
  eventDefinitions: [], events: [], loopRuns: [], automation, automationIssues: []
});

const nestedAutomation = (): ProjectAutomationConfig => ({
  version: 3,
  loops: [{
    id: "delivery",
    start: "implement",
    steps: [{
      id: "implement", type: "agent", agentId: "developer", description: "Implement.",
      on: { approved: { loop: "release" }, rejected: { end: "failed" } }
    }]
  }, {
    id: "release",
    start: "publish",
    steps: [{
      id: "publish", type: "agent", agentId: "publisher", description: "Publish.",
      on: { approved: { end: "completed" }, rejected: { end: "failed" } }
    }]
  }]
});

const humanTerminalAutomation = (): ProjectAutomationConfig => ({
  version: 3,
  loops: [{
    id: "review",
    start: "analyze",
    steps: [{
      id: "analyze", type: "agent", agentId: "developer", description: "Analyze.",
      on: { approved: "approve", rejected: { end: "failed" } }
    }, {
      id: "approve", type: "human", description: "Approve.",
      on: { approved: { end: "completed" }, rejected: { end: "failed" } }
    }]
  }]
});

const READY: AgentOutcome = { outcome: "ready", summary: "Done.", checks: [] };

const startRoot = async (test: TestContext, loopId: string) => {
  const plan = await test.coordinator.prepare(test.data, loopId);
  if (!plan) throw new Error("Expected an execution plan.");
  const run = test.runtime.startLoopRun(test.data.automation, loopId, "Ship it", "manual", plan.deviceId, plan);
  await test.coordinator.enqueuePending(test.data, run.rootRunId);
  return { plan, run: test.runtime.getLoopRun(run.runId)! };
};

const claimAndComplete = async (test: TestContext, identity: DaemonIdentity, backendId: string) => {
  const claim = test.control.service.claimTask(identity, backendId);
  if (!claim) throw new Error("Expected a queued execution task.");
  const fenced = { taskToken: claim.taskToken, fencing: claim.task.fencing };
  test.control.service.setTaskState(identity, claim.task.id, { ...fenced, status: "running" });
  const completed = await test.control.service.completeTask(identity, claim.task.id, { ...fenced, outcome: READY });
  return { claim, completed };
};

describe("LoopExecutionCoordinator control-plane integration", () => {
  it("freezes one nonce-bound checkout inspection for every agent on a shared-device Loop Start", async () => {
    const test = await context(appData(nestedAutomation(), ["developer", "publisher"]), { freshCheckoutBeforeRun: true });
    const device = pairDevice(test, "Shared Mac", [
      { provider: "codex", model: "gpt-5" },
      { provider: "copilot", model: "claude-sonnet" }
    ]);
    bind(test, "developer", device.backendIds.codex!, "gpt-5");
    bind(test, "publisher", device.backendIds.copilot!, "claude-sonnet");
    const requests: string[] = [];
    const unsubscribe = test.control.service.onChange((type, payload) => {
      if (type === "refresh_requested" && typeof payload.requestId === "string") requests.push(payload.requestId);
    });

    const pending = test.coordinator.prepare(test.data, "delivery");
    await Promise.resolve();
    expect(requests).toHaveLength(1);
    const requestId = requests[0]!;
    const exactHead = "d".repeat(40);
    const exactConfig = "e".repeat(64);
    test.control.service.heartbeat(device.identity, {
      ...device.heartbeat,
      checkout: {
        ...device.heartbeat.checkout!,
        inspectionId: requestId,
        headSha: exactHead,
        configHash: exactConfig,
        lastInspectedAt: "2026-07-11T08:00:01.000Z"
      }
    });
    const plan = await pending;
    unsubscribe();

    expect(plan).toMatchObject({
      deviceId: device.deviceId,
      project: { headSha: exactHead, configHash: exactConfig, snapshotHash: exactConfig }
    });
    expect(plan?.steps).toHaveLength(2);
  });

  it("snapshots reachable nested Codex/Copilot steps and enqueues sequential tasks under one root", async () => {
    const test = await context(appData(nestedAutomation(), ["developer", "publisher"]));
    const device = pairDevice(test, "Shared Mac", [
      { provider: "codex", model: "gpt-5" },
      { provider: "copilot", model: "claude-sonnet" }
    ]);
    bind(test, "developer", device.backendIds.codex!, "gpt-5");
    bind(test, "publisher", device.backendIds.copilot!, "claude-sonnet");

    const { plan, run } = await startRoot(test, "delivery");
    expect(plan).toMatchObject({ deviceId: device.deviceId, project: { snapshotHash: SNAPSHOT_HASH } });
    expect(plan.steps.map((step) => [step.loopId, step.stepId, step.runtime.provider])).toEqual([
      ["delivery", "implement", "codex"],
      ["release", "publish", "copilot"]
    ]);
    const firstStep = test.runtime.getLoopRun(run.runId)!.stepRuns[0]!;
    const firstTask = test.control.service.getTask(firstStep.executionTaskId!);
    expect(firstTask.spec).toMatchObject({ rootRunId: run.rootRunId, project: plan.project, runtime: plan.steps[0]!.runtime });
    expect(taskCount(test, run.rootRunId)).toBe(1);

    const firstResult = await claimAndComplete(test, device.identity, device.backendIds.codex!);
    expect(firstResult.completed.rootDisposition).toEqual({ terminal: false, success: false });
    const rootRuns = test.runtime.listRootLoopRuns(run.rootRunId);
    expect(rootRuns.map((entry) => [entry.loopId, entry.rootRunId, entry.status])).toEqual([
      ["delivery", run.rootRunId, "completed"],
      ["release", run.rootRunId, "running"]
    ]);
    const secondStep = rootRuns[1]!.stepRuns[0]!;
    const secondTask = test.control.service.getTask(secondStep.executionTaskId!);
    expect(secondTask).toMatchObject({ rootRunId: run.rootRunId, status: "queued", deviceId: device.deviceId });
    expect(secondTask.spec).toMatchObject({ project: plan.project, runtime: plan.steps[1]!.runtime });
    expect(taskCount(test, run.rootRunId)).toBe(2);
  });

  it("blocks nested loop preflight when reachable agents are bound to different devices", async () => {
    const test = await context(appData(nestedAutomation(), ["developer", "publisher"]));
    const codex = pairDevice(test, "Codex Mac", [{ provider: "codex", model: "gpt-5" }]);
    const copilot = pairDevice(test, "Copilot Mac", [{ provider: "copilot", model: "claude-sonnet" }]);
    bind(test, "developer", codex.backendIds.codex!, "gpt-5");
    bind(test, "publisher", copilot.backendIds.copilot!, "claude-sonnet");

    await expect(test.coordinator.prepare(test.data, "delivery")).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ agentId: "developer", stepId: "delivery:implement", code: "mixed_device" }),
        expect.objectContaining({ agentId: "publisher", stepId: "release:publish", code: "mixed_device" })
      ])
    });
    expect(test.runtime.listLoopRuns()).toEqual([]);
    expect(taskCount(test)).toBe(0);
  });

  it("requests device finalization after a human terminal and suppresses it while cancellation is active", async () => {
    const test = await context(appData(humanTerminalAutomation(), ["developer"]));
    const device = pairDevice(test, "Worker Mac", [{ provider: "codex", model: "gpt-5" }]);
    const other = pairDevice(test, "Other Mac", []);
    bind(test, "developer", device.backendIds.codex!, "gpt-5");
    const requests: Array<Record<string, unknown>> = [];
    const unsubscribe = test.control.service.onChange((type, payload) => {
      if (type === "root_finalize_requested") requests.push(payload);
    });

    const first = await startRoot(test, "review");
    await claimAndComplete(test, device.identity, device.backendIds.codex!);
    const waiting = test.runtime.getLoopRun(first.run.runId)!;
    const humanStep = waiting.stepRuns.at(-1)!;
    expect(waiting.status).toBe("waiting_for_human");
    expect(finalization(test, first.run.rootRunId)).toBeUndefined();
    expect(test.runtime.respondToStepRun(test.data.automation, waiting.runId, humanStep.stepRunId, "approved", "Approved").status)
      .toBe("completed");
    await test.coordinator.finalizeIfTerminal(first.run.rootRunId);

    expect(finalization(test, first.run.rootRunId)).toMatchObject({
      device_id: device.deviceId, task_id: null, status: "pending", expected_success: 1
    });
    const expectedRequest = { projectId: PROJECT_ID, rootRunId: first.run.rootRunId, success: true };
    expect(requests).toEqual([{ ...expectedRequest, deviceId: device.deviceId, snapshotHash: SNAPSHOT_HASH }]);
    expect(test.control.service.heartbeat(device.identity, device.heartbeat).rootFinalizations).toEqual([expectedRequest]);
    expect(test.control.service.heartbeat(device.identity, device.heartbeat).rootFinalizations).toEqual([expectedRequest]);
    expect(test.control.service.heartbeat(other.identity, other.heartbeat).rootFinalizations).toEqual([]);

    const active = await startRoot(test, "review");
    const activeClaim = test.control.service.claimTask(device.identity, device.backendIds.codex!)!;
    test.control.service.setTaskState(device.identity, activeClaim.task.id, {
      taskToken: activeClaim.taskToken, fencing: activeClaim.task.fencing, status: "running"
    });
    test.runtime.cancelLoopRun(active.run.runId);
    await test.coordinator.cancel(active.run.rootRunId);
    await test.coordinator.finalizeIfTerminal(active.run.rootRunId);
    expect(test.control.service.getTask(activeClaim.task.id)).toMatchObject({ status: "running", cancelRequestedAt: expect.any(String) });
    expect(finalization(test, active.run.rootRunId)).toBeUndefined();
    expect(requests).toHaveLength(1);
    expect(test.control.service.heartbeat(device.identity, device.heartbeat).rootFinalizations).toEqual([expectedRequest]);
    unsubscribe();
  });
});

const taskCount = (test: TestContext, rootRunId?: string): number => {
  const row = rootRunId
    ? test.control.database.connection().prepare("SELECT COUNT(*) AS count FROM execution_tasks WHERE root_run_id = ?").get(rootRunId)
    : test.control.database.connection().prepare("SELECT COUNT(*) AS count FROM execution_tasks").get();
  return (row as { count: number }).count;
};

const finalization = (test: TestContext, rootRunId: string) => test.control.database.connection().prepare(`
  SELECT root_run_id, device_id, task_id, status, expected_success
  FROM root_run_finalizations WHERE root_run_id = ?
`).get(rootRunId) as {
  root_run_id: string;
  device_id: string;
  task_id: string | null;
  status: string;
  expected_success: number;
} | undefined;
