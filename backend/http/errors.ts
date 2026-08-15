import type express from "express";
import { AutomationConflictError, AutomationValidationError } from "../automation.js";
import { ExecutionTaskNotFoundError } from "../execution/ExecutionErrors.js";
import { ExecutionCompositionError } from "../execution/ExecutionCompositionError.js";
import {
  MarkdownEntityConflictError,
  MarkdownEntityNotFoundError,
  MarkdownEntityValidationError
} from "../documents/MarkdownEntityErrors.js";
import { ProjectConfigurationSourceError } from "../project-config/ProjectConfigurationRepository.js";
import {
  ExecutionProfileConflictError,
  ExecutionProfileNotFoundError
} from "../project-config/ExecutionProfileErrors.js";
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
  if (error instanceof ExecutionCompositionError) {
    res.status(400).json({
      error: error.message,
      issues: [{
        code: error.code === "resource_too_large" ? "invalid_resource" : error.code,
        message: error.message
      }]
    });
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
  if (isConflictError(error)) {
    res.status(409).json({
      error: error.message,
      ...(error instanceof ProjectConfigurationSourceError ? { issues: error.issues } : {})
    });
    return true;
  }
  if (isNotFoundError(error)) {
    res.status(404).json({ error: error.message });
    return true;
  }
  if (error instanceof LoopRunStateError) {
    res.status(400).json({ error: error.message });
    return true;
  }
  return false;
};

const isConflictError = (error: unknown): error is Error =>
  error instanceof AutomationConflictError
  || error instanceof ExecutionProfileConflictError
  || error instanceof LoopThemeConflictError
  || error instanceof LoopRunConflictError
  || error instanceof MarkdownEntityConflictError
  || error instanceof ProjectConfigurationSourceError;

const isNotFoundError = (error: unknown): error is Error =>
  error instanceof LoopRunNotFoundError
  || error instanceof ExecutionProfileNotFoundError
  || error instanceof ExecutionTaskNotFoundError
  || error instanceof MarkdownEntityNotFoundError;

const isBodyParserError = (error: unknown, status: number, type: string): boolean =>
  error instanceof Error
  && "status" in error
  && "type" in error
  && (error as Error & { status: unknown }).status === status
  && (error as Error & { type: unknown }).type === type;
