export class ExecutionTaskNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionTaskNotFoundError";
  }
}
