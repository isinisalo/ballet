import express from "express";
import { createServer, type Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { WebSocket } from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { createControlPlane } from "../control-plane/createControlPlane.js";

const roots: string[] = [];
const servers: Server[] = [];
const controls: Array<ReturnType<typeof createControlPlane>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  controls.splice(0).forEach((control) => control.close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const listen = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-control-api-"));
  roots.push(root);
  let terminalHookCompleted = false;
  const control = createControlPlane({
    dbPath: path.join(root, "control.sqlite"),
    project: { id: "project", repositoryUrl: "https://example.test/repo.git", checkoutPath: root },
    resolveAgentSnapshot: (agentId) => ({
      id: agentId, name: "Developer", description: "Develops", instructions: "Do the work.",
      skillIds: [], configHash: "a".repeat(64)
    }),
    listAgentIds: () => ["developer"],
    onTaskTerminal: async () => { terminalHookCompleted = true; }
  });
  controls.push(control);
  const app = express();
  app.use(express.json());
  app.use("/api", control.router);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  });
  const server = createServer(app);
  control.attachWebSocket(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server did not bind.");
  return {
    control,
    url: `http://127.0.0.1:${address.port}`,
    wsUrl: `ws://127.0.0.1:${address.port}/api/daemon/ws`,
    terminalHookCompleted: () => terminalHookCompleted
  };
};

const json = (body: unknown, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: { "Content-Type": "application/json", ...init.headers },
  body: JSON.stringify(body)
});

const sessionCookies = (response: Response): string => {
  const values = response.headers.getSetCookie();
  return values.map((value) => value.split(";", 1)[0]).join("; ");
};

const daemonHeartbeat = (backendId: string) => ({
  daemonVersion: "1.0.0",
  uptimeSeconds: 5,
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
      refreshedAt: new Date().toISOString()
    }
  }],
  checkout: {
    repositoryUrl: "https://example.test/repo.git",
    path: "/tmp/project",
    headSha: "b".repeat(40),
    configHash: "c".repeat(64),
    dirty: false
  }
});

