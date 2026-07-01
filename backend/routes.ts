import express from "express";
import { onRuntimeChanged } from "./runtime-events.js";
import { sendKnownHttpError } from "./http/errors.js";
import {
  validateAutomationConfig,
  validateCollectionName,
  validateEventIntake,
  validateMutableItem,
  validateProjectDocumentCreate,
  validateProjectDocumentSave
} from "./http/validation/requestValidators.js";
import { workspaceService } from "./services/workspaceService.js";

export const apiRouter = express.Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true });
});

apiRouter.get("/data", async (_req, res, next) => {
  try {
    res.json(await workspaceService.readData());
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/reset", async (_req, res, next) => {
  try {
    res.json(await workspaceService.resetData());
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/automation", async (_req, res, next) => {
  try {
    res.json(await workspaceService.readAutomation());
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/automation", async (req, res, next) => {
  try {
    res.json(await workspaceService.saveAutomation(validateAutomationConfig(req.body)));
  } catch (error) {
    if (sendKnownHttpError(error, res)) return;
    next(error);
  }
});

apiRouter.post("/project-documents", async (req, res, next) => {
  try {
    res.json(await workspaceService.saveProjectDocument(validateProjectDocumentSave(req.body)));
  } catch (error) {
    if (sendKnownHttpError(error, res)) return;
    next(error);
  }
});

apiRouter.post("/project-documents/create", async (req, res, next) => {
  try {
    res.status(201).json(await workspaceService.createProjectDocument(validateProjectDocumentCreate(req.body)));
  } catch (error) {
    if (sendKnownHttpError(error, res)) return;
    next(error);
  }
});

apiRouter.get("/runtime/health", (_req, res, next) => {
  try {
    res.json(workspaceService.runtimeHealth());
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
    res.json(await workspaceService.listEvents());
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/agent-runs", (_req, res, next) => {
  try {
    res.json(workspaceService.listAgentRuns());
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/agent-runs/:id/logs", (req, res, next) => {
  try {
    res.json(workspaceService.listRunLogs(req.params.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/agent-runs/:id/retry", (req, res, next) => {
  try {
    res.json(workspaceService.retryAgentRun(req.params.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/:collection", async (req, res, next) => {
  try {
    const collection = validateCollectionName(req.params.collection);
    res.json(await workspaceService.listCollection(collection));
  } catch (error) {
    if (sendKnownHttpError(error, res)) return;
    next(error);
  }
});

apiRouter.post("/events/intake", async (req, res, next) => {
  try {
    const event = await workspaceService.createEvent(validateEventIntake(req.body));
    res.status(201).json(event);
  } catch (error) {
    if (sendKnownHttpError(error, res)) return;
    next(error);
  }
});

apiRouter.delete("/events/:id", async (req, res, next) => {
  try {
    await workspaceService.removeEvent(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/:collection", async (req, res, next) => {
  try {
    const collection = validateCollectionName(req.params.collection);
    const item = validateMutableItem(req.body);
    const saved = await workspaceService.saveCollectionItem(collection, item);
    res.status(req.body.id ? 200 : 201).json(saved);
  } catch (error) {
    if (sendKnownHttpError(error, res)) return;
    next(error);
  }
});

apiRouter.delete("/:collection/:id", async (req, res, next) => {
  try {
    const collection = validateCollectionName(req.params.collection);
    await workspaceService.removeCollectionItem(collection, req.params.id);
    res.status(204).end();
  } catch (error) {
    if (sendKnownHttpError(error, res)) return;
    next(error);
  }
});
