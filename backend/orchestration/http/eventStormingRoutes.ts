import type express from "express";
import { emptySchema } from "../../../shared/orchestration/httpContracts.js";
import { putEventStormingSchema } from "../../../shared/orchestration/eventStorming.js";
import { parseBody, parseUnknown } from "../../http/validation/httpValidation.js";
import type { ApiController } from "./ApiController.js";

export function registerEventStormingRoutes(router: express.Router, controller: ApiController): void {
  router.get("/event-storming", (req, res) => {
    parseUnknown(emptySchema, req.query); res.json(controller.eventStorming());
  });
  router.put("/event-storming", (req, res) => {
    parseUnknown(emptySchema, req.query);
    const { value, expectedHash } = parseBody(putEventStormingSchema, req);
    res.json(controller.saveEventStorming(value, expectedHash));
  });
}
