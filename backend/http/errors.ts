import type express from "express";
import { AutomationConflictError, AutomationValidationError } from "../automation.js";
import { CanvasThemeConflictError, CanvasThemeValidationError } from "../canvas-themes/CanvasThemeErrors.js";
import {
  MarkdownEntityConflictError, MarkdownEntityNotFoundError, MarkdownEntityValidationError
} from "../documents/MarkdownEntityErrors.js";
import { ExecutionCompositionError } from "../execution/ExecutionCompositionError.js";
import { ExecutionTaskNotFoundError } from "../execution/ExecutionErrors.js";
import { GraphNodeModuleError } from "../graph-node-modules/GraphNodeModuleService.js";
import { ExecutionProfileConflictError, ExecutionProfileNotFoundError } from "../project-config/ExecutionProfileErrors.js";
import { ProjectConfigurationSourceError } from "../project-config/ProjectConfigurationRepository.js";
import { GraphRunConflictError, GraphRunNotFoundError, GraphRunStateError } from "../runtime/GraphRunErrors.js";
import { HttpValidationError } from "./validation/httpValidation.js";

export const sendKnownHttpError = (error: unknown, res: express.Response): boolean => {
  if (isBodyParserError(error, 400, "entity.parse.failed")) {
    res.status(400).json({ error: "Request body contains invalid JSON." }); return true;
  }
  if (isBodyParserError(error, 413, "entity.too.large")) {
    res.status(413).json({ error: "Request body is too large." }); return true;
  }
  if (error instanceof HttpValidationError) {
    res.status(error.status).json({ error: error.message, issues: error.issues }); return true;
  }
  if (error instanceof AutomationValidationError || error instanceof CanvasThemeValidationError) {
    res.status(400).json({ error: error.message, issues: error.issues }); return true;
  }
  if (error instanceof GraphNodeModuleError) {
    const status = error.issues.some(({ code }) => code === "ACTIVE_RUN" || code === "PLAN_STALE") ? 409
      : error.issues.some(({ code }) => code === "MODULE_NOT_INSTALLED" || code === "GRAPH_NODE_NOT_FOUND") ? 404 : 400;
    res.status(status).json({ error: error.message, issues: error.issues }); return true;
  }
  if (error instanceof ExecutionCompositionError) {
    res.status(400).json({ error: error.message, issues: [{ code: error.code, message: error.message }] });
    return true;
  }
  if (error instanceof MarkdownEntityValidationError || error instanceof GraphRunStateError) {
    res.status(400).json({ error: error.message }); return true;
  }
  if (isConflict(error)) {
    res.status(409).json({
      error: error.message,
      ...(error instanceof ProjectConfigurationSourceError ? { issues: error.issues } : {})
    });
    return true;
  }
  if (isNotFound(error)) {
    res.status(404).json({ error: error.message }); return true;
  }
  return false;
};

const isConflict = (error: unknown): error is Error =>
  error instanceof AutomationConflictError || error instanceof CanvasThemeConflictError
  || error instanceof ExecutionProfileConflictError || error instanceof GraphRunConflictError
  || error instanceof MarkdownEntityConflictError || error instanceof ProjectConfigurationSourceError;
const isNotFound = (error: unknown): error is Error =>
  error instanceof GraphRunNotFoundError || error instanceof ExecutionProfileNotFoundError
  || error instanceof ExecutionTaskNotFoundError || error instanceof MarkdownEntityNotFoundError;
const isBodyParserError = (error: unknown, status: number, type: string): boolean =>
  error instanceof Error && "status" in error && "type" in error
  && (error as Error & { status: unknown }).status === status
  && (error as Error & { type: unknown }).type === type;
