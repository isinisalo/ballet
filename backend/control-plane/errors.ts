export class ControlPlaneValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControlPlaneValidationError";
  }
}

export class ControlPlaneUnauthorizedError extends Error {
  constructor(message = "Unauthorized.") {
    super(message);
    this.name = "ControlPlaneUnauthorizedError";
  }
}

export class ControlPlaneForbiddenError extends Error {
  constructor(message = "Forbidden.") {
    super(message);
    this.name = "ControlPlaneForbiddenError";
  }
}

export class ControlPlaneNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControlPlaneNotFoundError";
  }
}

export class ControlPlaneGoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControlPlaneGoneError";
  }
}

export class ControlPlaneRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControlPlaneRateLimitError";
  }
}

export class ControlPlaneConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControlPlaneConflictError";
  }
}

export class ControlPlanePreflightError extends ControlPlaneConflictError {
  constructor(
    message: string,
    readonly issues: import("../../shared/domain/runtime.js").RuntimePreflightIssue[]
  ) {
    super(message);
    this.name = "ControlPlanePreflightError";
  }
}

export class ControlPlaneFencingError extends ControlPlaneConflictError {
  constructor(message = "The task lease is stale.") {
    super(message);
    this.name = "ControlPlaneFencingError";
  }
}
