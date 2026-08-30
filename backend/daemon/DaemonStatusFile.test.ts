import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeDaemonStatus } from "./DaemonStatusFile.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("writeDaemonStatus", () => {
  it("supports concurrent atomic writes without temp-file collisions", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ballet-daemon-status-")); roots.push(root);
    const target = path.join(root, "daemon", "status.json");
    await Promise.all(Array.from({ length: 20 }, (_, index) => writeDaemonStatus(target, {
      state: "running", pid: 100 + index, instanceId: "checkout", startedAt: "2026-08-29T00:00:00.000Z",
      updatedAt: new Date(index).toISOString(), activeTasks: 0
    })));
    expect(JSON.parse(await readFile(target, "utf8"))).toEqual(expect.objectContaining({ state: "running", instanceId: "checkout" }));
    expect((await stat(target)).mode & 0o777).toBe(0o600);
  });
});
