import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { builtInLoopThemes, resolveLoopTheme } from "../../shared/domain/loopThemes.js";
import { createControlPlane } from "../control-plane/createControlPlane.js";

const roots: string[] = [];
const controls: Array<ReturnType<typeof createControlPlane>> = [];

afterEach(async () => {
  controls.splice(0).forEach((control) => control.close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("project registration", () => {
  it("keeps an active Run bound to its project while another server registers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ballet-project-registration-"));
    roots.push(root);
    const control = createControlPlane({
      dbPath: path.join(root, "control.sqlite"),
      maintenance: false,
      project: { id: "release-smoke", repositoryUrl: "https://example.test/release-smoke.git", checkoutPath: root }
    });
    controls.push(control);
    const connection = control.database.connection();
    connection.prepare(`
      INSERT INTO loop_runs (
        run_id, project_id, loop_id, root_run_id, source, status, snapshot_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("run-1", "release-smoke", "delivery", "run-1", "manual", "running", JSON.stringify({
      loop: {
        id: "delivery",
        theme: "open-ai",
        start: "gate",
        steps: [{
          id: "gate",
          type: "human",
          description: "Approve.",
          nodeSize: "small",
          on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
        }]
      },
      theme: resolveLoopTheme(builtInLoopThemes, "open-ai")
    }), "2026-07-11T00:00:00.000Z", "2026-07-11T00:00:00.000Z");

    expect(() => control.service.registerProject({
      id: "ballet",
      repositoryUrl: "https://example.test/ballet.git",
      checkoutPath: path.join(root, "ballet")
    })).not.toThrow();

    const pairing = control.service.createPairing();
    const row = connection.prepare("SELECT project_id FROM pairing_sessions WHERE pairing_id = ?").get(pairing.id) as { project_id: string };
    expect(row.project_id).toBe("ballet");
  });
});
