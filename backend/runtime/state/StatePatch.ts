import { maxProjectStateBytes, type JsonValue } from "../../../shared/domain/automation.js";
import {
  maxRuntimeJsonDepth,
  maxStatePatchBytes,
  maxStatePatchOperations,
  type JsonPatchOperation,
  type StatePatch
} from "../../../shared/domain/runtime.js";
import { assertJsonValue, canonicalJson, jsonSha256 } from "./CanonicalJson.js";

const forbiddenSegments = new Set(["__proto__", "prototype", "constructor"]);

export class StatePatchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatePatchValidationError";
  }
}

export interface AppliedStatePatch {
  state: JsonValue;
  stateJson: string;
  stateSha256: string;
  patch: StatePatch;
  patchJson: string;
  patchSha256: string;
}

export const validateState = (state: unknown): JsonValue => {
  try {
    assertJsonValue(state, {
      label: "Loop state",
      maxBytes: maxProjectStateBytes,
      maxDepth: maxRuntimeJsonDepth
    });
    return state;
  } catch (error) {
    throw wrap(error);
  }
};

export const validateStatePatch = (input: unknown): StatePatch => {
  if (!Array.isArray(input) || input.length === 0) {
    throw new StatePatchValidationError("State patch must contain at least one operation.");
  }
  if (input.length > maxStatePatchOperations) {
    throw new StatePatchValidationError(
      `State patch has ${input.length} operations; the maximum is ${maxStatePatchOperations}.`
    );
  }
  const patch = input.map(validateOperation);
  const bytes = Buffer.byteLength(canonicalJson(patchJsonValue(patch)), "utf8");
  if (bytes > maxStatePatchBytes) {
    throw new StatePatchValidationError(`State patch is ${bytes} bytes; the maximum is ${maxStatePatchBytes} bytes.`);
  }
  return patch;
};

export const statePatchSha256 = (input: unknown): string => {
  const patch = validateStatePatch(input);
  return jsonSha256(patchJsonValue(patch));
};

export const applyStatePatch = (current: JsonValue, input: unknown): AppliedStatePatch => {
  const original = validateState(current);
  const patch = validateStatePatch(input);
  let state = clone(original);
  for (const operation of patch) state = applyOperation(state, operation);
  state = validateState(state);
  const stateJson = canonicalJson(state);
  const patchValue = patchJsonValue(patch);
  const patchJson = canonicalJson(patchValue);
  return {
    state,
    stateJson,
    stateSha256: jsonSha256(state),
    patch,
    patchJson,
    patchSha256: jsonSha256(patchValue)
  };
};

const validateOperation = (input: unknown, index: number): JsonPatchOperation => {
  if (!isRecord(input)) throw new StatePatchValidationError(`State patch operation ${index} must be an object.`);
  const op = input.op;
  const path = input.path;
  if (op !== "add" && op !== "remove" && op !== "replace") {
    throw new StatePatchValidationError(`State patch operation ${index} has unsupported op ${String(op)}.`);
  }
  if (typeof path !== "string") {
    throw new StatePatchValidationError(`State patch operation ${index} path must be a non-empty JSON Pointer.`);
  }
  const expectedKeys = op === "remove" ? ["op", "path"] : ["op", "path", "value"];
  if (!sameKeys(input, expectedKeys)) {
    throw new StatePatchValidationError(`State patch operation ${index} contains invalid fields.`);
  }
  pointerSegments(path, index);
  if (op === "remove") return { op, path };
  try {
    assertJsonValue(input.value, { label: `State patch operation ${index} value`, maxDepth: maxRuntimeJsonDepth });
  } catch (error) {
    throw wrap(error);
  }
  return { op, path, value: input.value };
};

const applyOperation = (state: JsonValue, operation: JsonPatchOperation): JsonValue => {
  const segments = pointerSegments(operation.path);
  const { parent, key } = resolveParent(state, segments, operation.path);
  if (Array.isArray(parent)) {
    const index = arrayIndex(key, parent.length, operation.op === "add", operation.path);
    if (operation.op === "add") parent.splice(index, 0, clone(operation.value));
    else if (operation.op === "remove") parent.splice(index, 1);
    else parent[index] = clone(operation.value);
    return state;
  }
  if (!isJsonObject(parent)) throw new StatePatchValidationError(`State patch path ${operation.path} has no object parent.`);
  const exists = Object.prototype.hasOwnProperty.call(parent, key);
  if (operation.op !== "add" && !exists) {
    throw new StatePatchValidationError(`State patch path ${operation.path} does not exist.`);
  }
  if (operation.op === "remove") delete parent[key];
  else parent[key] = clone(operation.value);
  return state;
};

const pointerSegments = (path: unknown, index?: number): string[] => {
  const prefix = index === undefined ? "State patch path" : `State patch operation ${index} path`;
  if (typeof path !== "string" || path === "" || !path.startsWith("/")) {
    throw new StatePatchValidationError(`${prefix} must be a non-empty JSON Pointer.`);
  }
  return path.slice(1).split("/").map((segment) => {
    if (/~(?:[^01]|$)/.test(segment)) throw new StatePatchValidationError(`${prefix} has invalid escaping.`);
    const decoded = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    if (forbiddenSegments.has(decoded)) throw new StatePatchValidationError(`${prefix} contains a forbidden segment.`);
    return decoded;
  });
};

const resolveParent = (state: JsonValue, segments: string[], path: string): { parent: JsonValue; key: string } => {
  let parent = state;
  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(parent)) {
      parent = parent[arrayIndex(segment, parent.length, false, path)]!;
    } else if (isJsonObject(parent) && Object.prototype.hasOwnProperty.call(parent, segment)) {
      parent = parent[segment]!;
    } else {
      throw new StatePatchValidationError(`State patch path ${path} does not exist.`);
    }
  }
  return { parent, key: segments.at(-1)! };
};

const arrayIndex = (key: string, length: number, adding: boolean, path: string): number => {
  if (adding && key === "-") return length;
  if (!/^(?:0|[1-9]\d*)$/.test(key)) throw new StatePatchValidationError(`State patch path ${path} has an invalid array index.`);
  const index = Number(key);
  const valid = Number.isSafeInteger(index) && (adding ? index <= length : index < length);
  if (!valid) throw new StatePatchValidationError(`State patch path ${path} has an out-of-range array index.`);
  return index;
};

const clone = (value: JsonValue): JsonValue => {
  const copy: unknown = JSON.parse(canonicalJson(value));
  assertJsonValue(copy);
  return copy;
};
const patchJsonValue = (patch: StatePatch): JsonValue => {
  const value: JsonValue[] = [];
  for (const operation of patch) {
    if (operation.op === "remove") value.push({ op: operation.op, path: operation.path });
    else value.push({ op: operation.op, path: operation.path, value: operation.value });
  }
  return value;
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isJsonObject = (value: JsonValue): value is { [key: string]: JsonValue } =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const sameKeys = (value: Record<string, unknown>, expected: string[]): boolean => {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === [...expected].sort()[index]);
};
const wrap = (error: unknown): StatePatchValidationError =>
  error instanceof StatePatchValidationError
    ? error
    : new StatePatchValidationError(error instanceof Error ? error.message : String(error));
