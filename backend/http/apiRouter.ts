import express from "express";
import { sendKnownHttpError } from "./errors.js";
import * as automationHandlers from "./handlers/automationHandlers.js";
import * as eventHandlers from "./handlers/eventHandlers.js";
import * as runtimeHandlers from "./handlers/runtimeHandlers.js";
import * as workspaceHandlers from "./handlers/workspaceHandlers.js";

export const apiRouter = express.Router();

apiRouter.get("/health", workspaceHandlers.health);
apiRouter.get("/data", workspaceHandlers.getData);
apiRouter.post("/reset", workspaceHandlers.resetData);

apiRouter.get("/automation", automationHandlers.getAutomation);
apiRouter.put("/automation", automationHandlers.saveAutomation);

apiRouter.post("/project-documents", workspaceHandlers.saveProjectDocument);
apiRouter.post("/project-documents/create", workspaceHandlers.createProjectDocument);

apiRouter.get("/runtime/health", runtimeHandlers.runtimeHealth);
apiRouter.get("/runtime/stream", runtimeHandlers.runtimeStream);

apiRouter.get("/events", eventHandlers.listEvents);
apiRouter.post("/events/intake", eventHandlers.intakeEvent);
apiRouter.delete("/events/:id", eventHandlers.removeEvent);

apiRouter.get("/agent-runs", runtimeHandlers.listAgentRuns);
apiRouter.get("/agent-runs/:id/logs", runtimeHandlers.listRunLogs);
apiRouter.post("/agent-runs/:id/retry", runtimeHandlers.retryAgentRun);

apiRouter.get("/:collection", workspaceHandlers.listCollection);
apiRouter.post("/:collection", workspaceHandlers.saveCollectionItem);
apiRouter.delete("/:collection/:id", workspaceHandlers.removeCollectionItem);

apiRouter.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (sendKnownHttpError(error, res)) return;
  next(error);
});
