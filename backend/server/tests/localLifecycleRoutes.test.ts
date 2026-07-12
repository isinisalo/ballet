import express from "express";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectAutomationConfig } from "../../../shared/domain/automation.js";
import { createControlPlane } from "../../control-plane/createControlPlane.js";
import { RuntimeDatabase } from "../../runtime-db.js";
import {
  createLocalLifecycleRouter,
  type LocalLifecycleLoopStore
} from "../LocalLifecycleRoutes.js";

const PROJECT_ID = "project";
const REPOSITORY_URL = "https://example.test/repo.git";
const SNAPSHOT_HASH = "c".repeat(64);
const TOKEN = "local-control-token";
const roots: string[] = [];
const servers: Server[] = [];
const controls: Array<ReturnType<typeof createControlPlane>> = [];
const runtimes: RuntimeDatabase[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  controls.splice(0).forEach((control) => control.close());
  runtimes.splice(0).forEach((runtime) => runtime.close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("local lifecycle HTTP API", () => {
  it("authenticates loopback requests, cancels every run beyond the history cap, and waits for finalization", async () => {
    const context = await listen();
    const authorized = { Authorization: `Bearer ${TOKEN}` };

    expect((await fetch(context.url)).status).toBe(401);
    expect((await fetch(context.url, { headers: { Authorization: "Bearer incorrect-token" } })).status).toBe(401);

    const before = await responseJson(context.url, authorized);
    expect(context.pauseCount()).toBe(0);
    expect(before).toEqual({ activeRuns: 2, pendingFinalizations: 0, idle: false });
    expect(context.runtime.listLoopRuns().some((run) => run.runId === context.loopRunId)).toBe(false);
    expect(context.runtime.listActiveLoopRuns().map((run) => run.runId)).toContain(context.loopRunId);

    const cancelled = await responseJson(context.url, authorized, "POST");
    expect(context.pauseCount()).toBe(1);
    expect(cancelled).toEqual({ activeRuns: 0, pendingFinalizations: 0, idle: true });
    expect(context.control.service.getRun(context.agentRunId).status).toBe("cancelled");
    expect(context.runtime.getLoopRun(context.loopRunId)?.status).toBe("cancelled");

    expect(await responseJson(context.url, authorized, "POST"))
      .toEqual({ activeRuns: 0, pendingFinalizations: 0, idle: true });

    context.control.service.requestRootFinalization({
      projectId: PROJECT_ID,
      deviceId: context.deviceId,
      rootRunId: "pending-finalization",
      success: false,
      snapshotHash: SNAPSHOT_HASH
    });
    expect(await responseJson(context.url, authorized))
      .toEqual({ activeRuns: 0, pendingFinalizations: 1, idle: false });

    context.control.service.reportRequestedRootFinalization(context.identity, "pending-finalization", {
      projectId: PROJECT_ID,
      success: false,
      retained: true,
      branch: "ballet/run/pending-finalization",
      worktreePath: path.join(context.root, "pending-finalization"),
      changedFiles: ["src/pending.ts"],
      snapshotHash: SNAPSHOT_HASH
    });
    expect(await responseJson(context.url, authorized))
      .toEqual({ activeRuns: 0, pendingFinalizations: 0, idle: true });
  });
});

const listen = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-local-lifecycle-"));
  roots.push(root);
  const databasePath = path.join(root, "ballet.sqlite");
  const runtime = new RuntimeDatabase(databasePath, PROJECT_ID);
  runtimes.push(runtime);
  const control = createControlPlane({
    dbPath: databasePath,
    maintenance: false,
    project: { id: PROJECT_ID, repositoryUrl: REPOSITORY_URL, checkoutPath: root },
    resolveAgentSnapshot: (agentId) => ({
      id: agentId,
      name: "Developer",
      description: "Develops the project.",
      instructions: "Implement the requested change.",
      skillIds: [],
      configHash: "a".repeat(64)
    })
  });
  controls.push(control);

  const pairing = control.service.createPairing("Local Mac");
  control.service.approvePairing(pairing.id);
  const paired = control.service.pollPairing({
    deviceCode: pairing.deviceCode,
    hostname: "mac.local",
    displayName: "Local Mac",
    platform: "darwin",
    architecture: "arm64",
    daemonVersion: "1.0.0",
    daemonId: uuid()
  });
  if (!paired.daemonToken || !paired.deviceId) throw new Error("Pairing did not return daemon credentials.");
  const identity = control.service.authenticateDaemon(paired.daemonToken);
  const backendId = uuid();
  control.service.heartbeat(identity, heartbeat(backendId));
  control.service.putAgentRuntime("developer", {
    runtimeBackendId: backendId,
    model: "gpt-5",
    reasoning: "high",
    policy: { network: false, readOnlyRoots: [] }
  });
  const agentRun = await control.service.startAgentRun("developer", "Ship it");

  const loop = runtime.startLoopRun(humanAutomation, "approval");
  insertCompletedHistory(runtime, 500);

  let schedulerPauseCount = 0;
  const store: LocalLifecycleLoopStore = {
    listActiveLoopRuns: () => runtime.listActiveLoopRuns(),
    cancelLoopRun: (runId) => {
      if (schedulerPauseCount === 0) throw new Error("Scheduler must pause before Loop cancellation.");
      return runtime.cancelLoopRun(runId);
    }
  };
  const app = express();
  app.use(express.json());
  app.use("/api/local/lifecycle", createLocalLifecycleRouter({
    token: TOKEN,
    projectId: PROJECT_ID,
    controlPlane: control.service,
    database: control.database,
    store,
    scheduler: { pause: async () => { schedulerPauseCount += 1; } }
  }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server did not bind.");
  return {
    root,
    runtime,
    control,
    identity,
    deviceId: paired.deviceId,
    agentRunId: agentRun.id,
    loopRunId: loop.runId,
    pauseCount: () => schedulerPauseCount,
    url: `http://127.0.0.1:${address.port}/api/local/lifecycle`
  };
};

const responseJson = async (
  url: string,
  headers: Record<string, string>,
  method = "GET"
): Promise<Record<string, unknown>> => {
  const response = await fetch(url, { method, headers });
  expect(response.status).toBe(200);
  return response.json() as Promise<Record<string, unknown>>;
};

const heartbeat = (backendId: string) => ({
  daemonVersion: "1.0.0",
  uptimeSeconds: 42,
  backends: [{
    id: backendId,
    provider: "codex" as const,
    cliVersion: "1.2.3",
    executablePath: "/usr/local/bin/codex",
    authStatus: "ready" as const,
    health: "ready" as const,
    capabilities: {
      models: [{ id: "gpt-5", label: "GPT-5", reasoningOptions: ["high"], defaultReasoning: "high" }],
      supportsResume: true,
      supportsStructuredOutput: true,
      policy: { workspaceWrite: true, networkControl: true, readOnlyRoots: true },
      refreshedAt: "2026-07-11T08:00:00.000Z"
    }
  }],
  checkout: {
    repositoryUrl: REPOSITORY_URL,
    path: "/tmp/project",
    headSha: "b".repeat(40),
    configHash: SNAPSHOT_HASH,
    dirty: false,
    lastInspectedAt: "2026-07-11T08:00:00.000Z"
  }
});

const humanAutomation: ProjectAutomationConfig = {
  version: 5,
  loops: [{
    id: "approval",
    theme: "open-ai",
    start: "approve",
    steps: [{
      id: "approve",
      type: "human",
      description: "Approve the release.",
      nodeSize: "small",
      on: { approved: { end: "completed" }, rejected: { end: "failed" } }
    }]
  }]
};

const insertCompletedHistory = (runtime: RuntimeDatabase, count: number): void => {
  const insert = runtime.connection().prepare(`
    INSERT INTO loop_runs (
      run_id, project_id, loop_id, root_run_id, source, status, snapshot_json,
      transition_count, created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, 'manual', 'completed', ?, 0, ?, ?, ?)
  `);
  runtime.connection().transaction(() => {
    for (let index = 0; index < count; index += 1) {
      const runId = `history-${index}`;
      const loopId = `archived-${index}`;
      const timestamp = new Date(Date.UTC(2999, 0, 1, 0, 0, index)).toISOString();
      insert.run(runId, PROJECT_ID, loopId, runId, JSON.stringify({
        id: loopId,
        start: "done",
        steps: []
      }), timestamp, timestamp, timestamp);
    }
  })();
};
