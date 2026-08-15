export class ExecutionProfileConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionProfileConflictError";
  }
}

export class ExecutionProfileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionProfileNotFoundError";
  }
}
