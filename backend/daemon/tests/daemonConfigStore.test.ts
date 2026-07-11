import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DaemonConfigStore, type DaemonConfig } from "../config/DaemonConfigStore.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("per-project daemon configuration", () => {
  it("keeps pairing registrations for multiple projects and reactivates them with the current checkout", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "ballet-daemon-config-"));
    roots.push(home);
    const store = new DaemonConfigStore(home);
    const first = configuration("first-1", "10000000-0000-4000-8000-000000000001", "/git/first");
    const second = configuration("second-2", "20000000-0000-4000-8000-000000000001", "/git/second");

    await store.save(first);
    await store.save(second);

    expect(await store.load()).toEqual(second);
    expect(await store.loadProject(first.projectId!)).toEqual(first);
    expect(await store.loadProject(second.projectId!)).toEqual(second);

    const activated = await store.activateProject(first.projectId!, {
      repositoryUrl: "git@github.com:acme/first.git",
      repositoryPath: "/new-clone/first"
    });

    expect(activated).toMatchObject({
      projectId: first.projectId,
      deviceId: first.deviceId,
      repositoryUrl: "git@github.com:acme/first.git",
      repositoryPath: path.resolve("/new-clone/first")
    });
    expect(await store.load()).toEqual(activated);
    expect(await store.loadProject(first.projectId!)).toEqual(activated);
    expect(await store.loadProject(second.projectId!)).toEqual(second);

    await expect(store.activateProject("missing-project", {
      repositoryUrl: "https://github.com/acme/missing.git",
      repositoryPath: "/git/missing"
    })).resolves.toBeUndefined();
    expect(await store.load()).toEqual(activated);
  });
});

const configuration = (projectId: string, deviceId: string, repositoryPath: string): DaemonConfig => ({
  version: 1,
  serverUrl: "http://127.0.0.1:4317",
  appUrl: "http://127.0.0.1:4317",
  deviceId,
  daemonId: deviceId.replace(/0001$/, "0002"),
  displayName: `${projectId} Mac`,
  daemonVersion: "1.2.3",
  backends: [
    { id: deviceId.replace(/0001$/, "0003"), provider: "codex", command: "codex" },
    { id: deviceId.replace(/0001$/, "0004"), provider: "copilot", command: "copilot" }
  ],
  projectId,
  repositoryUrl: `https://github.com/acme/${projectId}.git`,
  repositoryPath
});
