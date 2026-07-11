import type { RequestHandler } from "express";
import { store } from "../../store.js";
import {
  loopParamsSchema,
  loopRunParamsSchema,
  respondToStepRunSchema,
  startLoopRunSchema,
  stepRunParamsSchema
} from "../validation/schemas.js";
import { parseBody, parseParams } from "../validation/httpValidation.js";

export const startLoopRun: RequestHandler = async (req, res, next) => {
  try {
    const { loopId } = parseParams(loopParamsSchema, req);
    const { input } = parseBody(startLoopRunSchema, req);
    res.status(201).json(await store.startLoopRun(loopId, input));
  } catch (error) {
    next(error);
  }
};

export const latestLoopRun: RequestHandler = async (req, res, next) => {
  try {
    const { loopId } = parseParams(loopParamsSchema, req);
    res.json(await store.latestLoopRun(loopId));
  } catch (error) {
    next(error);
  }
};

export const respondToStepRun: RequestHandler = async (req, res, next) => {
  try {
    const { runId, stepRunId } = parseParams(stepRunParamsSchema, req);
    const { result, input } = parseBody(respondToStepRunSchema, req);
    res.json(await store.respondToStepRun(runId, stepRunId, result, input));
  } catch (error) {
    next(error);
  }
};

export const cancelLoopRun: RequestHandler = async (req, res, next) => {
  try {
    const { runId } = parseParams(loopRunParamsSchema, req);
    res.json(await store.cancelLoopRun(runId));
  } catch (error) {
    next(error);
  }
};
