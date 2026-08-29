export class NotFoundError extends Error {
  override readonly name: string = "NotFoundError";
}

export class ConflictError extends Error {
  override readonly name: string = "ConflictError";
}

export class StaleStateError extends ConflictError {
  override readonly name: string = "StaleStateError";
}

export class InvalidTransitionError extends ConflictError {
  override readonly name: string = "InvalidTransitionError";
}

export class RuntimeSchemaVersionError extends Error {
  override readonly name: string = "RuntimeSchemaVersionError";
}
