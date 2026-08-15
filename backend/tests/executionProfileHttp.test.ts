import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import { createApiRouter } from "../http/apiRouter.js";
import { sendKnownHttpError } from "../http/errors.js";
import { RuntimeDatabase } from "../runtime-db.js";
import type { LocalRunService } from "../runs/LocalRunService.js";
import type { WorkspaceInvalidationBroadcaster } from "../runs/WorkspaceInvalidationBroadcaster.js";
import { MarkdownStore } from "../store.js";

const servers: Server[] = [];
const stores: MarkdownStore[] = [];
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  stores.splice(0).forEach((store) => store.runtimeDatabase().close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ExecutionProfile HTTP API", () => {
  it("serializes colliding creates as 201 and 409 while PUT only updates existing profiles", async () => {
    const { base, publish, store } = await startApp();
    const request = {
      name: "Primary",
      provider: "codex",
      model: "gpt-5",
      reasoningEffort: "medium",
      networkAccess: false
    };
    const create = () => fetch(`${base}/execution-profiles/primary`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    });

    const responses = await Promise.all([create(), create()]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const responseBodies = await Promise.all(responses.map(async (response) => ({
      status: response.status,
      body: await response.json() as unknown
    })));
    expect(responseBodies.find((response) => response.status === 409)?.body)
      .toEqual({ error: "Execution profile primary already exists." });

    const missingUpdate = await fetch(`${base}/execution-profiles/missing`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...request, name: "Missing" })
    });
    expect(missingUpdate.status).toBe(404);
    await expect(missingUpdate.json()).resolves.toEqual({ error: "Execution profile missing was not found." });

    const update = await fetch(`${base}/execution-profiles/primary`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...request, name: "Updated primary" })
    });
    expect(update.status).toBe(200);
    await expect(update.json()).resolves.toMatchObject({ id: "primary", name: "Updated primary" });

    const persisted = JSON.parse(await readFile(path.join(store.root, ".ballet", "project.json"), "utf8")) as {
      executionProfiles: Array<{ id: string; name: string }>;
    };
    expect(persisted.executionProfiles).toEqual([expect.objectContaining({ id: "primary", name: "Updated primary" })]);
    expect(publish).toHaveBeenCalledTimes(2);
  });
});

const startApp = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-execution-profile-http-"));
  roots.push(root);
  const store = new MarkdownStore(root, new RuntimeDatabase(path.join(root, "state.sqlite")));
  stores.push(store);
  const publish = vi.fn();
  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter({
    store,
    runtime: {} as LocalRuntimeService,
    executions: {} as ExecutionStore,
    runs: {} as LocalRunService,
    invalidations: { publish } as unknown as WorkspaceInvalidationBroadcaster,
    logsPath: path.join(root, "ballet.log")
  }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    if (!sendKnownHttpError(error, res)) res.status(500).json({ error: "Unexpected error." });
  });
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an HTTP port.");
  return { base: `http://127.0.0.1:${address.port}/api`, publish, store };
};
