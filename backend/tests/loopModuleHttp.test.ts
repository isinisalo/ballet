import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import { createApiRouter } from "../http/apiRouter.js";
import { sendKnownHttpError } from "../http/errors.js";
import type { LocalRunService } from "../runs/LocalRunService.js";
import type { WorkspaceInvalidationBroadcaster } from "../runs/WorkspaceInvalidationBroadcaster.js";
import type { MarkdownStore } from "../store.js";
import { testLoopModulePackage } from "./loopModuleTestFixture.js";

const servers: Server[] = [];
afterEach(async () => Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))));

describe("Loop module HTTP API", () => {
  it("exposes bounded library, inspection, plan, commit, export, status, and remove contracts", async () => {
    const pkg = testLoopModulePackage();
    const plan = { planHash: "a".repeat(64), packageSha256: "b".repeat(64), canInstall: true };
    const installed = { moduleId: "sample-loop", loopId: "sample-loop", status: "exact" };
    const methods = {
      listLoopModuleLibrary: vi.fn(async () => [{ source: ".ballet/loop-library/sample.ballet-loop.json", valid: true, sizeBytes: 1, package: pkg, manifest: pkg.manifest, permissions: pkg.permissions, issues: [] }]),
      inspectLoopModule: vi.fn(() => ({ valid: true, source: "local-import", sizeBytes: 1, package: pkg, sha256: "b".repeat(64), issues: [] })),
      planLoopModuleInstall: vi.fn(async () => plan),
      installLoopModule: vi.fn(async () => installed),
      exportLoopModule: vi.fn(async () => ({ package: pkg, canonicalJson: JSON.stringify(pkg), sha256: "b".repeat(64), filename: "sample.ballet-loop.json" })),
      loopModuleStatuses: vi.fn(async () => [installed]),
      removeInstalledLoopModule: vi.fn(async () => undefined)
    };
    const publish = vi.fn();
    const base = await start(methods, publish);

    expect((await fetch(`${base}/loop-modules/library`)).status).toBe(200);
    expect((await fetch(`${base}/loop-modules/inspect`, json({ package: pkg, source: "local-import" }))).status).toBe(200);
    expect((await fetch(`${base}/loop-modules/install-plan`, json({ package: pkg, source: "local-import", profileMappings: {} }))).status).toBe(200);
    expect((await fetch(`${base}/loop-modules/install`, json({ package: pkg, source: "local-import", profileMappings: {}, expectedPlanHash: "a".repeat(64) }))).status).toBe(201);
    expect((await fetch(`${base}/loop-modules/export`, json({ loopId: "sample-loop" }))).status).toBe(200);
    expect((await fetch(`${base}/loop-modules/status`)).status).toBe(200);
    expect((await fetch(`${base}/loop-modules/installed/sample-loop`, { method: "DELETE" })).status).toBe(204);
    expect(publish).toHaveBeenCalledWith({ type: "workspace-changed", reason: "loop-module-install" });
    expect(publish).toHaveBeenCalledWith({ type: "workspace-changed", reason: "loop-module-remove" });

    const arbitraryPath = await fetch(`${base}/loop-modules/library/package?path=/etc/passwd`);
    expect(arbitraryPath.status).toBe(404);
    const unknown = await fetch(`${base}/loop-modules/install-plan`, json({ package: pkg, source: "local-import", serverPath: "/etc/passwd" }));
    expect(unknown.status).toBe(400);
    expect(methods.planLoopModuleInstall).toHaveBeenCalledTimes(1);
  });
});

const json = (body: unknown): RequestInit => ({
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
});

const start = async (methods: Record<string, unknown>, publish: ReturnType<typeof vi.fn>) => {
  const app = express(); app.use(express.json({ limit: "1mb" }));
  app.use("/api", createApiRouter({
    store: methods as unknown as MarkdownStore,
    runtime: {} as LocalRuntimeService,
    executions: {} as ExecutionStore,
    runs: {} as LocalRunService,
    invalidations: { publish } as unknown as WorkspaceInvalidationBroadcaster,
    logsPath: "/tmp/ballet-loop-module-http.log"
  }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next; if (!sendKnownHttpError(error, res)) res.status(500).json({ error: "Unexpected error." });
  });
  const server = createServer(app); servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Expected HTTP port.");
  return `http://127.0.0.1:${address.port}/api`;
};
