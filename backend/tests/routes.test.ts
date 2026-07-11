import express from "express";
import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { apiRouter } from "../routes.js";

const roots: string[] = [];

const listen = async (): Promise<{ server: Server; url: string }> => {
  const app = express();
  app.use(express.json());
  app.use("/api", apiRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind.");
  return { server, url: `http://127.0.0.1:${address.port}` };
};

const config = {
  version: 3 as const,
  loops: [{
    id: "approval",
    start: "gate",
    steps: [{
      id: "gate",
      type: "human" as const,
      description: "Approve.",
      on: { approved: { end: "completed" as const }, rejected: { end: "failed" as const } }
    }]
  }]
};

const projectRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-api-v3-"));
  roots.push(root);
  process.env.BALLET_PROJECT_ROOT = root;
  process.env.BALLET_CONTROL_PLANE_DB_PATH = path.join(root, "runtime.sqlite");
  await mkdir(path.join(root, ".ballet"), { recursive: true });
  await writeFile(path.join(root, ".ballet/project.md"), "---\nid: project\nname: Project\n---\n", "utf8");
  await writeFile(path.join(root, ".ballet/project.json"), JSON.stringify(config, null, 2), "utf8");
  return root;
};

afterEach(async () => {
  delete process.env.BALLET_PROJECT_ROOT;
  delete process.env.BALLET_CONTROL_PLANE_DB_PATH;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("loop run API", () => {
  it("starts, reads, responds to, and rejects a second active run", async () => {
    await projectRoot();
    const { server, url } = await listen();
    try {
      const started = await fetch(`${url}/api/loops/approval/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "Review this" })
      });
      expect(started.status).toBe(201);
      const run = await started.json() as { runId: string; status: string; stepRuns: Array<{ stepRunId: string }> };
      expect(run.status).toBe("waiting_for_human");

      const conflict = await fetch(`${url}/api/loops/approval/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      expect(conflict.status).toBe(409);

      const latest = await fetch(`${url}/api/loops/approval/runs/latest`);
      expect(latest.status).toBe(200);
      expect(await latest.json()).toMatchObject({ runId: run.runId, status: "waiting_for_human" });

      const missingInput = await fetch(`${url}/api/loop-runs/${run.runId}/steps/${run.stepRuns[0]!.stepRunId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "approved", input: "" })
      });
      expect(missingInput.status).toBe(400);

      const responded = await fetch(`${url}/api/loop-runs/${run.runId}/steps/${run.stepRuns[0]!.stepRunId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "approved", input: "Approved" })
      });
      expect(responded.status).toBe(200);
      expect(await responded.json()).toMatchObject({ status: "completed" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("returns null for a known loop without runs and 404 for unknown resources", async () => {
    await projectRoot();
    const { server, url } = await listen();
    try {
      const latest = await fetch(`${url}/api/loops/approval/runs/latest`);
      expect(latest.status).toBe(200);
      expect(await latest.json()).toBeNull();
      expect((await fetch(`${url}/api/loops/missing/runs/latest`)).status).toBe(404);
      expect((await fetch(`${url}/api/loop-runs/00000000-0000-4000-8000-000000000000/cancel`, { method: "POST" })).status).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

describe("loop run API isolation", () => {
  it("locks active loop edits and event intake does not start a loop", async () => {
    await projectRoot();
    const { server, url } = await listen();
    try {
      const event = await fetch(`${url}/api/events/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "project", eventType: "approval", payload: {} })
      });
      expect(event.status).toBe(201);
      expect(await event.json()).toMatchObject({ status: "unassigned" });
      expect(await (await fetch(`${url}/api/loops/approval/runs/latest`)).json()).toBeNull();

      await fetch(`${url}/api/loops/approval/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const changed = structuredClone(config);
      changed.loops[0]!.steps[0]!.description = "Changed while active.";
      const save = await fetch(`${url}/api/automation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changed)
      });
      expect(save.status).toBe(409);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
