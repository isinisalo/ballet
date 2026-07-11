import express from "express";
import { createDaemonRouter } from "./DaemonRoutes.js";
import { controlPlaneErrorHandler } from "./HttpSupport.js";
import type { ControlPlaneRouterOptions } from "./types.js";
import { createUiRouter } from "./UiRoutes.js";

export const createControlPlaneRouter = (options: ControlPlaneRouterOptions): express.Router => {
  const router = express.Router();
  router.use(createDaemonRouter(options));
  router.use(createUiRouter(options));
  router.use(controlPlaneErrorHandler);
  return router;
};

