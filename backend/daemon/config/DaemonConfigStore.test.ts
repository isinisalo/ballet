import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DaemonConfigStore } from "./DaemonConfigStore.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("DaemonConfigStore", () => {
  it("creates one checkout-local v2 config with a stable 0600 token", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ballet-local-daemon-")); roots.push(root);
    const store = new DaemonConfigStore(root);
    const first = await store.ensure({ instanceId: "checkout", checkoutRoot: root, serverUrl: "http://127.0.0.1:53321", daemonVersion: "test" });
    const second = await store.ensure({ instanceId: "checkout", checkoutRoot: root, serverUrl: "http://127.0.0.1:53321", daemonVersion: "test" });
    expect(first.version).toBe(2); expect(first.token).toMatch(/^[0-9a-f]{64}$/); expect(second.token).toBe(first.token);
    expect((await stat(store.path)).mode & 0o777).toBe(0o600);
    expect(first.providers.map(({ provider }) => provider)).toEqual(["codex"]);
  });

  it("rejects legacy device fields and non-loopback servers", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ballet-local-daemon-")); roots.push(root);
    const store = new DaemonConfigStore(root); await store.ensure({ instanceId: "checkout", checkoutRoot: root, serverUrl: "http://127.0.0.1:53321", daemonVersion: "test" });
    const config = JSON.parse(await readFile(store.path, "utf8")) as Record<string, unknown>;
    await writeFile(store.path, JSON.stringify({ ...config, deviceId: "legacy" }));
    await expect(store.load()).rejects.toThrow("Unknown daemon config fields");
    await writeFile(store.path, JSON.stringify({ ...config, serverUrl: "https://example.com" }));
    await expect(store.load()).rejects.toThrow("loopback HTTP");
  });

  it("archives an incompatible multi-provider config during strict-cut startup", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ballet-local-daemon-")); roots.push(root);
    const store = new DaemonConfigStore(root); const current = await store.ensure({ instanceId: "checkout", checkoutRoot: root,
      serverUrl: "http://127.0.0.1:53321", daemonVersion: "test" });
    await writeFile(store.path, JSON.stringify({ ...current, providers: [
      ...current.providers, { provider: "legacy-secondary", command: "legacy" }
    ] }));
    const repaired = await store.ensure({ instanceId: "checkout", checkoutRoot: root,
      serverUrl: "http://127.0.0.1:53321", daemonVersion: "test" });
    expect(repaired.providers.map(({ provider }) => provider)).toEqual(["codex"]);
    expect(await readdir(path.join(root, "archive"))).toEqual([expect.stringMatching(/^daemon-config-incompatible-/)]);
  });
});
