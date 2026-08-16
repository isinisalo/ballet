import type { LoopModuleIssue } from "../../shared/domain/loopModules.js";

export class LoopModuleValidationError extends Error {
  constructor(message: string, readonly issues: LoopModuleIssue[]) {
    super(message);
    this.name = "LoopModuleValidationError";
  }
}

export class LoopModuleConflictError extends Error {
  constructor(message: string, readonly issues: LoopModuleIssue[] = []) {
    super(message);
    this.name = "LoopModuleConflictError";
  }
}

export class LoopModuleNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoopModuleNotFoundError";
  }
}
