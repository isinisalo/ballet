import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
    connection.exec("CREATE TABLE loop_runs (project_id TEXT NOT NULL, status TEXT NOT NULL); INSERT INTO loop_runs VALUES ('release-smoke', 'running');");

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