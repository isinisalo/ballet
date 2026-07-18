// The route factory is intentionally the one HTTP composition point; domain
// decisions remain in injected services and every request body is Zod-validated.
import { readFile } from "node:fs/promises";
import express from "express";
import { z } from "zod";
import {
  agentExecutionParamsSchema,
  agentRuntimeConfigurationBodySchema,
  emptyBodySchema,
  executionTaskParamsSchema,
  executionEventsQuerySchema,
  respondToRunStepBodySchema,
  rootRunParamsSchema,
  stepRunParamsSchema,
  startRunBodySchema
} from "../../shared/api/runtime-schemas.js";
import {
  automationConfigSchema,
  collectionItemParamsSchema,
  collectionParamsSchema,
  collectionUpsertSchema,
  loopThemeSchema,
  projectDocumentCreateSchema,
  projectDocumentSaveSchema,
  type MutableCollectionName
} from "../../shared/api/workspace-schemas.js";
import type { RootRunListQuery } from "../../shared/domain/runs.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import { readProjectConfigStatus } from "../project/configGitStatus.js";
import type { LocalRunService } from "../runs/LocalRunService.js";
import type { WorkspaceInvalidationBroadcaster } from "../runs/WorkspaceInvalidationBroadcaster.js";
import type { MarkdownStore } from "../store.js";
import { HttpValidationError, parseBody, parseParams, parseUnknown } from "./validation/httpValidation.js";

export interface ApiRouterOptions {
  store: MarkdownStore;
  runtime: LocalRuntimeService;
  configurations: RuntimeConfigurationService;
  executions: ExecutionStore;
  runs: LocalRunService;
  invalidations: WorkspaceInvalidationBroadcaster;
  logsPath: string;
}

const runListQuery = z.object({
  state: z.enum(["active", "recent"]).optional(), kind: z.enum(["agent", "loop"]).optional(),
  cursor: z.string().max(1000).optional(), limit: z.coerce.number().int().min(1).max(200).optional()
}).strict();

