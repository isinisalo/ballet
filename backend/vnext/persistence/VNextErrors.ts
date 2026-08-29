export class VNextNotFoundError extends Error {
  override readonly name: string = "VNextNotFoundError";
}

export class VNextConflictError extends Error {
  override readonly name: string = "VNextConflictError";
}

export class VNextStaleStateError extends VNextConflictError {
  override readonly name: string = "VNextStaleStateError";
}

export class VNextInvalidTransitionError extends VNextConflictError {
  override readonly name: string = "VNextInvalidTransitionError";
}

export class VNextSchemaVersionError extends Error {
  override readonly name: string = "VNextSchemaVersionError";
}
