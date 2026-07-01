import type { RequestHandler } from "express";
import { workspaceService } from "../../services/workspaceService.js";
import { eventIntakeSchema, eventParamsSchema } from "../validation/eventSchemas.js";
import { parseBody, parseParams } from "../validation/httpValidation.js";

export const listEvents: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await workspaceService.listEvents());
  } catch (error) {
    next(error);
  }
};

export const intakeEvent: RequestHandler = async (req, res, next) => {
  try {
    const event = await workspaceService.createEvent(parseBody(eventIntakeSchema, req));
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
};

export const removeEvent: RequestHandler = async (req, res, next) => {
  try {
    const { id } = parseParams(eventParamsSchema, req);
    await workspaceService.removeEvent(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
