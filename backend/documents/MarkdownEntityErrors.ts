export class MarkdownEntityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarkdownEntityValidationError";
  }
}

export class MarkdownEntityNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarkdownEntityNotFoundError";
  }
}

export class MarkdownEntityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarkdownEntityConflictError";
  }
}
