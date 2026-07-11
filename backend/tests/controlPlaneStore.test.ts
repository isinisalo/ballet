import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import type { ExecutionTask } from "../../shared/domain/runtime.js";
import { createControlPlane } from "../control-plane/createControlPlane.js";

const roots: string[] = [];
const instances: Array<ReturnType<typeof createControlPlane>> = [];

afterEach(async () => {
  instances.splice(0).forEach((instance) => instance.close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const fixture = async (options: { freshCheckoutBeforeRun?: boolean } = {}) => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-control-plane-"));
  roots.push(root);
  let timestamp = Date.parse("2026-07-11T08:00:00.000Z");
  const terminal: ExecutionTask[] = [];
  const control = createControlPlane({
    dbPath: path.join(root, "control.sqlite"),
    now: () => new Date(timestamp),
    leaseSeconds: 60,
    project: { id: "project", repositoryUrl: "https://example.test/repo.git", checkoutPath: root },
    listAgentIds: () => ["developer", "reviewer"],
    resolveAgentSnapshot: (agentId) => ({
      id: agentId,
      name: agentId,
      description: `${agentId} agent`,
      instructions: "Return structured output.",
      skillIds: [],
      configHash: "a".repeat(64)
    }),
    onTaskTerminal: async (task) => { terminal.push(task); },
    freshCheckoutBeforeRun: options.freshCheckoutBeforeRun,
    freshCheckoutTimeoutMs: 1_000
  });
  instances.push(control);
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
  const daemonToken = paired.daemonToken!;
  const identity = control.service.authenticateDaemon(daemonToken);
  const backendId = uuid();
  control.service.heartbeat(identity, heartbeat(backendId));
  control.service.putBinding("developer", {
    runtimeBackendId: backendId,
    model: "gpt-5",
    reasoning: "high",
    policy: { network: false, readOnlyRoots: [] }
  });
  return {
    ...control,
    root,
    identity,
    daemonToken,
    backendId,
    terminal,
    advance: (milliseconds: number) => { timestamp += milliseconds; }
  };
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
    repositoryUrl: "https://example.test/repo.git",
    path: "/tmp/repo",
    headSha: "b".repeat(40),
    configHash: "c".repeat(64),
    dirty: false,
    lastInspectedAt: "2026-07-11T08:00:00.000Z"
  }
});

const outcome = {
  outcome: "ready" as const,
  summary: "Done.",
  checks: [{ name: "test", status: "passed" as const }]
};

