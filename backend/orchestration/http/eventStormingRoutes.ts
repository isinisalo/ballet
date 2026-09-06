import type express from "express";
import { emptySchema } from "../../../shared/orchestration/httpContracts.js";
import { putEventStormingSchema } from "../../../shared/orchestration/eventStorming.js";
import { putEventStormingLayoutSchema } from "../../../shared/orchestration/eventStormingLayout.js";
import { stormContextQuerySchema } from "../../../shared/orchestration/eventStormingContext.js";
import { parseBody, parseUnknown } from "../../http/validation/httpValidation.js";
import type { ApiController } from "./ApiController.js";

export function registerEventStormingRoutes(router: express.Router, controller: ApiController): void {
  router.get("/event-storming", (req, res) => {
    parseUnknown(emptySchema, req.query); res.json(controller.authoring.eventStorming());
  });
  router.put("/event-storming", (req, res) => {
    parseUnknown(emptySchema, req.query);
    const { value, expectedHash } = parseBody(putEventStormingSchema, req);
    res.json(controller.authoring.saveEventStorming(value, expectedHash));
  });
  router.get("/event-storming/layout", (req, res) => {
    parseUnknown(emptySchema, req.query); res.json(controller.authoring.eventStormingLayout());
  });
  router.put("/event-storming/layout", (req, res) => {
    parseUnknown(emptySchema, req.query);
    const { value, expectedHash } = parseBody(putEventStormingLayoutSchema, req);
    res.json(controller.authoring.saveEventStormingLayout(value, expectedHash));
  });
  router.get("/event-storming/context", (req, res) => {
    res.json(controller.authoring.eventStormingContext(parseUnknown(stormContextQuerySchema, req.query)));
  });
}
