import { createHash } from "node:crypto";
import {
  orchestratorTaskEnvelopeV3Schema, validationTaskEnvelopeV3Schema,
  workTaskEnvelopeV3Schema
} from "../../shared/api/task-envelope-schemas.js";
import type { JsonValue } from "../../shared/domain/automation.js";
import {
  maxRelevantHistoryBytes, maxRelevantHistoryEntries, maxRepairRequestEnvelopeBytes,
  maxResumeContextBytes, maxTaskEnvelopeBytes, type TaskEnvelopeHistoryEntry,
  type TaskEnvelopeV3
} from "../../shared/domain/taskEnvelope.js";
import { assertJsonValue, canonicalJson, jsonSha256 } from "../runtime/state/CanonicalJson.js";
import { validateState } from "../runtime/state/StatePatch.js";

export class TaskEnvelopeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskEnvelopeValidationError";
  }
}

export interface SerializedTaskEnvelopeV3 {
  envelope: TaskEnvelopeV3;
  serialized: string;
  sha256: string;
  sizeBytes: number;
}

export const serializeTaskEnvelopeV3 = (input: TaskEnvelopeV3): SerializedTaskEnvelopeV3 => {
  const relevantHistory = selectRelevantHistory(input.relevantHistory);
  const normalized = input.role === "orchestrator"
    ? { ...input, relevantHistory, allowedTargetLoops: [...input.allowedTargetLoops].sort((left, right) => compareUtf8(left.id, right.id)) }
    : { ...input, relevantHistory };
  const parsed = parseEnvelope(normalized);
  const state = validateState(parsed.state.value);
  if (jsonSha256(state) !== parsed.state.sha256) {
    throw new TaskEnvelopeValidationError("Task Envelope State SHA-256 does not match its canonical value.");
  }
  assertBoundedJson(relevantHistory, "Task Envelope relevant history", maxRelevantHistoryBytes);
  if (parsed.resume) assertBoundedJson(parsed.resume, "Task Envelope resume context", maxResumeContextBytes);
  if (parsed.role === "orchestrator") {
    assertBoundedJson(parsed.repairRequest, "Task Envelope Repair Request", maxRepairRequestEnvelopeBytes);
    assertUniqueTargets(parsed.allowedTargetLoops);
  }
  const envelopeValue = jsonValue(parsed, "Task Envelope");
  const serialized = canonicalJson(envelopeValue);
  const sizeBytes = Buffer.byteLength(serialized, "utf8");
  if (sizeBytes > maxTaskEnvelopeBytes) throw new TaskEnvelopeValidationError(
    `Task Envelope is ${sizeBytes} bytes; the maximum is ${maxTaskEnvelopeBytes} bytes.`
  );
  return {
    envelope: parseEnvelope(JSON.parse(serialized)),
    serialized,
    sha256: createHash("sha256").update(serialized, "utf8").digest("hex"),
    sizeBytes
  };
};

export const parseSerializedTaskEnvelopeV3 = (serialized: string): SerializedTaskEnvelopeV3 => {
  let value: unknown;
  try { value = JSON.parse(serialized); }
  catch (error) {
    throw new TaskEnvelopeValidationError(
      `Task Envelope is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const result = serializeTaskEnvelopeV3(parseEnvelope(value));
  if (result.serialized !== serialized) throw new TaskEnvelopeValidationError(
    "Task Envelope is not in canonical V3 serialization order."
  );
  return result;
};

export const selectRelevantHistory = (
  candidates: readonly TaskEnvelopeHistoryEntry[]
): TaskEnvelopeHistoryEntry[] => [...candidates]
  .sort((left, right) => left.sequence - right.sequence || compareUtf8(left.nodeRunId, right.nodeRunId))
  .slice(-maxRelevantHistoryEntries);

const parseEnvelope = (input: unknown): TaskEnvelopeV3 => {
  if (typeof input !== "object" || input === null || !("role" in input)) {
    throw new TaskEnvelopeValidationError("Task Envelope must declare a Node role.");
  }
  try {
    if (input.role === "work") return workTaskEnvelopeV3Schema.parse(input);
    if (input.role === "validation") return validationTaskEnvelopeV3Schema.parse(input);
    if (input.role === "orchestrator") return orchestratorTaskEnvelopeV3Schema.parse(input);
    throw new TaskEnvelopeValidationError(`Task Envelope has unsupported Node role ${String(input.role)}.`);
  } catch (error) {
    if (error instanceof TaskEnvelopeValidationError) throw error;
    throw new TaskEnvelopeValidationError(
      `Task Envelope is invalid: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const assertUniqueTargets = (targets: Array<{ id: string }>): void => {
  const ids = new Set<string>();
  for (const target of targets) {
    if (ids.has(target.id)) throw new TaskEnvelopeValidationError(
      `Task Envelope contains duplicate allowed target Loop ${target.id}.`
    );
    ids.add(target.id);
  }
};

const assertBoundedJson = (value: unknown, label: string, maxBytes: number): void => {
  try {
    assertJsonValue(value, { label, maxBytes });
  } catch (error) {
    throw new TaskEnvelopeValidationError(error instanceof Error ? error.message : String(error));
  }
};

const jsonValue = (value: unknown, label: string): JsonValue => {
  try {
    assertJsonValue(value, { label });
    return value;
  } catch (error) {
    throw new TaskEnvelopeValidationError(error instanceof Error ? error.message : String(error));
  }
};

const compareUtf8 = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
