import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBalletServer } from "../createBalletServer.js";
import { store } from "../../store.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  delete process.env.BALLET_CONTROL_PLANE_DB_PATH;
  delete process.env.BALLET_PROJECT_ID;
  delete process.env.BALLET_PROJECT_ROOT;
  store.runtimeDatabase().close();
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Ballet server composition", () => {
  it("keeps only the project-bound health probe public", async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), "ballet-server-"));
    temporaryRoots.push(temporary);
    process.env.BALLET_CONTROL_PLANE_DB_PATH = path.join(temporary, "control-plane.sqlite");
    process.env.BALLET_PROJECT_ID = "project-health-test";
    process.env.BALLET_PROJECT_ROOT = path.resolve(".fixture-ballet-project");
    const ballet = await createBalletServer();
    await new Promise<void>((resolve) => ballet.server.listen(0, "127.0.0.1", resolve));
    const address = ballet.server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port.");
    const origin = `http://127.0.0.1:${address.port}`;

    try {
      await expect(fetch(`${origin}/api/health`).then((response) => response.json())).resolves.toEqual({
        ok: true,
        projectId: "project-health-test"
      });
      expect((await fetch(`${origin}/api/data`)).status).toBe(401);
    } finally {
      await ballet.scheduler.stop();
      ballet.controlPlane.close();
      ballet.server.closeAllConnections();
      await new Promise<void>((resolve) => ballet.server.close(() => resolve()));
    }
  });
});
