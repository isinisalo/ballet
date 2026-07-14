import type express from "express";
import { AutomationConflictError, AutomationValidationError } from "../automation.js";
import { ExecutionTaskNotFoundError } from "../execution/ExecutionErrors.js";
import {
  MarkdownEntityConflictError,
  MarkdownEntityNotFoundError,
  MarkdownEntityValidationError
} from "../documents/MarkdownEntityErrors.js";
import { ProjectConfigurationSourceError } from "../project-config/ProjectConfigurationRepository.js";
import {
  LoopRunConflictError,
  LoopRunNotFoundError,
  LoopRunStateError
} from "../runtime/LoopRunErrors.js";
import { HttpValidationError } from "./validation/httpValidation.js";
import {
  LoopThemeConflictError,
  LoopThemeValidationError
} from "../loop-themes/LoopThemeErrors.js";

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
  if (error instanceof AutomationValidationError) {
    res.status(400).json({ error: error.message, issues: error.issues });
    return true;
  }
  if (error instanceof LoopThemeValidationError) {
    res.status(400).json({ error: error.message, issues: error.issues });
    return true;
  }
  if (error instanceof MarkdownEntityValidationError) {
    res.status(400).json({ error: error.message });
    return true;
  }
  if (error instanceof AutomationConflictError
    || error instanceof LoopThemeConflictError
    || error instanceof LoopRunConflictError
    || error instanceof MarkdownEntityConflictError
    || error instanceof ProjectConfigurationSourceError) {
    res.status(409).json({
      error: error.message,
      ...(error instanceof ProjectConfigurationSourceError ? { issues: error.issues } : {})
    });
    return true;
  }
  if (error instanceof LoopRunNotFoundError
    || error instanceof ExecutionTaskNotFoundError
    || error instanceof MarkdownEntityNotFoundError) {
    res.status(404).json({ error: error.message });
    return true;
  }
  if (error instanceof LoopRunStateError) {
    res.status(400).json({ error: error.message });
    return true;
  }
  return false;
};

const isBodyParserError = (error: unknown, status: number, type: string): boolean =>
  error instanceof Error
  && "status" in error
  && "type" in error
  && (error as Error & { status: unknown }).status === status
  && (error as Error & { type: unknown }).type === type;
