import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rootRunStateProjectionSchema } from "../../shared/api/runtime-schemas.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import { LoopRunConflictError } from "../runtime/LoopRunErrors.js";
import type { LocalRunService } from "../runs/LocalRunService.js";
import type { WorkspaceInvalidationBroadcaster } from "../runs/WorkspaceInvalidationBroadcaster.js";
import type { MarkdownStore } from "../store.js";
import { createApiRouter } from "./apiRouter.js";
import { sendKnownHttpError } from "./errors.js";

const rootRunId = "10000000-0000-4000-8000-000000000001";
const nodeRunId = "20000000-0000-4000-8000-000000000002";
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("Run HTTP contracts", () => {
  it("returns the bounded State projection and exposes no mutation route", async () => {
    const state = {
      currentRevision: 1,
      currentState: { ready: true },
      currentStateSha256: "a".repeat(64),
      revisions: [{
        rootRunId, revision: 1, parentRevision: 0, stateSha256: "a".repeat(64),
        sourceNodeRunId: nodeRunId, patchOmitted: true, createdAt: "2026-01-01T00:00:00.000Z"
      }],
      totalRevisionCount: 2,
      historyTruncated: true
    };
    const { base } = await startApp({ state: vi.fn(() => state) });

    const response = await fetch(`${base}/runs/${rootRunId}/state`);
    expect(response.status).toBe(200);
    expect(rootRunStateProjectionSchema.parse(await response.json())).toEqual(state);

    const mutation = await fetch(`${base}/runs/${rootRunId}/state`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: {} })
    });
    expect(mutation.status).toBe(404);
  });

  it("rejects legacy response bodies before the service and reports stale roles as conflicts", async () => {
    const respond = vi.fn(async () => {
      throw new LoopRunConflictError(`Node Run ${nodeRunId} is not a Human work Node awaiting this outcome.`);
    });
    const { base } = await startApp({ respond });

    const legacy = await fetch(`${base}/runs/${rootRunId}/nodes/${nodeRunId}/respond`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ approved: true, outcome: "legacy" })
    });
    expect(legacy.status).toBe(400);
    expect(respond).not.toHaveBeenCalled();

    const wrongRole = await fetch(`${base}/runs/${rootRunId}/nodes/${nodeRunId}/respond`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "work",
        outcome: { role: "work", state: "completed", summary: "Done.", artifacts: {}, checks: [] }
      })
    });
    expect(wrongRole.status).toBe(409);
    await expect(wrongRole.json()).resolves.toEqual({
      error: `Node Run ${nodeRunId} is not a Human work Node awaiting this outcome.`
    });
  });

  it("uses the shared strict list query schema", async () => {
    const list = vi.fn(() => ({ items: [] }));
    const { base } = await startApp({ list });

    const invalid = await fetch(`${base}/runs?state=active&stepId=legacy`);
    expect(invalid.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });
});

const startApp = async (runOverrides: Partial<LocalRunService>) => {
  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter({
    store: {} as MarkdownStore,
    runtime: {} as LocalRuntimeService,
    executions: {} as ExecutionStore,
    runs: runOverrides as LocalRunService,
    invalidations: {} as WorkspaceInvalidationBroadcaster,
    logsPath: "/tmp/ballet-run-http.log"
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
  return { base: `http://127.0.0.1:${address.port}/api` };
};
