import type { CanvasThemeIssue } from "../../shared/domain/canvasTheme.js";

export class CanvasThemeValidationError extends Error {
  constructor(
    message: string,
    readonly issues: CanvasThemeIssue[]
  ) {
    super(message);
    this.name = "CanvasThemeValidationError";
  }
}

export class CanvasThemeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasThemeConflictError";
  }
}
