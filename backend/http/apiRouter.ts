import express from "express";
import { sendKnownHttpError } from "./errors.js";
import * as automationHandlers from "./handlers/automationHandlers.js";
import * as eventHandlers from "./handlers/eventHandlers.js";
import * as loopRunHandlers from "./handlers/loopRunHandlers.js";
import * as loopThemeHandlers from "./handlers/loopThemeHandlers.js";
import * as projectHandlers from "./handlers/projectHandlers.js";
import * as runtimeHandlers from "./handlers/runtimeHandlers.js";
import * as workspaceHandlers from "./handlers/workspaceHandlers.js";

export const apiRouter = express.Router();

apiRouter.get("/health", workspaceHandlers.health);
apiRouter.get("/data", workspaceHandlers.getData);
apiRouter.post("/reset", workspaceHandlers.resetData);

apiRouter.get("/automation", automationHandlers.getAutomation);
apiRouter.put("/automation", automationHandlers.saveAutomation);

apiRouter.put("/loop-themes/:themeId", loopThemeHandlers.updateLoopTheme);
apiRouter.post("/loop-themes", loopThemeHandlers.createLoopTheme);

apiRouter.post("/project-documents", workspaceHandlers.saveProjectDocument);
apiRouter.post("/project-documents/create", workspaceHandlers.createProjectDocument);
apiRouter.get("/project/config-status", projectHandlers.configStatus);

apiRouter.get("/runtime/health", runtimeHandlers.runtimeHealth);
apiRouter.get("/runtime/stream", runtimeHandlers.runtimeStream);

apiRouter.get("/events", eventHandlers.listEvents);
apiRouter.post("/events/intake", eventHandlers.intakeEvent);
apiRouter.delete("/events/:id", eventHandlers.removeEvent);

apiRouter.post("/loops/:loopId/runs", loopRunHandlers.startLoopRun);
apiRouter.get("/loops/:loopId/runs/latest", loopRunHandlers.latestLoopRun);
apiRouter.post("/loop-runs/:runId/steps/:stepRunId/respond", loopRunHandlers.respondToStepRun);
apiRouter.post("/loop-runs/:runId/cancel", loopRunHandlers.cancelLoopRun);

apiRouter.get("/:collection", workspaceHandlers.listCollection);
apiRouter.post("/:collection", workspaceHandlers.saveCollectionItem);
apiRouter.delete("/:collection/:id", workspaceHandlers.removeCollectionItem);

apiRouter.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (sendKnownHttpError(error, res)) return;
  next(error);
});
