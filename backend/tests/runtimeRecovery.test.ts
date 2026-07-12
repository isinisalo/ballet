import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import { createControlPlane } from "../control-plane/createControlPlane.js";

const roots: string[] = [];
const instances: Array<ReturnType<typeof createControlPlane>> = [];

afterEach(async () => {
  instances.splice(0).forEach((instance) => instance.close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("local runtime recovery", () => {
  it("restores a missing device and agent attachment idempotently", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ballet-control-recovery-"));
    roots.push(root);
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    await writeFile(path.join(root, ".ballet", "project.json"), `${JSON.stringify({
      version: 6,
      agents: { developer: { provider: "codex", model: "gpt-5", reasoning: "high", policy: { network: false } } },
      loops: []
    }, null, 2)}\n`, "utf8");
    const control = createControlPlane({
      dbPath: path.join(root, "control.sqlite"),
      maintenance: false,
      project: { id: "project", repositoryUrl: "https://example.test/repo.git", checkoutPath: root }
    });
    instances.push(control);
    const deviceId = uuid(), daemonId = uuid(), codexId = uuid(), copilotId = uuid();
    const token = "restored-daemon-token-that-is-long-enough";
    const recovery = {
      projectId: "project", deviceId, daemonId, daemonToken: token,
      hostname: "mac.local", displayName: "Local Mac", platform: "darwin" as const,
      architecture: "arm64" as const, daemonVersion: "1.0.0",
      backends: [{ id: codexId, provider: "codex" as const }, { id: copilotId, provider: "copilot" as const }]
    };

    expect(control.service.recoverLocalRuntime(recovery).restoredAgentIds).toEqual(["developer"]);
    expect(control.service.recoverLocalRuntime(recovery).restoredAgentIds).toEqual([]);
    expect(control.service.authenticateDaemon(token).deviceId).toBe(deviceId);
    expect(control.service.getAgentRuntime("developer")).toMatchObject({
      attachment: { runtimeBackendId: codexId, readOnlyRoots: [] },
      intent: { provider: "codex", model: "gpt-5" }
    });
    expect(control.service.localRuntimeStatus(deviceId)).toEqual({ registered: true, online: false, backendsReady: false });
    expect(control.database.connection().prepare("SELECT COUNT(*) AS count FROM runtime_devices").get()).toEqual({ count: 1 });
    await control.service.revokeDevice(deviceId);
    expect(() => control.service.recoverLocalRuntime(recovery)).toThrow("revoked");
  });
});
