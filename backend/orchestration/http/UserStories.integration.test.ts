import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { UserStoryDocument } from "../../../shared/orchestration/userStories.js";
import { sendKnownHttpError } from "../../http/errors.js";
import { loopbackSecurity } from "../../server/createBalletServer.js";
import { ProjectDocumentRepository } from "../project/ProjectDocumentRepository.js";
import { ProjectConfigurationRepository } from "../project/ProjectConfigurationRepository.js";
import { ProjectDefinitionService } from "../project/ProjectDefinitionService.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";
import { ApiController, type OrchestrationControllerDependencies } from "./ApiController.js";
import { createOrchestrationRouter } from "./createOrchestrationRouter.js";
import { InvalidationBroadcaster } from "./InvalidationBroadcaster.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
const input = { role: "reviewer", goal: "to read a story", benefit: "I understand the outcome", acceptanceCriteria: [] };
const headers = { Origin: "http://127.0.0.1:4317", "Content-Type": "application/json" };
const json = (method: string, value: unknown): RequestInit => ({ method, headers, body: JSON.stringify(value) });

describe("User Story HTTP contracts", () => {
  test("creates, reads, updates and deletes repository files without using a database", async () => {
    const { request, root, connection, invalidations } = await fixture();
    let response = await request("", json("POST", input)); expect(response.status).toBe(201);
    const saved = await response.json() as UserStoryDocument;
    expect(readFileSync(path.join(root, ".ballet/user-stories", `${saved.value.id}.md`), "utf8")).toContain("role: reviewer");
    response = await request(`/${saved.value.id}`); expect(await response.json()).toEqual(saved);
    response = await request(""); expect(await response.json()).toEqual({ stories: [saved], issues: [] });
    response = await request(`/${saved.value.id}`, json("PUT", { value: { ...input, goal: "to see the updated outcome" }, expectedHash: saved.contentHash }));
    expect(response.status).toBe(200); const updated = await response.json() as UserStoryDocument;
    response = await request(`/${saved.value.id}`, json("DELETE", { expectedHash: saved.contentHash })); expect(response.status).toBe(409);
    response = await request(`/${saved.value.id}`, json("DELETE", { expectedHash: updated.contentHash })); expect(response.status).toBe(204);
    response = await request(`/${saved.value.id}`); expect(response.status).toBe(404);
    expect(readdirSync(path.join(root, ".ballet"))).toEqual(["user-stories"]);
    expect(connection).not.toHaveBeenCalled();
    expect(invalidations.list(0)).toHaveLength(3);
  });

  test("rejects hostile origins, unknown fields, incomplete criteria, unsafe IDs and stale hashes", async () => {
    const { request } = await fixture();
    const hostile = await request("", { ...json("POST", input), headers: { ...headers, Origin: "https://hostile.invalid" } });
    expect(hostile.status).toBe(403);
    for (const body of [{ ...input, approvedBy: "forged" }, { ...input, role: " " },
      { ...input, acceptanceCriteria: [{ given: "a", when: "b" }] }, { ...input, role: "x".repeat(20001) }]) {
      expect((await request("", json("POST", body))).status).toBe(400);
    }
    expect((await request("/%2e%2e%2foutside")).status).toBe(400);
    expect((await request("?unexpected=true")).status).toBe(400);
    const response = await request("", json("POST", input)); const saved = await response.json() as UserStoryDocument;
    expect((await request(`/${saved.value.id}`, json("PUT", { value: input, expectedHash: "f".repeat(64) }))).status).toBe(409);
    expect(await (await request(`/${saved.value.id}`)).json()).toEqual(saved);
  });

  test("keeps reads available and rejects every mutation during an active Run", async () => {
    const { request, projects } = await fixture();
    const saved = await (await request("", json("POST", input))).json() as UserStoryDocument;
    vi.spyOn(projects, "assertUnlocked").mockImplementation(() => { throw new ConflictError("Locked by active Run"); });
    expect((await request("", json("POST", input))).status).toBe(409);
    expect((await request(`/${saved.value.id}`, json("PUT", { value: input, expectedHash: saved.contentHash }))).status).toBe(409);
    expect((await request(`/${saved.value.id}`, json("DELETE", { expectedHash: saved.contentHash }))).status).toBe(409);
    expect((await request(`/${saved.value.id}`)).status).toBe(200);
  });
});

async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ballet-user-story-http-")); mkdirSync(path.join(root, ".ballet"));
  const projects = new ProjectConfigurationRepository(path.join(root, ".ballet/project.json"));
  const project = new ProjectDefinitionService(root, projects, new ProjectDocumentRepository(path.join(root, ".ballet")));
  const connection = vi.fn(() => { throw new Error("User Story request accessed SQLite"); });
  const invalidations = new InvalidationBroadcaster();
  // Only the exercised User Story facade dependencies exist; runtime operations must not be reached.
  const controller = new ApiController({ project, connection, invalidations, now: () => "2026-09-05T10:00:00.000Z" } as unknown as OrchestrationControllerDependencies);
  const app = express(); app.use(loopbackSecurity(4317)); app.use(express.json({ limit: "1mb" }));
  app.use("/api", createOrchestrationRouter({ controller, actor: () => ({ id: "human", source: "request_context" }) }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next; if (!sendKnownHttpError(error, res)) res.status(500).json({ error: String(error) });
  });
  const server = createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No server address");
  cleanups.push(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); rmSync(root, { recursive: true, force: true }); });
  return { root, connection, projects, invalidations, request: (suffix: string, init?: RequestInit) => fetch(`http://127.0.0.1:${address.port}/api/user-stories${suffix}`, init) };
}
