import type { RequestHandler } from "express";
import { store } from "../../store.js";
import { eventIntakeSchema, eventParamsSchema } from "../validation/schemas.js";
import { parseBody, parseParams } from "../validation/httpValidation.js";

export const listEvents: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await store.list("events"));
  } catch (error) {
    next(error);
  }
};

export const intakeEvent: RequestHandler = async (req, res, next) => {
  try {
    const event = await store.createEvent(parseBody(eventIntakeSchema, req));
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
};

export const removeEvent: RequestHandler = async (req, res, next) => {
  try {
    const { id } = parseParams(eventParamsSchema, req);
    await store.remove("events", id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
