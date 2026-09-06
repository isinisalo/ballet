import type { TrustedHumanActor } from "../../../shared/orchestration/persistence.js";
import type express from "express";
import { emptySchema, removeResourceSchema } from "../../../shared/orchestration/httpContracts.js";
import { userStoryApprovalSchema, updateUserStorySchema, userStoryInputSchema, userStoryParamsSchema } from "../../../shared/orchestration/userStories.js";
import { parseBody, parseParams, parseUnknown } from "../../http/validation/httpValidation.js";
import type { ApiController } from "./ApiController.js";

export function registerUserStoryRoutes(router: express.Router, controller: ApiController, actor: () => TrustedHumanActor): void {
  router.get("/user-stories", (req, res) => {
    parseUnknown(emptySchema, req.query); res.json(controller.authoring.userStories());
  });
  router.post("/user-stories", (req, res) => {
    parseUnknown(emptySchema, req.query);
    res.status(201).json(controller.authoring.createUserStory(parseBody(userStoryInputSchema, req)));
  });
  router.get("/user-stories/:id", (req, res) => {
    parseUnknown(emptySchema, req.query);
    res.json(controller.authoring.userStory(parseParams(userStoryParamsSchema, req).id));
  });
  router.put("/user-stories/:id", (req, res) => {
    parseUnknown(emptySchema, req.query);
    const { id } = parseParams(userStoryParamsSchema, req);
    const { value, expectedHash } = parseBody(updateUserStorySchema, req);
    res.json(controller.authoring.updateUserStory(id, value, expectedHash));
  });
  router.post("/user-stories/:id/approve", (req, res) => {
    parseUnknown(emptySchema, req.query);
    const { id } = parseParams(userStoryParamsSchema, req);
    const input = parseBody(userStoryApprovalSchema, req);
    res.json(controller.authoring.approveUserStory(id, input.expectedHash, input.expectedContentHash, actor()));
  });
  router.post("/user-stories/:id/return-to-draft", (req, res) => {
    parseUnknown(emptySchema, req.query);
    const { id } = parseParams(userStoryParamsSchema, req);
    res.json(controller.authoring.returnStoryToDraft(id, parseBody(removeResourceSchema, req).expectedHash));
  });
  router.delete("/user-stories/:id", (req, res) => {
    parseUnknown(emptySchema, req.query);
    const { id } = parseParams(userStoryParamsSchema, req);
    controller.authoring.removeUserStory(id, parseBody(removeResourceSchema, req).expectedHash);
    res.status(204).end();
  });
}
