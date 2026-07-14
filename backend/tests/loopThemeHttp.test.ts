import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import { createApiRouter } from "../http/apiRouter.js";
import { sendKnownHttpError } from "../http/errors.js";
import type { LocalRunService } from "../runs/LocalRunService.js";
import type { WorkspaceInvalidationBroadcaster } from "../runs/WorkspaceInvalidationBroadcaster.js";
import type { MarkdownStore } from "../store.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("singular Loop theme HTTP API", () => {
  it("updates PUT /api/loop-theme and leaves legacy plural routes unavailable", async () => {
    const theme = {
      ...structuredClone(defaultLoopTheme),
      node: { ...defaultLoopTheme.node, glowColor: "#112233" }
    };
    const updateLoopTheme = vi.fn(async () => theme);
    const publish = vi.fn();
    const app = express();
    app.use(express.json());
    app.use("/api", createApiRouter({
      store: { updateLoopTheme } as unknown as MarkdownStore,
      runtime: {} as LocalRuntimeService,
      configurations: {} as RuntimeConfigurationService,
      executions: {} as ExecutionStore,
      runs: {} as LocalRunService,
      invalidations: { publish } as unknown as WorkspaceInvalidationBroadcaster,
      logsPath: "/tmp/ballet-test.log"
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
    const base = `http://127.0.0.1:${address.port}/api`;

    const response = await fetch(`${base}/loop-theme`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(theme)
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(theme);
    expect(updateLoopTheme).toHaveBeenCalledWith(theme);
    expect(publish).toHaveBeenCalledWith("workspace-changed", { reason: "loop-theme" });

    const legacyUpdate = await fetch(`${base}/loop-themes/default`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(theme)
    });
    const legacyCreate = await fetch(`${base}/loop-themes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme, assignToLoopId: "delivery" })
    });
    expect(legacyUpdate.status).toBe(404);
    expect(legacyCreate.status).toBe(404);
  });

  it("rejects a v1 theme before calling the store", async () => {
    const updateLoopTheme = vi.fn();
    const app = express();
    app.use(express.json());
    app.use("/api", createApiRouter({
      store: { updateLoopTheme } as unknown as MarkdownStore,
      runtime: {} as LocalRuntimeService,
      configurations: {} as RuntimeConfigurationService,
      executions: {} as ExecutionStore,
      runs: {} as LocalRunService,
      invalidations: { publish: vi.fn() } as unknown as WorkspaceInvalidationBroadcaster,
      logsPath: "/tmp/ballet-test.log"
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

    const response = await fetch(`http://127.0.0.1:${address.port}/api/loop-theme`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...defaultLoopTheme, version: 1 })
    });
    expect(response.status).toBe(400);
    expect(updateLoopTheme).not.toHaveBeenCalled();
  });
});
