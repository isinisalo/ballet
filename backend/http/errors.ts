import type express from "express";
import {
  ConflictError,
  NotFoundError,
  RuntimeSchemaVersionError
} from "../orchestration/persistence/PersistenceErrors.js";
import { HttpValidationError } from "./validation/httpValidation.js";

export const sendKnownHttpError = (error: unknown, res: express.Response): boolean => {
  if (isBodyParserError(error, 400, "entity.parse.failed")) {
    res.status(400).json({ error: "Request body contains invalid JSON." });
    return true;
  }
  if (isBodyParserError(error, 413, "entity.too.large")) {
    res.status(413).json({ error: "Request body is too large." });
    return true;
  }
  if (error instanceof HttpValidationError) {
    res.status(error.status).json({ error: error.message, issues: error.issues });
    return true;
  }
  if (error instanceof RuntimeSchemaVersionError || error instanceof ConflictError) {
    res.status(409).json({ error: error.message });
    return true;
  }
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
    return true;
  }
  return false;
};

const isBodyParserError = (error: unknown, status: number, type: string): boolean =>
  error instanceof Error && "status" in error && "type" in error
  && (error as Error & { status: unknown }).status === status
  && (error as Error & { type: unknown }).type === type;
