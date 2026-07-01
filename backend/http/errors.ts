import type express from "express";
import { AutomationValidationError, EventValidationError } from "../store.js";
import { HttpValidationError } from "./validation/httpValidation.js";

export const sendKnownHttpError = (error: unknown, res: express.Response): boolean => {
  if (error instanceof HttpValidationError) {
    res.status(error.status).json({ error: error.message, issues: error.issues });
    return true;
  }
  if (error instanceof EventValidationError) {
    res.status(400).json({ error: error.message });
    return true;
  }
  if (error instanceof AutomationValidationError) {
    res.status(400).json({ error: error.message, issues: error.issues });
    return true;
  }
  return false;
};
