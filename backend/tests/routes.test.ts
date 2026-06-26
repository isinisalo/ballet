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
import type { TraceViewModel } from "../shared/flow.js";

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

  it("exposes workspace safe-delete checks", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const safeDelete = vi.spyOn(store, "safeDelete").mockResolvedValue({
      allowed: false,
      references: [{ type: "event", id: "plan-approved", label: "Plan approved" }],
      diagnostics: [{
        severity: "error",
        title: "Resource is still in use",
        explanation: "Plan approved data is referenced by Plan approved.",
        resource: { type: "event", id: "plan-approved", label: "Plan approved" },
        suggestedFix: "Remove the reference first."
      }]
    });
    const { server, url } = await listen(app);

    try {
      const response = await fetch(`${url}/api/workspace/safe-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "contract",
          id: "plan-approved-data",
          version: 1,
          label: "Plan approved data"
        })
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        allowed: false,
        references: [{ type: "event", id: "plan-approved", label: "Plan approved" }]
      });
      expect(safeDelete).toHaveBeenCalledWith({
        type: "contract",
        id: "plan-approved-data",
        version: 1,
        label: "Plan approved data"
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("requires a version when deleting versioned resources", async () => {
    const root = await tempRoot();
    process.env.BALLET_PROJECT_ROOT = root;
    process.env.BALLET_DB_PATH = path.join(root, "runtime.sqlite");
    await mkdir(path.join(root, ".ballet/contracts"), { recursive: true });
    await writeFile(path.join(root, ".ballet/contracts/shared-shape.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: ContractDefinition\nmetadata:\n  id: shared-shape\n  version: 1\nspec:\n  name: Shared shape v1\n  description: Version one.\n  kind: event-data\n  active: true\n  schema:\n    type: object\n    additionalProperties: true\n  examples: []\n---\n\nVersion one.", "utf8");
    await writeFile(path.join(root, ".ballet/contracts/shared-shape.v2.md"), "---\napiVersion: ballet.dev/v1\nkind: ContractDefinition\nmetadata:\n  id: shared-shape\n  version: 2\nspec:\n  name: Shared shape v2\n  description: Version two.\n  kind: event-data\n  active: true\n  schema:\n    type: object\n    additionalProperties: true\n  examples: []\n---\n\nVersion two.", "utf8");

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);

    try {
      const ambiguousResponse = await fetch(`${url}/api/contracts/shared-shape`, { method: "DELETE" });
      expect(ambiguousResponse.status).toBe(400);
      expect(await ambiguousResponse.json()).toMatchObject({
        error: "Deleting contracts requires both id and version."
      });

      const deleteResponse = await fetch(`${url}/api/contracts/shared-shape?version=2`, { method: "DELETE" });
      expect(deleteResponse.status).toBe(204);

      const listResponse = await fetch(`${url}/api/contracts`);
      expect(listResponse.status).toBe(200);
      const contracts = await listResponse.json() as Array<{ id: string; version: number }>;
      expect(contracts.filter((contract) => contract.id === "shared-shape").map((contract) => contract.version)).toEqual([1]);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("uses Flow version when multiple LoopDefinition versions share an id", async () => {
    const root = await tempRoot();
    process.env.BALLET_PROJECT_ROOT = root;
    process.env.BALLET_DB_PATH = path.join(root, "runtime.sqlite");
    await mkdir(path.join(root, ".ballet/loops"), { recursive: true });
    await writeFile(path.join(root, ".ballet/loops/fulfillment.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: LoopDefinition\nmetadata:\n  id: fulfillment\n  version: 1\nspec:\n  name: Fulfillment v1\n  description: First fulfillment Flow.\n  active: false\n  entryEventTypes: []\n  terminalEventTypes: []\n  routingPolicyIds: []\n  emissionPolicyIds: []\n  limits:\n    maxHops: 10\n    maxRuns: 10\n    maxIterationsPerStep: 3\n---\n\nFulfillment v1.", "utf8");
    await writeFile(path.join(root, ".ballet/loops/fulfillment.v2.md"), "---\napiVersion: ballet.dev/v1\nkind: LoopDefinition\nmetadata:\n  id: fulfillment\n  version: 2\nspec:\n  name: Fulfillment v2\n  description: Second fulfillment Flow.\n  active: false\n  entryEventTypes: []\n  terminalEventTypes: []\n  routingPolicyIds: []\n  emissionPolicyIds: []\n  limits:\n    maxHops: 20\n    maxRuns: 20\n    maxIterationsPerStep: 3\n---\n\nFulfillment v2.", "utf8");

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);

    try {
      const ambiguousResponse = await fetch(`${url}/api/flows/fulfillment`);
      expect(ambiguousResponse.status).toBe(400);
      expect(await ambiguousResponse.json()).toMatchObject({
        error: "Flow fulfillment has multiple versions. Specify version."
      });

      const versionedResponse = await fetch(`${url}/api/flows/fulfillment?version=2`);
      expect(versionedResponse.status).toBe(200);
      expect(await versionedResponse.json()).toMatchObject({
        id: "fulfillment",
        version: 2,
        name: "Fulfillment v2"
      });

      const activateResponse = await fetch(`${url}/api/flows/fulfillment/activate?version=2`, { method: "POST" });
      expect(activateResponse.status).toBe(200);
      expect(await activateResponse.json()).toMatchObject({
        id: "fulfillment",
        version: 2,
        active: true
      });

      const listResponse = await fetch(`${url}/api/flows`);
      expect(listResponse.status).toBe(200);
      const flows = await listResponse.json() as Array<{ id: string; version: number; active: boolean }>;
      expect(flows.filter((flow) => flow.id === "fulfillment").map((flow) => [flow.version, flow.active])).toEqual([
        [1, false],
        [2, true]
      ]);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("requires loopDefinitionVersion when intaking into an ambiguous loop id", async () => {
    const root = await tempRoot();
    process.env.BALLET_PROJECT_ROOT = root;
    process.env.BALLET_DB_PATH = path.join(root, "runtime.sqlite");
    await mkdir(path.join(root, ".ballet/contracts"), { recursive: true });
    await mkdir(path.join(root, ".ballet/events"), { recursive: true });
    await mkdir(path.join(root, ".ballet/loops"), { recursive: true });
    await writeFile(path.join(root, ".ballet/contracts/start-data.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: ContractDefinition\nmetadata:\n  id: start-data\n  version: 1\nspec:\n  name: Start data\n  description: Start data.\n  kind: event-data\n  active: true\n  schema:\n    type: object\n    additionalProperties: true\n  examples: []\n---\n\nStart data.", "utf8");
    await writeFile(path.join(root, ".ballet/events/start-v1.md"), "---\napiVersion: ballet.dev/v1\nkind: EventDefinition\nmetadata:\n  id: start-v1\nspec:\n  name: Work started\n  active: true\n  eventType: work.started.v1\n  dataContract:\n    id: start-data\n    version: 1\n---\n\nStart event.", "utf8");
    await writeFile(path.join(root, ".ballet/loops/fulfillment.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: LoopDefinition\nmetadata:\n  id: fulfillment\n  version: 1\nspec:\n  name: Fulfillment v1\n  description: First fulfillment Flow.\n  active: true\n  entryEventTypes:\n    - work.started.v1\n  terminalEventTypes: []\n  routingPolicyIds: []\n  emissionPolicyIds: []\n  limits:\n    maxHops: 10\n    maxRuns: 10\n    maxIterationsPerStep: 3\n---\n\nFulfillment v1.", "utf8");
    await writeFile(path.join(root, ".ballet/loops/fulfillment.v2.md"), "---\napiVersion: ballet.dev/v1\nkind: LoopDefinition\nmetadata:\n  id: fulfillment\n  version: 2\nspec:\n  name: Fulfillment v2\n  description: Second fulfillment Flow.\n  active: true\n  entryEventTypes:\n    - work.started.v1\n  terminalEventTypes: []\n  routingPolicyIds: []\n  emissionPolicyIds: []\n  limits:\n    maxHops: 20\n    maxRuns: 20\n    maxIterationsPerStep: 3\n---\n\nFulfillment v2.", "utf8");

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);

    try {
      const ambiguousResponse = await fetch(`${url}/api/events/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "project",
          eventType: "work.started.v1",
          source: "test",
          payload: {},
          loopDefinitionId: "fulfillment"
        })
      });
      expect(ambiguousResponse.status).toBe(400);
      expect(await ambiguousResponse.json()).toMatchObject({
        error: "Loop definition fulfillment has multiple active versions. Specify loopDefinitionVersion."
      });

      const versionedResponse = await fetch(`${url}/api/events/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "project",
          eventType: "work.started.v1",
          source: "test",
          payload: {},
          loopDefinitionId: "fulfillment",
          loopDefinitionVersion: 2
        })
      });
      expect(versionedResponse.status).toBe(201);

      const instancesResponse = await fetch(`${url}/api/loop-instances`);
      expect(instancesResponse.status).toBe(200);
      expect(await instancesResponse.json()).toMatchObject([{
        loopDefinitionId: "fulfillment",
        loopDefinitionVersion: 2
      }]);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("serves runtime health, agent runs, logs, retry, and traces", async () => {
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
    const runTrace: TraceViewModel = { scope: "run", id: "run-1", entries: [] };
    const loopTrace: TraceViewModel = { scope: "loop", id: "loop-1", entries: [] };
    const correlationTrace: TraceViewModel = { scope: "correlation", id: "corr-1", entries: [] };
    const traceService = {
      byRun: vi.fn().mockReturnValue(runTrace),
      byLoop: vi.fn().mockReturnValue(loopTrace),
      byCorrelation: vi.fn().mockReturnValue(correlationTrace)
    };
    vi.spyOn(store, "runtimeHealth").mockReturnValue({ ok: true, sqliteVersion: "3.53.2" });
    vi.spyOn(store, "listAgentRuns").mockReturnValue([run]);
    vi.spyOn(store, "listRunLogs").mockReturnValue([log]);
    vi.spyOn(store, "retryAgentRun").mockReturnValue({ ...run, status: "queued", error: undefined });
    vi.spyOn(store, "traceService").mockReturnValue(traceService as unknown as ReturnType<typeof store.traceService>);
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

      const runTraceResponse = await fetch(`${url}/api/traces/runs/run-1`);
      expect(runTraceResponse.status).toBe(200);
      expect(await runTraceResponse.json()).toEqual(runTrace);
      expect(traceService.byRun).toHaveBeenCalledWith("run-1");

      const loopTraceResponse = await fetch(`${url}/api/traces/loops/loop-1`);
      expect(loopTraceResponse.status).toBe(200);
      expect(await loopTraceResponse.json()).toEqual(loopTrace);
      expect(traceService.byLoop).toHaveBeenCalledWith("loop-1");

      const correlationTraceResponse = await fetch(`${url}/api/traces/correlation/corr-1`);
      expect(correlationTraceResponse.status).toBe(200);
      expect(await correlationTraceResponse.json()).toEqual(correlationTrace);
      expect(traceService.byCorrelation).toHaveBeenCalledWith("corr-1");
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
    await writeFile(path.join(root, ".ballet/contracts/plan-approved-data.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: ContractDefinition\nmetadata:\n  id: plan-approved-data\n  version: 1\nspec:\n  name: Plan approved data\n  description: Plan approved data.\n  kind: event-data\n  active: true\n  schema:\n    type: object\n    additionalProperties: true\n  examples:\n    - {}\n---\n\nContract.", "utf8");
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

  it("blocks event intake when the loaded workspace has validation errors", async () => {
    const root = await tempRoot();
    process.env.BALLET_PROJECT_ROOT = root;
    process.env.BALLET_DB_PATH = path.join(root, "runtime.sqlite");
    await mkdir(path.join(root, ".ballet/contracts"), { recursive: true });
    await mkdir(path.join(root, ".ballet/events"), { recursive: true });
    await mkdir(path.join(root, ".ballet/loops"), { recursive: true });
    await writeFile(path.join(root, ".ballet/project.md"), "---\nid: project\nname: Project\n---\n\nProject body.", "utf8");
    await writeFile(path.join(root, ".ballet/contracts/start-data.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: ContractDefinition\nmetadata:\n  id: start-data\n  version: 1\nspec:\n  name: Start data\n  description: Start data.\n  kind: event-data\n  active: true\n  schema:\n    type: object\n    additionalProperties: true\n  examples: []\n---\n\nStart data.", "utf8");
    await writeFile(path.join(root, ".ballet/events/start-v1.md"), "---\napiVersion: ballet.dev/v1\nkind: EventDefinition\nmetadata:\n  id: start-v1\nspec:\n  name: Work started\n  active: true\n  eventType: work.started.v1\n  dataContract:\n    id: start-data\n    version: 1\n---\n\nStart event.", "utf8");
    await writeFile(path.join(root, ".ballet/loops/delivery.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: LoopDefinition\nmetadata:\n  id: delivery\n  version: 1\nspec:\n  name: Delivery\n  description: Delivery Flow.\n  active: true\n  entryEventTypes:\n    - work.started.v1\n  terminalEventTypes: []\n  routingPolicyIds: []\n  emissionPolicyIds: []\n  limits:\n    maxHops: -1\n    maxRuns: 10\n    maxIterationsPerStep: 3\n---\n\nDelivery Flow.", "utf8");

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);

    try {
      const response = await fetch(`${url}/api/events/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "project",
          eventType: "work.started.v1",
          source: "test",
          payload: {}
        })
      });

      expect(response.status).toBe(400);
      const body = await response.json() as { error: string; details?: Array<{ title: string }> };
      expect(body.error).toBe("Cannot intake event because the workspace has validation errors.");
      expect(body.details?.map((detail) => detail.title)).toEqual(expect.arrayContaining([
        "Invalid Flow safety limit"
      ]));
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("rejects policies that do not handle active event catalog types", async () => {
    const root = await tempRoot();
    process.env.BALLET_PROJECT_ROOT = root;
    process.env.BALLET_DB_PATH = path.join(root, "runtime.sqlite");
    await mkdir(path.join(root, ".codex/agents"), { recursive: true });
    await mkdir(path.join(root, ".ballet/contracts"), { recursive: true });
    await mkdir(path.join(root, ".ballet/events"), { recursive: true });
    await mkdir(path.join(root, ".ballet/operations"), { recursive: true });
    await mkdir(path.join(root, ".ballet/policies"), { recursive: true });
    await writeFile(path.join(root, ".ballet/project.md"), "---\nid: project\nname: Project\n---\n\nProject body.", "utf8");
    await writeFile(path.join(root, ".codex/agents/developer-agent.toml"), `name = "Developer Agent"
description = "Implements approved changes."
developer_instructions = "Implement the requested change."
enabled = true
status = "offline"
`, "utf8");
    await writeFile(path.join(root, ".ballet/contracts/plan-approved-data.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: ContractDefinition\nmetadata:\n  id: plan-approved-data\n  version: 1\nspec:\n  name: Plan approved data\n  description: Plan approved data.\n  kind: event-data\n  active: true\n  schema:\n    type: object\n    additionalProperties: true\n  examples: []\n---\n\nPlan approved data.", "utf8");
    await writeFile(path.join(root, ".ballet/contracts/implement-change-input.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: ContractDefinition\nmetadata:\n  id: implement-change-input\n  version: 1\nspec:\n  name: Implement change input\n  description: Implement input.\n  kind: agent-input\n  active: true\n  schema:\n    type: object\n    additionalProperties: true\n  examples: []\n---\n\nInput.", "utf8");
    await writeFile(path.join(root, ".ballet/contracts/implement-change-output.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: ContractDefinition\nmetadata:\n  id: implement-change-output\n  version: 1\nspec:\n  name: Implement change output\n  description: Implement output.\n  kind: agent-output\n  active: true\n  schema:\n    type: object\n    additionalProperties: false\n    required:\n      - status\n      - summary\n    properties:\n      status:\n        type: string\n        enum:\n          - completed\n          - blocked\n          - needs_input\n          - failed\n      summary:\n        type: string\n      result:\n        type: object\n        additionalProperties: true\n      evidence:\n        type: object\n        additionalProperties: true\n  examples: []\n---\n\nOutput.", "utf8");
    await writeFile(path.join(root, ".ballet/operations/developer-agent-implement-change.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: AgentOperation\nmetadata:\n  id: developer-agent/implement-change\n  version: 1\nspec:\n  name: Implement change\n  description: Implement approved plans.\n  active: true\n  agentId: developer-agent\n  instructions: Implement approved plans.\n  inputContract:\n    id: implement-change-input\n    version: 1\n  outputContract:\n    id: implement-change-output\n    version: 1\n  emissionRequired: false\n---\n\nImplement approved plans.", "utf8");
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

  it("protects event definitions that are emitted or used as Flow terminal events", async () => {
    const root = await tempRoot();
    process.env.BALLET_PROJECT_ROOT = root;
    process.env.BALLET_DB_PATH = path.join(root, "runtime.sqlite");
    await mkdir(path.join(root, ".codex/agents"), { recursive: true });
    await mkdir(path.join(root, ".ballet/contracts"), { recursive: true });
    await mkdir(path.join(root, ".ballet/events"), { recursive: true });
    await mkdir(path.join(root, ".ballet/operations"), { recursive: true });
    await mkdir(path.join(root, ".ballet/emissions"), { recursive: true });
    await mkdir(path.join(root, ".ballet/loops"), { recursive: true });
    await writeFile(path.join(root, ".ballet/project.md"), "---\nid: project\nname: Project\n---\n\nProject body.", "utf8");
    await writeFile(path.join(root, ".codex/agents/developer-agent.toml"), `name = "Developer Agent"
description = "Implements approved changes."
developer_instructions = "Implement the requested change."
enabled = true
status = "offline"
`, "utf8");
    await writeFile(path.join(root, ".ballet/contracts/start-data.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: ContractDefinition\nmetadata:\n  id: start-data\n  version: 1\nspec:\n  name: Start data\n  description: Start data.\n  kind: event-data\n  active: true\n  schema:\n    type: object\n    additionalProperties: true\n  examples: []\n---\n\nStart data.", "utf8");
    await writeFile(path.join(root, ".ballet/contracts/done-data.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: ContractDefinition\nmetadata:\n  id: done-data\n  version: 1\nspec:\n  name: Done data\n  description: Done data.\n  kind: event-data\n  active: true\n  schema:\n    type: object\n    additionalProperties: true\n  examples: []\n---\n\nDone data.", "utf8");
    await writeFile(path.join(root, ".ballet/contracts/task-input.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: ContractDefinition\nmetadata:\n  id: task-input\n  version: 1\nspec:\n  name: Task input\n  description: Task input.\n  kind: agent-input\n  active: true\n  schema:\n    type: object\n    additionalProperties: true\n  examples: []\n---\n\nInput.", "utf8");
    await writeFile(path.join(root, ".ballet/contracts/task-output.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: ContractDefinition\nmetadata:\n  id: task-output\n  version: 1\nspec:\n  name: Task output\n  description: Task output.\n  kind: agent-output\n  active: true\n  schema:\n    type: object\n    additionalProperties: false\n    required:\n      - status\n      - summary\n    properties:\n      status:\n        type: string\n        enum:\n          - completed\n          - blocked\n          - needs_input\n          - failed\n      summary:\n        type: string\n      result:\n        type: object\n        additionalProperties: true\n      evidence:\n        type: object\n        additionalProperties: true\n  examples: []\n---\n\nOutput.", "utf8");
    await writeFile(path.join(root, ".ballet/operations/developer-agent-implement-change.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: AgentOperation\nmetadata:\n  id: developer-agent/implement-change\n  version: 1\nspec:\n  name: Implement change\n  description: Implement approved plans.\n  active: true\n  agentId: developer-agent\n  instructions: Implement approved plans.\n  inputContract:\n    id: task-input\n    version: 1\n  outputContract:\n    id: task-output\n    version: 1\n  emissionRequired: true\n---\n\nImplement approved plans.", "utf8");
    await writeFile(path.join(root, ".ballet/events/start-v1.md"), "---\napiVersion: ballet.dev/v1\nkind: EventDefinition\nmetadata:\n  id: start-v1\nspec:\n  name: Work started\n  active: true\n  eventType: work.started.v1\n  dataContract:\n    id: start-data\n    version: 1\n---\n\nStart event.", "utf8");
    await writeFile(path.join(root, ".ballet/events/done-v1.md"), "---\napiVersion: ballet.dev/v1\nkind: EventDefinition\nmetadata:\n  id: done-v1\nspec:\n  name: Work done\n  active: true\n  eventType: work.done.v1\n  dataContract:\n    id: done-data\n    version: 1\n---\n\nDone event.", "utf8");
    await writeFile(path.join(root, ".ballet/emissions/emit-done.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: EmissionPolicy\nmetadata:\n  id: emit-done\n  version: 1\nspec:\n  name: Emit done\n  description: Publish completion.\n  active: true\n  observes:\n    operation:\n      id: developer-agent/implement-change\n      version: 1\n  emissions:\n    - slot: done\n      eventType: work.done.v1\n      data:\n        object: {}\n---\n\nEmit done.", "utf8");
    await writeFile(path.join(root, ".ballet/loops/delivery.v1.md"), "---\napiVersion: ballet.dev/v1\nkind: LoopDefinition\nmetadata:\n  id: delivery\n  version: 1\nspec:\n  name: Delivery\n  description: Delivery Flow.\n  active: true\n  entryEventTypes:\n    - work.started.v1\n  terminalEventTypes:\n    - work.done.v1\n  routingPolicyIds: []\n  emissionPolicyIds:\n    - emit-done\n  limits:\n    maxHops: 10\n    maxRuns: 10\n    maxIterationsPerStep: 3\n---\n\nDelivery Flow.", "utf8");

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);

    try {
      const deactivate = await fetch(`${url}/api/event-definitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "done-v1",
          name: "Work done",
          description: "Done event.",
          active: false,
          eventType: "work.done.v1",
          dataContract: { id: "done-data", version: 1 },
          examples: []
        })
      });
      expect(deactivate.status).toBe(400);
      const deactivateBody = await deactivate.json() as { details?: Array<{ title: string }> };
      expect(deactivateBody.details?.map((detail) => detail.title)).toEqual(expect.arrayContaining([
        "Missing emitted event",
        "Missing Flow event"
      ]));

      const deleteResponse = await fetch(`${url}/api/event-definitions/done-v1`, { method: "DELETE" });
      expect(deleteResponse.status).toBe(400);
      const deleteBody = await deleteResponse.json() as { details?: Array<{ resource: { type: string } }> };
      expect(deleteBody.details?.map((detail) => detail.resource.type)).toEqual(expect.arrayContaining([
        "emission-policy",
        "loop"
      ]));
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
