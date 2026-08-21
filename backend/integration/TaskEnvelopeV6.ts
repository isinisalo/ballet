import { createHash } from "node:crypto";
import {
  jobTaskEnvelopeV6Schema, orchestratorTaskEnvelopeV6Schema,
  validationTaskEnvelopeV6Schema
} from "../../shared/api/task-envelope-schemas.js";
import type { JsonValue } from "../../shared/domain/automation.js";
import {
  maxOrchestrationRequestEnvelopeBytes, maxRelevantHistoryBytes, maxRelevantHistoryEntries,
  maxResumeContextBytes, maxTaskEnvelopeBytes, type TaskEnvelopeHistoryEntry,
  type TaskEnvelopeV6
} from "../../shared/domain/taskEnvelope.js";
import { assertJsonValue, canonicalJson, jsonSha256 } from "../runtime/state/CanonicalJson.js";
import { validateState } from "../runtime/state/StatePatch.js";

export class TaskEnvelopeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskEnvelopeValidationError";
  }
}

export interface SerializedTaskEnvelopeV6 {
  envelope: TaskEnvelopeV6;
  serialized: string;
  sha256: string;
  sizeBytes: number;
}

export const serializeTaskEnvelopeV6 = (input: TaskEnvelopeV6): SerializedTaskEnvelopeV6 => {
  const relevantHistory = selectRelevantHistory(input.relevantHistory);
  const normalized = input.role === "orchestrator"
    ? { ...input, relevantHistory, allowedCandidates: [...input.allowedCandidates].sort((left, right) =>
      compareUtf8(left.id, right.id) || compareUtf8(left.route.capability, right.route.capability)) }
    : input.role === "validation"
      ? { ...input, relevantHistory, allowedTransitions: [...input.allowedTransitions].sort((left, right) =>
        compareUtf8(left.id, right.id)) }
      : { ...input, relevantHistory };
  const parsed = parseEnvelope(normalized);
  const state = validateState(parsed.state.value);
  if (jsonSha256(state) !== parsed.state.sha256) {
    throw new TaskEnvelopeValidationError("Task Envelope State SHA-256 does not match its canonical value.");
  }
  assertBoundedJson(relevantHistory, "Task Envelope relevant history", maxRelevantHistoryBytes);
  if (parsed.resume) assertBoundedJson(parsed.resume, "Task Envelope resume context", maxResumeContextBytes);
  if (parsed.role === "orchestrator") {
    assertBoundedJson(
      parsed.orchestrationRequest,
      "Task Envelope Orchestration Request",
      maxOrchestrationRequestEnvelopeBytes
    );
    assertUniqueCandidates(parsed.allowedCandidates);
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

export const parseSerializedTaskEnvelopeV6 = (serialized: string): SerializedTaskEnvelopeV6 => {
  let value: unknown;
  try { value = JSON.parse(serialized); }
  catch (error) {
    throw new TaskEnvelopeValidationError(
      `Task Envelope is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const result = serializeTaskEnvelopeV6(parseEnvelope(value));
  if (result.serialized !== serialized) throw new TaskEnvelopeValidationError(
    "Task Envelope is not in canonical V6 serialization order."
  );
  return result;
};

export const selectRelevantHistory = (
  candidates: readonly TaskEnvelopeHistoryEntry[]
): TaskEnvelopeHistoryEntry[] => [...candidates]
  .sort((left, right) => left.sequence - right.sequence || compareUtf8(left.nodeRunId, right.nodeRunId))
  .slice(-maxRelevantHistoryEntries);

const parseEnvelope = (input: unknown): TaskEnvelopeV6 => {
  if (typeof input !== "object" || input === null || !("role" in input)) {
    throw new TaskEnvelopeValidationError("Task Envelope must declare a Node role.");
  }
  try {
    if (input.role === "job") return jobTaskEnvelopeV6Schema.parse(input);
    if (input.role === "validation") return validationTaskEnvelopeV6Schema.parse(input);
    if (input.role === "orchestrator") return orchestratorTaskEnvelopeV6Schema.parse(input);
    throw new TaskEnvelopeValidationError(`Task Envelope has unsupported Node role ${String(input.role)}.`);
  } catch (error) {
    if (error instanceof TaskEnvelopeValidationError) throw error;
    throw new TaskEnvelopeValidationError(
      `Task Envelope is invalid: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const assertUniqueCandidates = (
  targets: Array<{ id: string; route: { kind: string; capability: string } }>
): void => {
  const ids = new Set<string>();
  for (const target of targets) {
    const key = `${target.id}\u0000${target.route.kind}\u0000${target.route.capability}`;
    if (ids.has(key)) throw new TaskEnvelopeValidationError(
      `Task Envelope contains duplicate allowed candidate ${target.id}:${target.route.capability}.`
    );
    ids.add(key);
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
