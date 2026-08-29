import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createControlPlane } from "./createControlPlane.js";

const roots: string[] = [];
const projectId = "project:test";
const repositoryUrl = "https://example.test/ballet.git";
const headSha = "a".repeat(40);
const configHash = "b".repeat(64);
const snapshotHash = "c".repeat(64);
const backendId = "11111111-1111-4111-8111-111111111111";
const daemonId = "22222222-2222-4222-8222-222222222222";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("paired daemon control plane", () => {
  it("binds an Agent to an exact checkout and fences terminal replay", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ballet-control-plane-"));
    roots.push(root);
    let current = new Date("2026-08-29T12:00:00.000Z");
    const control = createControlPlane({
      dbPath: path.join(root, "control-plane.sqlite"),
      project: { id: projectId, repositoryUrl, checkoutPath: root },
      now: () => current,
      maintenance: false,
      resolveAgentSnapshot: () => ({
        id: "validation", name: "Validation", description: "Read-only controller",
        instructions: "Inspect and report.", skillIds: [], configHash
      })
    });
    try {
      const pairing = control.service.createPairing("Test Mac");
      const poll = {
        deviceCode: pairing.deviceCode,
        hostname: "test-mac.local",
        displayName: "Test Mac",
        platform: "darwin" as const,
        architecture: "arm64" as const,
        daemonVersion: "0.1.0",
        daemonId
      };
      expect(control.service.pollPairing(poll)).toEqual({ status: "pending" });
      control.service.approvePairing(pairing.id);
      const claimedPairing = control.service.pollPairing(poll);
      expect(claimedPairing.status).toBe("claimed");
      expect(() => control.service.pollPairing(poll)).toThrow(/already been claimed/i);

      const identity = control.service.authenticateDaemon(claimedPairing.daemonToken!);
      control.service.heartbeat(identity, heartbeat());
      const device = control.service.getDevice(identity.deviceId);
      expect(device.checkout).toMatchObject({ headSha, configHash, snapshotHash, dirty: false });

      control.service.putBinding("validation", {
        runtimeBackendId: backendId,
        model: "gpt-5.6-sol",
        reasoning: "high",
        policy: { network: false, readOnlyRoots: [] }
      });
      expect(control.service.preflightAgent("validation")).toMatchObject({
        ok: true,
        project: { headSha, configHash, snapshotHash }
      });

      const run = await control.service.startAgentRun("validation", "Review the current state.");
      const task = control.service.getTask(run.taskId);
      expect(task.spec.workspaceAccess).toBe("read-only");
      const claim = control.service.claimTask(identity, backendId)!;
      expect(claim.task.fencing).toBe(1);
      expect(control.service.claimTask(identity, backendId)).toBeUndefined();
      control.service.setTaskState(identity, task.id, {
        taskToken: claim.taskToken, fencing: claim.task.fencing, status: "running"
      });
      const body = {
        taskToken: claim.taskToken,
        fencing: claim.task.fencing,
        outcome: { outcome: "ready" as const, summary: "Validated.", checks: [{ name: "review", status: "passed" as const }] },
        branch: `ballet/run/${run.rootRunId.slice(0, 12)}`,
        worktreePath: "/tmp/ballet-worktree"
      };
      const completed = await control.service.completeTask(identity, task.id, body);
      expect(completed).toMatchObject({ status: "succeeded", rootDisposition: { terminal: true, success: true } });
      await expect(control.service.completeTask(identity, task.id, body)).resolves.toMatchObject({ status: "succeeded" });
      expect(() => control.service.renewLease(identity, task.id, {
        taskToken: claim.taskToken, fencing: claim.task.fencing + 1
      })).toThrow(/fencing|lease|token/i);

      control.service.reportRootFinalization(identity, run.rootRunId, {
        taskToken: claim.taskToken,
        fencing: claim.task.fencing,
        success: true,
        retained: false,
        branch: `ballet/run/${run.rootRunId.slice(0, 12)}`,
        worktreePath: "/tmp/ballet-worktree",
        commitSha: "d".repeat(40),
        changedFiles: ["README.md"],
        snapshotHash
      });
      expect(control.service.getRun(run.id).outcome?.artifacts).toMatchObject({ git_sha: "d".repeat(40) });

      current = new Date("2026-08-29T12:02:00.000Z");
      expect(await control.service.sweepExpiredLeases()).toEqual([]);
    } finally {
      control.close();
    }
  });
});

const heartbeat = () => ({
  daemonVersion: "0.1.0",
  uptimeSeconds: 10,
  backends: [{
    id: backendId,
    provider: "codex" as const,
    cliVersion: "1.2.3",
    executablePath: "/usr/local/bin/codex",
    authStatus: "ready" as const,
    health: "ready" as const,
    capabilities: {
      models: [{ id: "gpt-5.6-sol", label: "GPT-5.6 Sol", reasoningOptions: ["high"], defaultReasoning: "high" }],
      supportsResume: true,
      supportsStructuredOutput: true,
      policy: { workspaceWrite: true, networkControl: true, readOnlyRoots: true },
      refreshedAt: "2026-08-29T12:00:00.000Z"
    }
  }],
  checkout: {
    repositoryUrl,
    path: "/managed/ballet",
    headSha,
    configHash,
    snapshotHash,
    dirty: false,
    lastInspectedAt: "2026-08-29T12:00:00.000Z"
  }
});