export const createApiRouter = (options: ApiRouterOptions): express.Router => {
  const router = express.Router();
  router.get("/data", route(async (_req, res) => res.json(await options.store.read())));
  router.put("/automation", route(async (req, res) => {
    const config = parseBody(automationConfigSchema, req);
    const saved = await options.store.saveAutomation(config);
    options.invalidations.publish("workspace-changed", { reason: "automation" });
    res.json(saved);
  }));
  router.put("/loop-theme", route(async (req, res) => {
    res.json(await options.store.updateLoopTheme(parseBody(loopThemeSchema, req)));
    options.invalidations.publish("workspace-changed", { reason: "loop-theme" });
  }));
  router.post("/project-documents", route(async (req, res) => {
    res.json(await options.store.saveProjectDocument(parseBody(projectDocumentSaveSchema, req)));
    options.invalidations.publish("workspace-changed", { reason: "document" });
  }));
  router.post("/project-documents/create", route(async (req, res) => {
    res.status(201).json(await options.store.createProjectDocument(parseBody(projectDocumentCreateSchema, req)));
    options.invalidations.publish("workspace-changed", { reason: "document" });
  }));
  router.get("/project/config-status", route(async (_req, res) => res.json(await readProjectConfigStatus(options.store.root))));

  router.post("/runtime/refresh", route(async (req, res) => {
    parseBody(emptyBodySchema, req);
    res.json(await options.runtime.refresh());
  }));
  router.get("/runtime/logs", route(async (_req, res) => res.json({
    path: options.logsPath,
    content: (await readFile(options.logsPath, "utf8").catch(() => "")).slice(-256 * 1024)
  })));
  router.put("/agents/:agentId/runtime", route(async (req, res) => {
    const { agentId } = parseParams(agentExecutionParamsSchema, req);
    res.json(await options.configurations.put(agentId, parseBody(agentRuntimeConfigurationBodySchema, req)));
    options.invalidations.publish("workspace-changed", { reason: "runtime-configuration" });
  }));
  router.delete("/agents/:agentId/runtime", route(async (req, res) => {
    const { agentId } = parseParams(agentExecutionParamsSchema, req); await options.configurations.remove(agentId);
    options.invalidations.publish("workspace-changed", { reason: "runtime-configuration" }); res.status(204).end();
  }));

  router.post("/runs", route(async (req, res) => res.status(201).json(await options.runs.start(parseBody(startRunBodySchema, req)))));
  router.get("/runs", route(async (req, res) => res.json(options.runs.list(parseUnknown(runListQuery, req.query) as RootRunListQuery))));
  router.get("/runs/:rootRunId", route(async (req, res) => {
    const { rootRunId } = parseParams(rootRunParamsSchema, req); const detail = options.runs.detail(rootRunId);
    if (!detail) throw new HttpValidationError(`Root Run ${rootRunId} was not found.`, [], 404); res.json(detail);
  }));
  router.post("/runs/:rootRunId/cancel", route(async (req, res) => {
    const { rootRunId } = parseParams(rootRunParamsSchema, req);
    parseBody(emptyBodySchema, req);
    res.json(await options.runs.cancel(rootRunId));
  }));
  router.post("/runs/:rootRunId/steps/:stepRunId/respond", route(async (req, res) => {
    const { rootRunId, stepRunId } = parseParams(stepRunParamsSchema, req);
    const input = parseBody(respondToRunStepBodySchema, req);
    res.json(await options.runs.respond(rootRunId, stepRunId, input));
  }));
  router.get("/execution-tasks/:taskId/events", route(async (req, res) => {
    const { taskId } = parseParams(executionTaskParamsSchema, req); const query = parseUnknown(executionEventsQuerySchema, req.query);
    res.json(options.executions.events(taskId, query.after, query.limit));
  }));
  router.get("/execution-tasks/:taskId/console/stream", (req, res, next) => {
    try { streamConsole(req, res, options.executions); } catch (error) { next(error); }
  });
  router.get("/stream", (req, res) => streamInvalidations(req, res, options.invalidations));

  router.get("/:collection", route(async (req, res) => {
    const { collection: rawCollection } = parseParams(collectionParamsSchema, req);
    const collection = requireCollection(rawCollection); res.json(await options.store.list(collection));
  }));
  router.post("/:collection", route(async (req, res) => {
    const { collection: rawCollection } = parseParams(collectionParamsSchema, req);
    const collection = requireCollection(rawCollection);
    const body = parseBody(collectionUpsertSchema(collection), req);
    res.status(body.id ? 200 : 201).json(await options.store.upsert(collection, body));
    options.invalidations.publish("workspace-changed", { reason: collection });
  }));
  router.delete("/:collection/:id", route(async (req, res) => {
    const { collection: rawCollection, id } = parseParams(collectionItemParamsSchema, req);
    const collection = requireCollection(rawCollection);
    await options.store.remove(collection, id); options.invalidations.publish("workspace-changed", { reason: collection }); res.status(204).end();
  }));

  return router;
};

const route = (handler: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler =>
  (req, res, next) => { void handler(req, res).catch(next); };
const requireCollection = (value: string): MutableCollectionName => {
  if (value !== "agents" && value !== "skills") throw new HttpValidationError("Unknown collection.", [], 404);
  return value;
};

const streamConsole = (req: express.Request, res: express.Response, store: ExecutionStore): void => {
  const { taskId } = parseParams(executionTaskParamsSchema, req);
  let cursor = Number(req.get("last-event-id") ?? req.query.after ?? 0) || 0;
  let taskVersion = "";
  store.require(taskId);
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
  const flush = () => {
    const page = store.events(taskId, cursor, 500);
    for (const event of page.entries) {
      cursor = event.id; res.write(`id: ${event.id}\nevent: console\ndata: ${JSON.stringify(event)}\n\n`);
    }
    const task = store.require(taskId);
    const nextTaskVersion = `${task.status}\0${task.updatedAt}`;
    if (nextTaskVersion !== taskVersion) {
      taskVersion = nextTaskVersion;
      res.write(`event: task\ndata: ${JSON.stringify(task)}\n\n`);
    }
  };
  flush();
  const timer = setInterval(flush, 500); timer.unref();
  req.once("close", () => clearInterval(timer));
};

const streamInvalidations = (req: express.Request, res: express.Response, broadcaster: WorkspaceInvalidationBroadcaster): void => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
  const last = Number(req.get("last-event-id") ?? 0) || 0;
  const replay = broadcaster.replay(last);
  const send = (event: { id: number; type: string }) => {
    res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };
  if (replay.reset) res.write(`event: workspace-changed\ndata: {"reason":"reconnected"}\n\n`);
  else replay.events.forEach(send);
  const unsubscribe = broadcaster.subscribe(send);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000); heartbeat.unref();
  req.once("close", () => { clearInterval(heartbeat); unsubscribe(); });
};
