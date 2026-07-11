import type express from "express";
import { AutomationValidationError } from "../store.js";
import {
  LoopRunConflictError,
  LoopRunNotFoundError,
  LoopRunStateError
} from "../runtime/LoopRunErrors.js";
import { HttpValidationError } from "./validation/httpValidation.js";

export const sendKnownHttpError = (error: unknown, res: express.Response): boolean => {
  if (error instanceof HttpValidationError) {
    res.status(error.status).json({ error: error.message, issues: error.issues });
    return true;
  }
  if (error instanceof AutomationValidationError) {
    res.status(400).json({ error: error.message, issues: error.issues });
    return true;
  }
  if (error instanceof LoopRunNotFoundError) {
    res.status(404).json({ error: error.message });
    return true;
  }
  if (error instanceof LoopRunConflictError) {
    res.status(409).json({ error: error.message });
    return true;
  }
  if (error instanceof LoopRunStateError) {
    res.status(400).json({ error: error.message });
    return true;
  }
  return false;
};
