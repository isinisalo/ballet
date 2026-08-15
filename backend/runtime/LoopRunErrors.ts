export class LoopRunNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoopRunNotFoundError";
  }
}

export class LoopRunConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoopRunConflictError";
  }
}

export class LoopRunStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoopRunStateError";
  }
}

export const workLoopRuntimeUnavailableMessage =
  "Strict-v10 Work Loop runtime is not implemented in this phase; execution is disabled.";

export class WorkLoopRuntimeUnavailableError extends LoopRunStateError {
  constructor() {
    super(workLoopRuntimeUnavailableMessage);
    this.name = "WorkLoopRuntimeUnavailableError";
  }
}

export class LoopRunIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoopRunIntegrityError";
  }
}
