import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";
import { afterEach, describe, expect, test, vi } from "vitest";
import { emptyEventStormingModel, type EventStormingDocument } from "../../../shared/orchestration/eventStorming.js";
import { sendKnownHttpError } from "../../http/errors.js";
import { loopbackSecurity } from "../../server/createBalletServer.js";
import { ProjectDocumentRepository } from "../project/ProjectDocumentRepository.js";
import { ProjectConfigurationRepository } from "../project/ProjectConfigurationRepository.js";
import { ProjectDefinitionService } from "../project/ProjectDefinitionService.js";
import { ApiController, type OrchestrationControllerDependencies } from "./ApiController.js";
import { createOrchestrationRouter } from "./createOrchestrationRouter.js";
import { InvalidationBroadcaster } from "./InvalidationBroadcaster.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
const headers = { Origin: "http://127.0.0.1:4317", "Content-Type": "application/json" };
const json = (value: unknown): RequestInit => ({ method: "PUT", headers, body: JSON.stringify(value) });

describe("Event Storming HTTP contracts", () => {
  test("writes only model.md; SQLite is used solely for the read-only active Run lock", async () => {
    const { request, root, queries, invalidations } = await fixture();
    const empty = await (await request("")).json() as EventStormingDocument;
    expect(empty.contentHash).toBe("absent");
    const response = await request("", json({ value: empty.value, expectedHash: "absent" })); expect(response.status).toBe(200);
    const saved = await response.json() as EventStormingDocument;
    expect(saved.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(path.join(root, ".ballet/event-storming/model.md"), "utf8")).toContain("version: 1");
    expect(await (await request("")).json()).toEqual(saved);
    expect(readdirSync(path.join(root, ".ballet"))).toEqual(["event-storming"]);
    expect(queries.mock.calls.map(([sql]) => sql.trim())).toEqual(["SELECT 1 FROM environment_runs WHERE status IN ('pending','running') LIMIT 1"]);
    expect(invalidations.list(0)).toHaveLength(1);
  });
  test("rejects hostile origins, unknown fields/queries, incompatible versions, oversized requests and stale hashes", async () => {
    const { request } = await fixture(); const value = emptyEventStormingModel();
    expect((await request("", { ...json({ value, expectedHash: "absent" }), headers: { ...headers, Origin: "https://hostile.invalid" } })).status).toBe(403);
    for (const body of [{ value, expectedHash: "absent", actor: "forged" }, { value: { ...value, version: 2 }, expectedHash: "absent" }, { value: { ...value, done: true }, expectedHash: "absent" }]) {
      expect((await request("", json(body))).status).toBe(400);
    }
    expect((await request("?path=../../outside")).status).toBe(400);
    expect((await request("", json({ value, expectedHash: "f".repeat(64) }))).status).toBe(409);
    expect((await request("", json({ extra: "x".repeat(1_100_000) }))).status).toBe(413);
  });
  test("active Run keeps reads available and blocks writes", async () => {
    const { request, database } = await fixture();
    database.prepare("INSERT INTO environment_runs (status) VALUES ('running')").run();
    expect((await request("")).status).toBe(200);
    expect((await request("", json({ value: emptyEventStormingModel(), expectedHash: "absent" }))).status).toBe(409);
  });
});

async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ballet-storm-http-")); mkdirSync(path.join(root, ".ballet"));
  const database = new Database(":memory:"); database.exec("CREATE TABLE environment_runs (status TEXT)");
  const queries = vi.spyOn(database, "prepare"); const connection = () => database;
  const projects = new ProjectConfigurationRepository(path.join(root, ".ballet/project.json"), connection);
  const project = new ProjectDefinitionService(root, projects, new ProjectDocumentRepository(path.join(root, ".ballet"), connection));
  const invalidations = new InvalidationBroadcaster();
  // Only the exercised Event Storming facade dependencies exist; runtime operations must not be reached.
  const controller = new ApiController({ project, connection, invalidations, now: () => "2026-09-05T10:00:00.000Z" } as unknown as OrchestrationControllerDependencies);
  const app = express(); app.use(loopbackSecurity(4317)); app.use(express.json({ limit: "1mb" }));
  app.use("/api", createOrchestrationRouter({ controller, actor: () => ({ id: "human", source: "request_context" }) }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next; if (!sendKnownHttpError(error, res)) res.status(500).json({ error: String(error) });
  });
  const server = createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No server address");
  cleanups.push(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); database.close(); rmSync(root, { recursive: true, force: true }); });
  return { root, database, queries, invalidations, request: (suffix: string, init?: RequestInit) => fetch(`http://127.0.0.1:${address.port}/api/event-storming${suffix}`, init) };
}
