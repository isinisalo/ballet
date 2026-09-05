import type express from "express";
import { emptySchema, removeResourceSchema } from "../../../shared/orchestration/httpContracts.js";
import { updateUserStorySchema, userStoryInputSchema, userStoryParamsSchema } from "../../../shared/orchestration/userStories.js";
import { parseBody, parseParams, parseUnknown } from "../../http/validation/httpValidation.js";
import type { ApiController } from "./ApiController.js";

export function registerUserStoryRoutes(router: express.Router, controller: ApiController): void {
  router.get("/user-stories", (req, res) => {
    parseUnknown(emptySchema, req.query); res.json(controller.userStories());
  });
  router.post("/user-stories", (req, res) => {
    parseUnknown(emptySchema, req.query);
    res.status(201).json(controller.createUserStory(parseBody(userStoryInputSchema, req)));
  });
  router.get("/user-stories/:id", (req, res) => {
    parseUnknown(emptySchema, req.query);
    res.json(controller.userStory(parseParams(userStoryParamsSchema, req).id));
  });
  router.put("/user-stories/:id", (req, res) => {
    parseUnknown(emptySchema, req.query);
    const { id } = parseParams(userStoryParamsSchema, req);
    const { value, expectedHash } = parseBody(updateUserStorySchema, req);
    res.json(controller.updateUserStory(id, value, expectedHash));
  });
  router.delete("/user-stories/:id", (req, res) => {
    parseUnknown(emptySchema, req.query);
    const { id } = parseParams(userStoryParamsSchema, req);
    controller.removeUserStory(id, parseBody(removeResourceSchema, req).expectedHash);
    res.status(204).end();
  });
}
