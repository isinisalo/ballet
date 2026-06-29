import express from "express";
import type { CollectionName, ProjectAutomationConfig } from "./shared/domain.js";
import { AutomationValidationError, EventValidationError, store } from "./store.js";
import { onRuntimeChanged } from "./runtime-events.js";

const collections: CollectionName[] = ["projects", "goals", "adrs", "agents", "skills"];
const collectionSet = new Set(collections);

export const apiRouter = express.Router();

const handleEventValidationError = (error: unknown, res: express.Response): boolean => {
  if (error instanceof EventValidationError) {
    res.status(400).json({ error: error.message });
    return true;
  }
  if (error instanceof AutomationValidationError) {
    res.status(400).json({ error: error.message, issues: error.issues });
    return true;
  }
  return false;
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

apiRouter.post("/reset", async (_req, res, next) => {
  try {
    res.json(await store.reset());
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/automation", async (_req, res, next) => {
  try {
    const data = await store.read();
    res.json({ config: data.automation, issues: data.automationIssues });
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/automation", async (req, res, next) => {
  try {
    res.json(await store.saveAutomation(req.body as ProjectAutomationConfig));
  } catch (error) {
    if (handleEventValidationError(error, res)) return;
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

apiRouter.post("/project-documents/create", async (req, res, next) => {
  try {
    const { directoryPath, title } = req.body as {
      directoryPath?: unknown;
      title?: unknown;
    };

    if (typeof directoryPath !== "string" || typeof title !== "string") {
      return res.status(400).json({ error: "directoryPath and title are required." });
    }

    res.status(201).json(await store.createProjectDocument({ directoryPath, title }));
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

apiRouter.post("/agent-runs/:id/retry", (req, res, next) => {
  try {
    res.json(store.retryAgentRun(req.params.id));
  } catch (error) {
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
    await store.remove(collection, req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
