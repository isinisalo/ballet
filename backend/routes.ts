import express from "express";
import type { CollectionName } from "./shared/domain.js";
import { EventValidationError, store } from "./store.js";
import { onRuntimeChanged } from "./runtime-events.js";

const collections: CollectionName[] = [
  "projects",
  "goals",
  "adrs",
  "agents",
  "skills",
  "runtimes",
  "contracts",
  "operations",
  "policies",
  "emissionPolicies",
  "loopDefinitions"
];
const collectionSet = new Set(collections);

export const apiRouter = express.Router();

const handleEventValidationError = (error: unknown, res: express.Response): boolean => {
  if (error instanceof EventValidationError) {
    res.status(400).json({ error: error.message, details: error.details });
    return true;
  }
  return false;
};

const optionalVersionQuery = (value: unknown): number | undefined => {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new EventValidationError("version must be a positive integer.");
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new EventValidationError("version must be a positive integer.");
  }
  return parsed;
};

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true });
});

apiRouter.get("/data", async (_req, res, next) => {
  try {
    res.json(await store.read());
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/workspace/validation", async (_req, res, next) => {
  try {
    res.json(await store.validateWorkspace());
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/workspace/safe-delete", async (req, res, next) => {
  try {
    const { type, id, version, label } = req.body as Record<string, unknown>;
    if (typeof type !== "string" || typeof id !== "string" || typeof label !== "string") {
      return res.status(400).json({ error: "type, id, and label are required." });
    }
    res.json(await store.safeDelete({
      type: type as never,
      id,
      version: typeof version === "number" ? version : undefined,
      label
    }));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/flows", async (_req, res, next) => {
  try {
    res.json(await store.listFlows());
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/flows/:id", async (req, res, next) => {
  try {
    const flow = await store.getFlow(req.params.id, optionalVersionQuery(req.query.version));
    if (!flow) return res.status(404).json({ error: "Flow not found." });
    res.json(flow);
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});

apiRouter.post("/flows/validate", async (req, res, next) => {
  try {
    res.json(await store.validateFlowDraft(req.body));
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});

apiRouter.post("/flows", async (req, res, next) => {
  try {
    res.status(201).json(await store.saveFlowDraft(req.body));
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});

apiRouter.put("/flows/:id", async (req, res, next) => {
  try {
    res.json(await store.updateFlowSettings(req.params.id, req.body, optionalVersionQuery(req.query.version)));
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});

apiRouter.post("/flows/:id/test", async (req, res, next) => {
  try {
    res.json(await store.testFlow(req.params.id, req.body?.payload, optionalVersionQuery(req.query.version)));
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});

apiRouter.post("/flows/:id/activate", async (req, res, next) => {
  try {
    res.json(await store.setFlowActive(req.params.id, true, optionalVersionQuery(req.query.version)));
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});

apiRouter.post("/flows/:id/pause", async (req, res, next) => {
  try {
    res.json(await store.setFlowActive(req.params.id, false, optionalVersionQuery(req.query.version)));
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});

apiRouter.post("/reset", async (_req, res, next) => {
  try {
    res.json(await store.reset());
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/project-documents", async (req, res, next) => {
  try {
    const { relativePath, frontmatter, body } = req.body as {
      relativePath?: unknown;
      frontmatter?: unknown;
      body?: unknown;
    };

    if (typeof relativePath !== "string" || !frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter) || typeof body !== "string") {
      return res.status(400).json({ error: "relativePath, frontmatter object, and body are required." });
    }

    res.json(await store.saveProjectDocument({
      relativePath,
      frontmatter: frontmatter as Record<string, unknown>,
      body
    }));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/runtime/health", (_req, res, next) => {
  try {
    res.json(store.runtimeHealth());
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/runtime/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  const send = (type: string, payload: Record<string, unknown>) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send("ready", { ok: true, at: new Date().toISOString() });
  const unsubscribe = onRuntimeChanged((signal) => send("change", { signal, at: new Date().toISOString() }));
  const heartbeat = setInterval(() => send("heartbeat", { at: new Date().toISOString() }), 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

apiRouter.get("/events", async (_req, res, next) => {
  try {
    res.json(await store.list("events"));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/event-definitions", async (_req, res, next) => {
  try {
    res.json(await store.listEventDefinitions());
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/event-definitions", async (req, res, next) => {
  try {
    const saved = await store.saveEventDefinition(req.body);
    res.status(req.body.id ? 200 : 201).json(saved);
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});

apiRouter.delete("/event-definitions/:id", async (req, res, next) => {
  try {
    await store.removeEventDefinition(req.params.id);
    res.status(204).end();
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});

apiRouter.get("/agent-runs", (_req, res, next) => {
  try {
    res.json(store.listAgentRuns());
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/agent-runs/:id/logs", (req, res, next) => {
  try {
    res.json(store.listRunLogs(req.params.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/traces/correlation/:id", (req, res, next) => {
  try {
    res.json(store.traceService().byCorrelation(req.params.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/traces/loops/:id", (req, res, next) => {
  try {
    res.json(store.traceService().byLoop(req.params.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/traces/runs/:id", (req, res, next) => {
  try {
    res.json(store.traceService().byRun(req.params.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/loop-instances", (_req, res, next) => {
  try {
    res.json(store.listLoopInstances());
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/agent-runs/:id/retry", (req, res, next) => {
  try {
    res.json(store.retryAgentRun(req.params.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/routing-policies/:id/dry-run", async (req, res, next) => {
  try {
    res.json(await store.dryRunRoutingPolicy(req.params.id, req.body));
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});

apiRouter.post("/emission-policies/:id/dry-run", async (req, res, next) => {
  try {
    res.json(await store.dryRunEmissionPolicy(req.params.id, req.body));
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});

apiRouter.get("/:collection", async (req, res, next) => {
  try {
    const collection = req.params.collection as CollectionName;
    if (!collectionSet.has(collection)) return res.status(404).json({ error: "Unknown collection." });
    res.json(await store.list(collection));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/events/intake", async (req, res, next) => {
  try {
    const { projectId, eventType } = req.body;
    if (!projectId || !eventType) {
      return res.status(400).json({ error: "projectId and eventType are required." });
    }

    const event = await store.createEvent(req.body);
    res.status(201).json(event);
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});

apiRouter.delete("/events/:id", async (req, res, next) => {
  try {
    await store.remove("events", req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/:collection", async (req, res, next) => {
  try {
    const collection = req.params.collection as CollectionName;
    if (!collectionSet.has(collection)) {
      return res.status(404).json({ error: "Unknown mutable collection." });
    }

    const saved = await store.upsert(collection, req.body);
    res.status(req.body.id ? 200 : 201).json(saved);
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});

apiRouter.delete("/:collection/:id", async (req, res, next) => {
  try {
    const collection = req.params.collection as CollectionName;
    if (!collectionSet.has(collection)) return res.status(404).json({ error: "Unknown collection." });
    await store.remove(collection, req.params.id, optionalVersionQuery(req.query.version));
    res.status(204).end();
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
    next(error);
  }
});
