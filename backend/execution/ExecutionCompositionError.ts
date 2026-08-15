export class ExecutionCompositionError extends Error {
  constructor(
    readonly code: "invalid_resource" | "missing_resource" | "resource_too_large" | "prompt_too_large",
    message: string
  ) {
    super(message);
    this.name = "ExecutionCompositionError";
  }
}