const verifyPersistedConsoleCap = async () => {
  const control = await fixture();
  const run = await control.service.startAgentRun("developer");
  const claim = control.service.claimTask(control.identity, control.backendId)!;
  const fenced = { taskToken: claim.taskToken, fencing: claim.task.fencing };
  const createdAt = "2026-07-11T08:00:00.000Z";
  const upload = (sequence: number, message: string, terminal = false) => ({
    sequence,
    source: "codex" as const,
    kind: terminal ? "system" as const : "output" as const,
    level: "info" as const,
    phase: terminal ? "completed" as const : "delta" as const,
    message,
    terminal,
    createdAt
  });
  const fillMessages = [256_000, 256_000, 256_000, 256_000, 24_576]
    .map((length) => "x".repeat(length));

  expect(control.service.appendEvents(control.identity, run.taskId, {
    ...fenced,
    events: fillMessages.map((message, sequence) => upload(sequence, message))
  })).toEqual({ accepted: 5, lastSequence: 4 });

  const suppressed = upload(5, "newest output");
  expect(control.service.appendEvents(control.identity, run.taskId, {
    ...fenced, events: [suppressed]
  })).toEqual({ accepted: 1, lastSequence: 5 });
  expect(control.service.appendEvents(control.identity, run.taskId, {
    ...fenced, events: [suppressed]
  })).toEqual({ accepted: 0, lastSequence: 5 });
  expect(() => control.service.appendEvents(control.identity, run.taskId, {
    ...fenced, events: [{ ...suppressed, message: "different content" }]
  })).toThrow("different content");

  expect(control.service.appendEvents(control.identity, run.taskId, {
    ...fenced, events: [upload(6, "Runtime execution completed.", true), upload(7, "latest tail")]
  })).toEqual({ accepted: 2, lastSequence: 7 });

  const page = control.service.eventPage(run.taskId, 0, 20);
  expect(page.truncated).toBe(true);
  expect(page.entries.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(page.entries.find((entry) => entry.sequence === 6)).toMatchObject({ terminal: true, message: "Runtime execution completed." });
  expect(page.entries.at(-1)).toMatchObject({ sequence: 7, message: "latest tail" });
  const state = control.database.connection().prepare(`
    SELECT retained_content_bytes, truncated FROM execution_event_state WHERE task_id = ?
  `).get(run.taskId) as { retained_content_bytes: number; truncated: number };
  expect(state).toEqual({ retained_content_bytes: 792_600, truncated: 1 });
  const receipts = control.database.connection().prepare(`
    SELECT COUNT(*) AS total, SUM(persisted) AS persisted FROM execution_event_receipts WHERE task_id = ?
  `).get(run.taskId) as { total: number; persisted: number };
  expect(receipts).toEqual({ total: 8, persisted: 7 });
};

const verifyLeaseAndCancellation = async () => {
  const control = await fixture();
  const expiredRun = await control.service.startAgentRun("developer");
  const expiredClaim = control.service.claimTask(control.identity, control.backendId)!;
  control.advance(61_000);
  expect(control.service.claimTask(control.identity, control.backendId)).toBeUndefined();
  const swept = await control.service.sweepExpiredLeases();
  expect(swept).toHaveLength(1);
  expect(swept[0]).toMatchObject({ id: expiredRun.taskId, status: "failed", errorCode: "runtime_lost", fencing: 2 });
  await expect(control.service.completeTask(control.identity, expiredClaim.task.id, {
    taskToken: expiredClaim.taskToken,
    fencing: expiredClaim.task.fencing,
    outcome
  })).rejects.toThrow("stale");

  const cancelledRun = await control.service.startAgentRun("developer");
  const cancelledClaim = control.service.claimTask(control.identity, control.backendId)!;
  expect((await control.service.cancelRun(cancelledRun.id)).status).toBe("claimed");
  expect(control.service.getTask(cancelledRun.taskId).cancelRequestedAt).toBeTruthy();
  await expect(control.service.completeTask(control.identity, cancelledClaim.task.id, {
    taskToken: cancelledClaim.taskToken,
    fencing: cancelledClaim.task.fencing,
    outcome
  })).rejects.toThrow("cancellation");
  expect((await control.service.cancelClaimedTask(control.identity, cancelledClaim.task.id, {
    taskToken: cancelledClaim.taskToken,
    fencing: cancelledClaim.task.fencing,
    worktreePath: "/tmp/worktree"
  })).status).toBe("cancelled");
};

const verifyModelDiscoveryReadiness = async () => {
  const control = await fixture();
  await control.service.startAgentRun("developer");
  const healthyHeartbeat = heartbeat(control.backendId), reason = "Model discovery failed: models/list RPC failed: catalog unavailable";
  control.service.heartbeat(control.identity, {
    ...healthyHeartbeat,
    backends: healthyHeartbeat.backends.map((backend) => ({
      ...backend,
      health: "error" as const,
      healthMessage: reason,
      capabilities: { ...backend.capabilities, models: [] }
    }))
  });

  expect(control.service.listDevices(undefined, "issues")).toEqual([
    expect.objectContaining({
      id: control.identity.deviceId,
      backends: [expect.objectContaining({ health: "error", healthMessage: reason })]
    })
  ]);
  expect(control.service.preflightAgent("developer")).toMatchObject({
    ok: false,
    issues: expect.arrayContaining([
      { agentId: "developer", code: "backend_unhealthy", message: reason },
      expect.objectContaining({ agentId: "developer", code: "model_unavailable" })
    ])
  });
  expect(() => control.service.claimTask(control.identity, control.backendId)).toThrow("cannot claim tasks");
  await expect(control.service.startAgentRun("developer")).rejects.toThrow("preflight failed");
};

describe("control-plane persistence and execution protocol", () => {
  it("bootstraps opaque admin sessions and pairs a daemon with only hashed long-lived credentials", async () => {
    const control = await fixture();
    expect(control.service.adminBootstrapped()).toBe(false);
    control.service.bootstrapAdmin("a secure local password");
    const session = control.service.loginAdmin("a secure local password");
    expect(control.service.authenticateAdmin(session.sessionToken, session.csrfToken).adminId).toBeTruthy();
    expect(() => control.service.authenticateAdmin(session.sessionToken, "wrong")).toThrow("CSRF");

    const tokenRow = control.database.connection().prepare("SELECT token_hash FROM daemon_tokens LIMIT 1").get() as { token_hash: string };
    expect(tokenRow.token_hash).not.toBe(control.daemonToken);
    expect(tokenRow.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(() => control.service.pollPairing({
      deviceCode: control.service.createPairing().deviceCode,
      hostname: "other.local", platform: "darwin", architecture: "arm64", daemonVersion: "1", daemonId: uuid()
    })).not.toThrow();
  });

  it("claims by exact runtime, fences mutations, stores idempotent event sequences, and completes a run", async () => {
    const control = await fixture();
    const run = await control.service.startAgentRun("developer", "Implement this");
    expect(run.status).toBe("queued");
    const claim = control.service.claimTask(control.identity, control.backendId)!;
    expect(claim.task.id).toBe(run.taskId);
    expect(claim.task.fencing).toBe(1);

    const event = {
      sequence: 0,
      source: "codex" as const,
      kind: "agent" as const,
      level: "info" as const,
      phase: "delta" as const,
      message: "Working",
      terminal: false,
      createdAt: "2026-07-11T08:00:00.000Z"
    };
    const fenced = { taskToken: claim.taskToken, fencing: claim.task.fencing };
    expect(control.service.appendEvents(control.identity, claim.task.id, { ...fenced, events: [event] }).accepted).toBe(1);
    expect(control.service.appendEvents(control.identity, claim.task.id, { ...fenced, events: [event] }).accepted).toBe(0);
    expect(() => control.service.appendEvents(control.identity, claim.task.id, {
      ...fenced,
      events: [{ ...event, message: "Different" }]
    })).toThrow("different content");

    control.service.setTaskState(control.identity, claim.task.id, { ...fenced, status: "running" });
    const completed = await control.service.completeTask(control.identity, claim.task.id, { ...fenced, outcome });
    expect(completed.status).toBe("succeeded");
    expect(control.service.getRun(run.id)).toMatchObject({ status: "succeeded", outcome });
    expect(control.terminal).toHaveLength(1);
    expect((await control.service.completeTask(control.identity, claim.task.id, { ...fenced, outcome })).status).toBe("succeeded");
    expect(control.terminal).toHaveLength(2);
    expect(control.service.eventPage(claim.task.id).entries).toHaveLength(1);
    expect(() => control.database.connection().prepare("UPDATE execution_tasks SET spec_json = '{}' WHERE task_id = ?").run(claim.task.id)).toThrow("immutable");
  });

  it("caps persisted console content while deduplicating suppressed sequences and retaining terminal events", verifyPersistedConsoleCap);

  it("never reclaims an expired task, sweeps it to runtime_lost, and invalidates cancelled work", verifyLeaseAndCancellation);

  it("keeps a paired model-discovery failure in issues and blocks preflight and claims", verifyModelDiscoveryReadiness);

  it("waits for a nonce-bound checkout inspection and snapshots its exact HEAD and config", async () => {
    const control = await fixture({ freshCheckoutBeforeRun: true });
    let requestId = "";
    const unsubscribe = control.service.onChange((type, payload) => {
      if (type === "refresh_requested" && typeof payload.requestId === "string") requestId = payload.requestId;
    });
    const pending = control.service.startAgentRun("developer");
    await Promise.resolve();
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    const fresh = heartbeat(control.backendId);
    let settled = false;
    void pending.then(() => { settled = true; });
    const unmatched = control.service.heartbeat(control.identity, {
      ...fresh,
      checkout: {
        ...fresh.checkout,
        inspectionId: uuid(),
        headSha: "1".repeat(40),
        configHash: "2".repeat(64),
        lastInspectedAt: "2026-07-11T08:00:00.500Z"
      }
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(unmatched).toMatchObject({ refreshRequested: true, refreshRequestId: requestId });

    const matched = control.service.heartbeat(control.identity, {
      ...fresh,
      checkout: {
        ...fresh.checkout,
        inspectionId: requestId,
        headSha: "d".repeat(40),
        configHash: "e".repeat(64),
        lastInspectedAt: "2026-07-11T08:00:01.000Z"
      }
    });
    const run = await pending;
    unsubscribe();

    expect(matched).toMatchObject({ refreshRequested: false });
    expect(matched.refreshRequestId).toBeUndefined();
    expect(control.service.getTask(run.taskId).spec.project).toMatchObject({
      headSha: "d".repeat(40),
      configHash: "e".repeat(64),
      snapshotHash: "e".repeat(64)
    });
  });

  it("marks a non-success Direct outcome failed and authorizes retained finalization", async () => {
    const control = await fixture();
    const run = await control.service.startAgentRun("developer");
    const claim = control.service.claimTask(control.identity, control.backendId)!;
    const fenced = { taskToken: claim.taskToken, fencing: claim.task.fencing };
    const blocked = { outcome: "blocked" as const, summary: "Needs operator input.", checks: [] };
    const completed = await control.service.completeTask(control.identity, claim.task.id, { ...fenced, outcome: blocked });

    expect(completed.rootDisposition).toEqual({ terminal: true, success: false });
    expect(control.service.getRun(run.id)).toMatchObject({ status: "failed", outcome: blocked });
    expect(control.service.heartbeat(control.identity, heartbeat(control.backendId)).rootFinalizations).toContainEqual({
      projectId: "project",
      rootRunId: run.rootRunId,
      success: false
    });
  });

  it("returns all same-device preflight issues and allows a busy healthy backend to queue", async () => {
    const control = await fixture();
    const first = await control.service.startAgentRun("developer");
    control.service.claimTask(control.identity, control.backendId);
    const second = await control.service.startAgentRun("developer");
    expect(first.status).toBe("queued");
    expect(second.status).toBe("queued");
    expect(control.service.claimTask(control.identity, control.backendId)).toBeUndefined();

    const secondPairing = control.service.createPairing("Second Mac");
    control.service.approvePairing(secondPairing.id);
    const secondPair = control.service.pollPairing({
      deviceCode: secondPairing.deviceCode,
      hostname: "second.local",
      displayName: "Second Mac",
      platform: "darwin",
      architecture: "arm64",
      daemonVersion: "1.0.0",
      daemonId: uuid()
    });
    const secondIdentity = control.service.authenticateDaemon(secondPair.daemonToken!);
    const secondBackendId = uuid();
    control.service.heartbeat(secondIdentity, heartbeat(secondBackendId));
    control.service.putBinding("reviewer", {
      runtimeBackendId: secondBackendId,
      model: "gpt-5",
      reasoning: "high",
      policy: { network: false, readOnlyRoots: [] }
    });
    const preflight = control.service.preflightLoop({
      steps: [
        { id: "one", type: "agent", agentId: "developer", description: "", on: { approved: { end: "completed" }, rejected: { end: "failed" } } },
        { id: "two", type: "agent", agentId: "reviewer", description: "", on: { approved: { end: "completed" }, rejected: { end: "failed" } } }
      ]
    });
    expect(preflight.ok).toBe(false);
    expect(preflight.issues.filter((issue) => issue.code === "mixed_device")).toHaveLength(2);
    await expect(control.service.executionStates()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ agentId: "developer", status: "running" }),
      expect.objectContaining({ agentId: "reviewer", status: "idle", reasoning: "high" })
    ]));
  });
});
