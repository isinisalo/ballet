import express from "express";
import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRouter } from "../routes.js";
import { store } from "../store.js";
import { notifyRuntimeChanged } from "../runtime-events.js";
import type { AgentRun, AgentRunLog } from "../shared/domain.js";

const listen = async (app: express.Express): Promise<{ server: Server; url: string }> => {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
  return { server, url: `http://127.0.0.1:${address.port}` };
};

describe("API routes", () => {
  const tempRoots: string[] = [];

  const tempRoot = async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ballet-routes-"));
    tempRoots.push(root);
    return root;
  };

  afterEach(async () => {
    vi.restoreAllMocks();
    delete process.env.BALLET_PROJECT_ROOT;
    delete process.env.BALLET_DB_PATH;
    await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("saves project Markdown documents without routing them through mutable collections", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const saveProjectDocument = vi.spyOn(store, "saveProjectDocument").mockResolvedValue({
      id: "project",
      title: "Project",
      collection: "project",
      absolutePath: "/test/.ballet/project.md",
      relativePath: ".ballet/project.md",
      slug: "project",
      frontmatter: { title: "Project" },
      body: "Updated body"
    });
    const { server, url } = await listen(app);

    try {
      const response = await fetch(`${url}/api/project-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relativePath: ".ballet/project.md",
          frontmatter: { title: "Project" },
          body: "Updated body"
        })
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        relativePath: ".ballet/project.md",
        frontmatter: { title: "Project" }
      });
      expect(saveProjectDocument).toHaveBeenCalledWith({
        relativePath: ".ballet/project.md",
        frontmatter: { title: "Project" },
        body: "Updated body"
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("serves runtime health, agent runs, logs, and retry", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const run: AgentRun = {
      runId: "run-1",
      triggerEventId: "event-1",
      policyId: "policy-1",
      policyVersion: 1,
      agentRole: "developer-agent",
      status: "failed",
      attempt: 1,
      createdAt: "2026-06-24T08:00:00.000Z",
      updatedAt: "2026-06-24T08:01:00.000Z",
      error: "boom"
    };
    const log: AgentRunLog = {
      id: 1,
      runId: "run-1",
      level: "error",
      message: "boom",
      createdAt: "2026-06-24T08:01:00.000Z"
    };
    vi.spyOn(store, "runtimeHealth").mockReturnValue({ ok: true, sqliteVersion: "3.53.2" });
    vi.spyOn(store, "listAgentRuns").mockReturnValue([run]);
    vi.spyOn(store, "listRunLogs").mockReturnValue([log]);
    vi.spyOn(store, "retryAgentRun").mockReturnValue({ ...run, status: "queued", error: undefined });
    const { server, url } = await listen(app);

    try {
      const health = await fetch(`${url}/api/runtime/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({ ok: true, sqliteVersion: "3.53.2" });

      const runs = await fetch(`${url}/api/agent-runs`);
      expect(runs.status).toBe(200);
      expect(await runs.json()).toEqual([run]);

      const logs = await fetch(`${url}/api/agent-runs/run-1/logs`);
      expect(logs.status).toBe(200);
      expect(await logs.json()).toEqual([log]);

      const retry = await fetch(`${url}/api/agent-runs/run-1/retry`, { method: "POST" });
      expect(retry.status).toBe(200);
      expect(await retry.json()).toMatchObject({ runId: "run-1", status: "queued" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("returns runtime events in /api/data while preserving Markdown event documents", async () => {
    const root = await tempRoot();
    process.env.BALLET_PROJECT_ROOT = root;
    process.env.BALLET_DB_PATH = path.join(root, "runtime.sqlite");
    await mkdir(path.join(root, ".ballet/events"), { recursive: true });
    await mkdir(path.join(root, ".ballet/policies"), { recursive: true });
    await writeFile(path.join(root, ".ballet/project.md"), "---\nid: project\nname: Project\n---\n\nProject body.", "utf8");
    await writeFile(path.join(root, ".ballet/events/markdown-event.md"), "---\nid: markdown-event\neventType: markdown.event\nsource: fixture\nstatus: received\ncreatedAt: 2026-06-24T08:00:00.000Z\n---\n\nMarkdown event.", "utf8");

    store.runtimeDatabase().intakeEvent({
      projectId: "project",
      eventType: "runtime.event",
      source: "runtime",
      payload: {}
    }, {
      agents: [],
      contracts: [],
      operations: [],
      routingPolicies: [],
      emissionPolicies: [],
      eventDefinitions: [],
      loopDefinitions: []
    });

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);

    try {
      const response = await fetch(`${url}/api/data`);
      expect(response.status).toBe(200);
      const data = await response.json() as {
        eventDefinitions: Array<{ id: string; eventType: string; relativePath?: string }>;
        events: Array<{ id: string; eventType: string; relativePath?: string; routing?: { matchedPolicies: number } }>;
        documents?: { events: Array<{ id: string; relativePath?: string }> };
      };

      expect(data.eventDefinitions).toHaveLength(1);
      expect(data.eventDefinitions[0]).toMatchObject({
        id: "markdown-event",
        eventType: "markdown.event",
        relativePath: ".ballet/events/markdown-event.md"
      });
      expect(data.events).toHaveLength(1);
      expect(data.events[0]).toMatchObject({
        eventType: "runtime.event",
        routing: { matchedPolicies: 0 }
      });
      expect(data.events[0]?.relativePath).toBeUndefined();
      expect(data.documents?.events[0]).toMatchObject({
        id: "markdown-event",
        relativePath: ".ballet/events/markdown-event.md"
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("validates intake event types against active Markdown event definitions", async () => {
    const root = await tempRoot();
    process.env.BALLET_PROJECT_ROOT = root;
    process.env.BALLET_DB_PATH = path.join(root, "runtime.sqlite");
    await mkdir(path.join(root, ".ballet/events"), { recursive: true });
    await mkdir(path.join(root, ".ballet/contracts"), { recursive: true });
    await writeFile(path.join(root, ".ballet/project.md"), "---\nid: project\nname: Project\n---\n\nProject body.", "utf8");
    await writeFile(path.join(root, ".ballet/contracts/plan-approved-data.md"), "---\napiVersion: ballet.dev/v1\nkind: ContractDefinition\nmetadata:\n  id: plan-approved-data\n  version: 1\nspec:\n  name: Plan approved data\n  description: Plan approved data.\n  kind: event-data\n  active: true\n  schema:\n    type: object\n    additionalProperties: true\n  examples:\n    - {}\n---\n\nContract.", "utf8");
    await writeFile(path.join(root, ".ballet/events/plan-approved-v1.md"), "---\napiVersion: ballet.dev/v1\nkind: EventDefinition\nmetadata:\n  id: plan-approved-v1\nspec:\n  name: Plan approved\n  active: true\n  eventType: plan.approved.v1\n  source: \"*\"\n  dataContract:\n    id: plan-approved-data\n    version: 1\n  examples:\n    - {}\n---\n\nAllowed event.", "utf8");

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);

    try {
      const allowed = await fetch(`${url}/api/events/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "project",
          eventType: "plan.approved.v1",
          source: "test",
          payload: {}
        })
      });
      expect(allowed.status).toBe(201);
      expect(await allowed.json()).toMatchObject({ eventType: "plan.approved.v1" });

      const blocked = await fetch(`${url}/api/events/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "project",
          eventType: "unknown.event.v1",
          source: "test",
          payload: {}
        })
      });
      expect(blocked.status).toBe(400);
      expect(await blocked.json()).toMatchObject({ error: "Unknown or inactive event type: unknown.event.v1" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("rejects policies that do not handle active event catalog types", async () => {
    const root = await tempRoot();
    process.env.BALLET_PROJECT_ROOT = root;
    process.env.BALLET_DB_PATH = path.join(root, "runtime.sqlite");
    await mkdir(path.join(root, ".ballet/events"), { recursive: true });
    await mkdir(path.join(root, ".ballet/policies"), { recursive: true });
    await writeFile(path.join(root, ".ballet/project.md"), "---\nid: project\nname: Project\n---\n\nProject body.", "utf8");
    await writeFile(path.join(root, ".ballet/events/plan-approved-v1.md"), "---\napiVersion: ballet.dev/v1\nkind: EventDefinition\nmetadata:\n  id: plan-approved-v1\nspec:\n  name: Plan approved\n  active: true\n  eventType: plan.approved.v1\n  dataContract:\n    id: plan-approved-data\n    version: 1\n---\n\nAllowed event.", "utf8");

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);

    try {
      const unknown = await fetch(`${url}/api/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Unknown event policy",
          description: "Invalid.",
          active: true,
          consumes: { eventType: "unknown.event.v1" },
          dispatch: { operation: { id: "developer-agent/implement-change", version: 1 } },
          input: { object: {} }
        })
      });
      expect(unknown.status).toBe(400);
      expect(await unknown.json()).toMatchObject({ error: "Policy references unknown or inactive event type: unknown.event.v1" });

      const empty = await fetch(`${url}/api/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Empty event policy",
          description: "Invalid.",
          active: true,
          consumes: { eventType: "" },
          dispatch: { operation: { id: "developer-agent/implement-change", version: 1 } },
          input: { object: {} }
        })
      });
      expect(empty.status).toBe(400);
      expect(await empty.json()).toMatchObject({ error: "Policy must handle exactly one active event type." });

      const multiple = await fetch(`${url}/api/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Multiple event policy",
          description: "Invalid.",
          active: true,
          consumes: {},
          dispatch: { operation: { id: "developer-agent/implement-change", version: 1 } },
          input: { object: {} }
        })
      });
      expect(multiple.status).toBe(400);
      expect(await multiple.json()).toMatchObject({ error: "Policy must handle exactly one active event type." });

      const valid = await fetch(`${url}/api/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Plan approved policy",
          description: "Valid.",
          active: true,
          consumes: { eventType: "plan.approved.v1" },
          dispatch: { operation: { id: "developer-agent/implement-change", version: 1 } },
          input: { object: {} }
        })
      });
      expect(valid.status).toBe(201);
      expect(await valid.json()).toMatchObject({
        name: "Plan approved policy",
        consumes: { eventType: "plan.approved.v1" }
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("protects event definitions that are consumed by policies", async () => {
    const root = await tempRoot();
    process.env.BALLET_PROJECT_ROOT = root;
    process.env.BALLET_DB_PATH = path.join(root, "runtime.sqlite");
    await mkdir(path.join(root, ".ballet/events"), { recursive: true });
    await mkdir(path.join(root, ".ballet/policies"), { recursive: true });
    await writeFile(path.join(root, ".ballet/project.md"), "---\nid: project\nname: Project\n---\n\nProject body.", "utf8");
    await writeFile(path.join(root, ".ballet/events/plan-approved-v1.md"), "---\napiVersion: ballet.dev/v1\nkind: EventDefinition\nmetadata:\n  id: plan-approved-v1\nspec:\n  name: Plan approved\n  active: true\n  eventType: plan.approved.v1\n  dataContract:\n    id: plan-approved-data\n    version: 1\n---\n\nAllowed event.", "utf8");
    await writeFile(path.join(root, ".ballet/policies/on-plan-approved.md"), "---\napiVersion: ballet.dev/v1\nkind: RoutingPolicy\nmetadata:\n  id: on-plan-approved\nspec:\n  name: On plan approved\n  description: Route approved plans.\n  active: true\n  consumes:\n    eventType: plan.approved.v1\n  dispatch:\n    operation:\n      id: developer-agent/implement-change\n      version: 1\n  input:\n    object: {}\n---\n\nPolicy body.", "utf8");

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);

    try {
      const deactivate = await fetch(`${url}/api/event-definitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "plan-approved-v1",
          name: "Plan approved",
          description: "Allowed event.",
          active: false,
          eventType: "plan.approved.v1",
          source: "*",
          dataContract: { id: "plan-approved-data", version: 1 },
          examples: []
        })
      });
      expect(deactivate.status).toBe(400);
      expect(await deactivate.json()).toMatchObject({ error: "Event type plan.approved.v1 is used by policies: On plan approved" });

      const rename = await fetch(`${url}/api/event-definitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "plan-approved-v1",
          name: "Plan approved",
          description: "Allowed event.",
          active: true,
          eventType: "plan.accepted.v1",
          source: "*",
          dataContract: { id: "plan-approved-data", version: 1 },
          examples: []
        })
      });
      expect(rename.status).toBe(400);
      expect(await rename.json()).toMatchObject({ error: "Event type plan.approved.v1 cannot be renamed because it is used by policies: On plan approved" });

      const deleteResponse = await fetch(`${url}/api/event-definitions/plan-approved-v1`, { method: "DELETE" });
      expect(deleteResponse.status).toBe(400);
      expect(await deleteResponse.json()).toMatchObject({ error: "Event type plan.approved.v1 is used by policies: On plan approved" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("streams runtime changes over SSE", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);
    const controller = new AbortController();

    const readUntil = async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      predicate: (text: string) => boolean
    ): Promise<string> => {
      const decoder = new TextDecoder();
      let text = "";
      const deadline = Date.now() + 2000;
      while (!predicate(text)) {
        if (Date.now() > deadline) throw new Error(`Timed out waiting for SSE data. Received: ${text}`);
        const chunk = await reader.read();
        if (chunk.done) break;
        text += decoder.decode(chunk.value, { stream: true });
      }
      return text;
    };

    try {
      const response = await fetch(`${url}/api/runtime/stream`, { signal: controller.signal });
      expect(response.status).toBe(200);
      expect(response.body).toBeTruthy();
      const reader = response.body!.getReader();
      await readUntil(reader, (text) => text.includes("event: ready"));
      notifyRuntimeChanged("agent-runs");
      const text = await readUntil(reader, (nextText) => nextText.includes("event: change"));
      expect(text).toContain('"signal":"agent-runs"');
      await reader.cancel();
    } finally {
      controller.abort();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