describe("control-plane HTTP and websocket API", () => {
  it("enforces admin session+CSRF and runs the paired daemon protocol end to end", async () => {
    const context = await listen();
    const bootstrap = await fetch(`${context.url}/api/admin/bootstrap`, json({ password: "a secure local password" }, { method: "POST" }));
    expect(bootstrap.status).toBe(201);
    const bootstrapBody = await bootstrap.json() as { csrfToken: string };
    const cookie = sessionCookies(bootstrap);
    expect((await fetch(`${context.url}/api/admin/status`, { headers: { Cookie: cookie } })).status).toBe(200);

    const denied = await fetch(`${context.url}/api/pairing/sessions`, json({}, { method: "POST", headers: { Cookie: cookie } }));
    expect(denied.status).toBe(403);
    const adminHeaders = { Cookie: cookie, "X-CSRF-Token": bootstrapBody.csrfToken };
    const pairingResponse = await fetch(`${context.url}/api/pairing/sessions`, json({ displayName: "Local Mac" }, { method: "POST", headers: adminHeaders }));
    expect(pairingResponse.status).toBe(201);
    const pairing = await pairingResponse.json() as { id: string; deviceCode: string; expiresAt: string };
    expect(pairing.expiresAt).toBeTruthy();
    expect((await fetch(`${context.url}/api/pairing/sessions/${pairing.id}/approve`, json({}, { method: "POST", headers: adminHeaders }))).status).toBe(200);

    const daemonId = uuid();
    const pollResponse = await fetch(`${context.url}/api/daemon/pairing/poll`, json({
      deviceCode: pairing.deviceCode,
      hostname: "mac.local",
      displayName: "Local Mac",
      platform: "darwin",
      architecture: "arm64",
      daemonVersion: "1.0.0",
      daemonId
    }, { method: "POST" }));
    expect(pollResponse.status).toBe(200);
    const paired = await pollResponse.json() as { daemonToken: string; deviceId: string };
    expect((await fetch(`${context.url}/api/daemon/pairing/poll`, json({
      deviceCode: pairing.deviceCode,
      hostname: "mac.local",
      platform: "darwin",
      architecture: "arm64",
      daemonVersion: "1.0.0",
      daemonId
    }, { method: "POST" }))).status).toBe(410);

    const daemonHeaders = { Authorization: `Bearer ${paired.daemonToken}` };
    const backendId = uuid();
    expect((await fetch(`${context.url}/api/daemon/heartbeat`, json(daemonHeartbeat(backendId), { method: "POST", headers: daemonHeaders }))).status).toBe(200);
    const devices = await (await fetch(`${context.url}/api/runtimes/devices`, { headers: { Cookie: cookie } })).json() as Array<{ id: string; status: string }>;
    expect(devices).toContainEqual(expect.objectContaining({ id: paired.deviceId, status: "online" }));

    const binding = await fetch(`${context.url}/api/agents/developer/execution-binding`, json({
      runtimeBackendId: backendId,
      model: "gpt-5",
      reasoning: "high",
      policy: { network: false, readOnlyRoots: [] }
    }, { method: "PUT", headers: adminHeaders }));
    expect(binding.status).toBe(200);
    const startedResponse = await fetch(`${context.url}/api/agents/developer/runs`, json({ input: "Ship it" }, { method: "POST", headers: adminHeaders }));
    expect(startedResponse.status).toBe(201);
    const run = await startedResponse.json() as { id: string; taskId: string };
    const claim = await (await fetch(`${context.url}/api/daemon/tasks/claim`, json({ runtimeBackendId: backendId }, { method: "POST", headers: daemonHeaders }))).json() as {
      task: { id: string; fencing: number }; taskToken: string;
    };
    expect(claim.task.id).toBe(run.taskId);
    const fenced = { taskToken: claim.taskToken, fencing: claim.task.fencing };
    expect((await fetch(`${context.url}/api/daemon/tasks/${claim.task.id}/events`, json({
      ...fenced,
      events: [{
        sequence: 0, source: "codex", kind: "agent", level: "info", phase: "delta",
        message: "Working", terminal: false, createdAt: new Date().toISOString()
      }]
    }, { method: "POST", headers: daemonHeaders }))).status).toBe(202);
    const page = await (await fetch(`${context.url}/api/execution-tasks/${claim.task.id}/events`, { headers: { Cookie: cookie } })).json() as { entries: unknown[] };
    expect(page.entries).toHaveLength(1);
    const complete = await fetch(`${context.url}/api/daemon/tasks/${claim.task.id}/complete`, json({
      ...fenced,
      outcome: { outcome: "ready", summary: "Done", checks: [] }
    }, { method: "POST", headers: daemonHeaders }));
    expect(complete.status).toBe(200);
    expect(await complete.json()).toMatchObject({ rootDisposition: { terminal: true, success: true } });
    const finalization = {
      ...fenced,
      success: true,
      retained: false,
      branch: `ballet/run/${run.id.slice(0, 12)}`,
      worktreePath: `/tmp/worktrees/${run.id}`,
      commitSha: "d".repeat(40),
      changedFiles: ["src/runtime.ts"],
      snapshotHash: "c".repeat(64)
    };
    expect((await fetch(`${context.url}/api/daemon/root-runs/${run.id}/finalize`, json(
      finalization,
      { method: "POST", headers: daemonHeaders }
    ))).status).toBe(204);
    expect((await fetch(`${context.url}/api/daemon/root-runs/${run.id}/finalize`, json(
      finalization,
      { method: "POST", headers: daemonHeaders }
    ))).status).toBe(204);
    expect(context.terminalHookCompleted()).toBe(true);
    expect(await (await fetch(`${context.url}/api/agent-runs/${run.id}`, { headers: { Cookie: cookie } })).json())
      .toMatchObject({
        status: "succeeded",
        branch: finalization.branch,
        worktreePath: finalization.worktreePath,
        outcome: { artifacts: { git_sha: finalization.commitSha, changed_files: finalization.changedFiles } }
      });
  });

  it("authenticates websocket upgrade and emits runtime-scoped daemon wire signals", async () => {
    const context = await listen();
    const pairing = context.control.service.createPairing();
    context.control.service.approvePairing(pairing.id);
    const paired = context.control.service.pollPairing({
      deviceCode: pairing.deviceCode,
      hostname: "mac.local",
      platform: "darwin",
      architecture: "arm64",
      daemonVersion: "1.0.0",
      daemonId: uuid()
    });
    const token = paired.daemonToken!;
    const identity = context.control.service.authenticateDaemon(token);
    const backendId = uuid();
    context.control.service.heartbeat(identity, daemonHeartbeat(backendId));
    context.control.service.putBinding("developer", {
      runtimeBackendId: backendId, model: "gpt-5", reasoning: "high", policy: { network: false, readOnlyRoots: [] }
    });

    const socket = new WebSocket(context.wsUrl, { headers: { Authorization: `Bearer ${token}` } });
    const messages: Array<Record<string, unknown>> = [];
    socket.on("message", (data) => messages.push(JSON.parse(data.toString()) as Record<string, unknown>));
    await new Promise<void>((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
    const run = await context.control.service.startAgentRun("developer");
    await waitFor(() => messages.some((message) => message.type === "task.available"));
    context.control.service.requestDeviceRefresh(identity.deviceId);
    context.control.service.requestDeviceRestart(identity.deviceId);
    context.control.service.claimTask(identity, backendId);
    await context.control.service.cancelRun(run.id);
    const humanTerminalRootId = uuid();
    context.control.service.requestRootFinalization({
      projectId: "project",
      deviceId: identity.deviceId,
      rootRunId: humanTerminalRootId,
      success: false,
      snapshotHash: "c".repeat(64)
    });
    await waitFor(() => ["runtime.refresh", "daemon.restart", "task.cancel"]
      .every((type) => messages.some((message) => message.type === type)));
    await waitFor(() => messages.some((message) => message.type === "root.finalize"));
    expect(messages).toContainEqual(expect.objectContaining({ type: "connected", deviceId: identity.deviceId }));
    expect(messages).toContainEqual(expect.objectContaining({ type: "task.available", runtimeBackendId: backendId }));
    expect(messages).toContainEqual(expect.objectContaining({ type: "runtime.refresh", requestId: expect.any(String) }));
    expect(messages).toContainEqual({ type: "daemon.restart" });
    expect(messages).toContainEqual({ type: "task.cancel", taskId: run.taskId });
    expect(messages).toContainEqual({
      type: "root.finalize",
      projectId: "project",
      rootRunId: humanTerminalRootId,
      success: false
    });
    const heartbeatResult = context.control.service.heartbeat(identity, daemonHeartbeat(backendId));
    expect(heartbeatResult.rootFinalizations).toContainEqual({
      projectId: "project", rootRunId: humanTerminalRootId, success: false
    });
    expect((await fetch(`${context.url}/api/daemon/root-runs/${humanTerminalRootId}/finalize`, json({
      projectId: "project",
      success: false,
      retained: true,
      branch: `ballet/run/${humanTerminalRootId.slice(0, 12)}`,
      worktreePath: `/tmp/worktrees/${humanTerminalRootId}`,
      changedFiles: ["review-notes.md"],
      snapshotHash: "c".repeat(64)
    }, { method: "POST", headers: { Authorization: `Bearer ${token}` } }))).status).toBe(204);
    expect(context.control.service.heartbeat(identity, daemonHeartbeat(backendId)).rootFinalizations).toEqual([]);
    socket.close();

    const unauthorized = new WebSocket(context.wsUrl);
    await expect(new Promise<void>((resolve, reject) => {
      unauthorized.once("open", resolve);
      unauthorized.once("error", reject);
    })).rejects.toBeTruthy();
  });
});

const waitFor = async (predicate: () => boolean): Promise<void> => {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for websocket message.");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
