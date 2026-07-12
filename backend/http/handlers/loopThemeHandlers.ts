import type { RequestHandler } from "express";
import { store } from "../../store.js";
import {
  createLoopThemeSchema,
  loopThemeParamsSchema,
  loopThemeSchema
} from "../validation/schemas.js";
import { parseBody, parseParams } from "../validation/httpValidation.js";

export const updateLoopTheme: RequestHandler = async (req, res, next) => {
  try {
    const { themeId } = parseParams(loopThemeParamsSchema, req);
    const theme = parseBody(loopThemeSchema, req);
    res.json(await store.updateLoopTheme(themeId, theme));
  } catch (error) {
    next(error);
  }
};

export const createLoopTheme: RequestHandler = async (req, res, next) => {
  try {
    const input = parseBody(createLoopThemeSchema, req);
    res.status(201).json(await store.createLoopTheme(input));
  } catch (error) {
    next(error);
  }
};
