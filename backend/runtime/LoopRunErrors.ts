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
