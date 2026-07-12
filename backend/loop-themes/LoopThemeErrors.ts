import type { LoopThemeIssue } from "../../shared/domain/loopThemes.js";

export class LoopThemeValidationError extends Error {
  constructor(
    message: string,
    readonly issues: LoopThemeIssue[]
  ) {
    super(message);
    this.name = "LoopThemeValidationError";
  }
}

export class LoopThemeNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoopThemeNotFoundError";
  }
}

export class LoopThemeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoopThemeConflictError";
  }
}
