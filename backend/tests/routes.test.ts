import express from "express";
import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRouter } from "../routes.js";
import { store } from "../store.js";
import { notifyRuntimeChanged } from "../runtime-events.js";
import type { AgentRun, AgentRunLog } from "../../shared/domain/runtime.js";
import { actionRouteId } from "../../shared/policy-actions.js";

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

  it("creates project Markdown documents through the project document creation route", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const createProjectDocument = vi.spyOn(store, "createProjectDocument").mockResolvedValue({
      id: "reviewer-instructions",
      title: "Reviewer Instructions",
      collection: "project",
      absolutePath: "/test/.ballet/instructions/reviewer-instructions.md",
      relativePath: ".ballet/instructions/reviewer-instructions.md",
      slug: "reviewer-instructions",
      frontmatter: { title: "Reviewer Instructions" },
      body: ""
    });
    const { server, url } = await listen(app);

    try {
      const response = await fetch(`${url}/api/project-documents/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directoryPath: ".ballet/instructions",
          title: "Reviewer Instructions"
        })
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        relativePath: ".ballet/instructions/reviewer-instructions.md",
        frontmatter: { title: "Reviewer Instructions" }
      });
      expect(createProjectDocument).toHaveBeenCalledWith({
        directoryPath: ".ballet/instructions",
        title: "Reviewer Instructions"
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
      inputEventId: "event-1",
      actionId: "implementation",
      loopId: "plan-approved.loop",
      routeId: actionRouteId("plan-approved.loop", "implementation"),
      actionVersion: 1,
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

  it("returns runtime events in /api/data with automation definitions from project.json", async () => {
    const root = await tempRoot();
    process.env.BALLET_PROJECT_ROOT = root;
    process.env.BALLET_DB_PATH = path.join(root, "runtime.sqlite");
    await mkdir(path.join(root, ".codex/agents"), { recursive: true });
    await mkdir(path.join(root, ".ballet/events"), { recursive: true });
    await writeFile(path.join(root, ".codex/agents/developer-agent.toml"), "name = \"Developer Agent\"\ndeveloper_instructions = \"Do work.\"\n", "utf8");
    await writeFile(path.join(root, ".ballet/project.md"), "---\nid: project\nname: Project\n---\n\nProject body.", "utf8");
    await writeFile(path.join(root, ".ballet/events/markdown-event.md"), "---\nid: markdown-event\neventType: markdown.event\n---\n\nIgnored automation event.", "utf8");
    await writeFile(path.join(root, ".ballet/project.json"), JSON.stringify({
      version: 1 as const,
      actions: [{
        id: "implementation",
        description: "Implementation",
        agentId: "developer-agent"
      }],
      outputRoutes: [],
      humanGateResponses: [],
      loops: [{ id: "implementation.failed.loop", steps: ["implementation"] }],
      runtimes: []
    }, null, 2), "utf8");
    const automation = {
      version: 1 as const,
      actions: [{
        id: "implementation",
        description: "Implementation",
        agentId: "developer-agent"
      }],
      outputRoutes: [],
      humanGateResponses: [],
      loops: [{ id: "implementation.failed.loop", steps: ["implementation"] }],
      runtimes: []
    };

    store.runtimeDatabase().intakeEvent({
      projectId: "project",
      eventType: "implementation.failed",
      source: "runtime",
      payload: {}
    }, automation, []);

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);

    try {
      const response = await fetch(url + "/api/data");
      expect(response.status).toBe(200);
      const data = await response.json() as {
        eventDefinitions: Array<{ id: string; eventType: string; relativePath?: string }>;
        events: Array<{ id: string; eventType: string; relativePath?: string; routing?: { matchedActions: number } }>;
        documents?: { events: Array<{ id: string; relativePath?: string }> };
        automation: Record<string, unknown>;
      };

      expect(data.automation).not.toHaveProperty("events");
      expect(data.automation).not.toHaveProperty("policies");
      expect(data.eventDefinitions).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "implementation.failed", eventType: "implementation.failed" }),
        expect.objectContaining({ id: "implementation.failed.loop.implementation.approved", eventType: "implementation.failed.loop.implementation.approved" }),
        expect.objectContaining({ id: "implementation.failed.loop.implementation.rejected", eventType: "implementation.failed.loop.implementation.rejected" })
      ]));
      expect(data.eventDefinitions.some((definition) => definition.relativePath)).toBe(false);
      expect(data.documents?.events).toEqual([]);
      expect(data.events[0]).toMatchObject({ eventType: "implementation.failed", routing: { matchedActions: 1 } });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("validates intake event types against automation events", async () => {
    const root = await tempRoot();
    process.env.BALLET_PROJECT_ROOT = root;
    process.env.BALLET_DB_PATH = path.join(root, "runtime.sqlite");
    await mkdir(path.join(root, ".codex/agents"), { recursive: true });
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    await writeFile(path.join(root, ".codex/agents/developer-agent.toml"), "name = \"Developer Agent\"\ndeveloper_instructions = \"Do work.\"\n", "utf8");
    await writeFile(path.join(root, ".ballet/project.md"), "---\nid: project\nname: Project\n---\n\nProject body.", "utf8");
    await writeFile(path.join(root, ".ballet/project.json"), JSON.stringify({
      version: 1,
      actions: [{
        id: "implementation",
        description: "Implementation",
        agentId: "developer-agent"
      }],
      outputRoutes: [],
      humanGateResponses: [],
      loops: [{ id: "plan-approved.loop", steps: ["implementation"] }],
      runtimes: []
    }, null, 2), "utf8");

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);

    try {
      const allowed = await fetch(url + "/api/events/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "project", eventType: "plan-approved", source: "test", payload: {} })
      });
      expect(allowed.status).toBe(201);
      expect(await allowed.json()).toMatchObject({ eventType: "plan-approved" });

      const blocked = await fetch(url + "/api/events/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "project", eventType: "unknown.event.v1", source: "test", payload: {} })
      });
      expect(blocked.status).toBe(400);
      expect(await blocked.json()).toMatchObject({ error: "Unknown or inactive event type: unknown.event.v1" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("saves automation through /api/automation and rejects legacy config CRUD", async () => {
    const root = await tempRoot();
    process.env.BALLET_PROJECT_ROOT = root;
    process.env.BALLET_DB_PATH = path.join(root, "runtime.sqlite");
    await mkdir(path.join(root, ".codex/agents"), { recursive: true });
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    await writeFile(path.join(root, ".codex/agents/developer-agent.toml"), "name = \"Developer Agent\"\ndeveloper_instructions = \"Do work.\"\n", "utf8");
    await writeFile(path.join(root, ".ballet/project.md"), "---\nid: project\nname: Project\n---\n\nProject body.", "utf8");

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);

    const loopId = "project-brief-gate.approved.loop";
    const loopStartActionId = "implementation";
    const loopEvent = "project-brief-gate.approved";
    const config = {
      version: 1,
      actions: [{
        id: loopStartActionId,
        description: "Implementation",
        agentId: "developer-agent"
      }],
      outputRoutes: [],
      humanGateResponses: [],
      loops: [{ id: loopId, steps: [loopStartActionId] }],
      runtimes: [{ id: "codex-runtime", title: "Codex runtime", command: "codex", args: [] }]
    };

    try {
      const saved = await fetch(url + "/api/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      expect(saved.status).toBe(200);
      const savedBody = await saved.json();
      expect(savedBody).toMatchObject({
        actions: [
          expect.objectContaining({ id: loopStartActionId, agentId: "developer-agent" })
        ],
        loops: [{ id: loopId, steps: [loopStartActionId] }]
      });
      expect(savedBody).not.toHaveProperty("triggers");
      expect(savedBody).not.toHaveProperty("policies");

      const automation = await fetch(url + "/api/automation");
      expect(automation.status).toBe(200);
      const automationBody = await automation.json() as { config: Record<string, unknown> };
      expect(automationBody.config).not.toHaveProperty("events");
      expect(automationBody.config).not.toHaveProperty("triggers");
      expect(automationBody.config).not.toHaveProperty("policies");
      expect(automationBody.config).toHaveProperty("humanGateResponses");
      expect(automationBody.config).not.toHaveProperty("gates");
      expect(automationBody.config).not.toHaveProperty("gateDecisions");
      expect(automationBody).toMatchObject({
        config: {
          actions: [
            expect.objectContaining({ id: loopStartActionId, agentId: "developer-agent" })
          ]
        },
        issues: []
      });

      const legacyPolicy = await fetch(url + "/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "legacy" })
      });
      expect(legacyPolicy.status).toBe(404);

      const invalid = await fetch(url + "/api/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, loops: [{ id: "legacy", steps: [{ policy: "assign-developer", on: "task.created" }] }] })
      });
      expect(invalid.status).toBe(400);

      const legacyTriggers = await fetch(url + "/api/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, triggers: [{ id: "manual_start", description: "Manual start" }] })
      });
      expect(legacyTriggers.status).toBe(400);
      const legacyTriggerPolicy = await fetch(url + "/api/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          policies: [{ id: "legacy-start", source: "trigger", trigger: loopEvent, action: "implementation", enabled: true }]
        })
      });
      expect(legacyTriggerPolicy.status).toBe(400);
      expect(await invalid.json()).toMatchObject({ error: "Request validation failed.", issues: expect.arrayContaining([expect.objectContaining({ path: "loops.0.steps.0" })]) });
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
