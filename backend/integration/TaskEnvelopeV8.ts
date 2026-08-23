import { createHash } from "node:crypto";
import { taskEnvelopeV8Schema } from "../../shared/api/task-envelope-schemas.js";
import type { JsonValue } from "../../shared/domain/automation.js";
import { maxTaskEnvelopeBytes, type TaskEnvelopeV8 } from "../../shared/domain/taskEnvelope.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";

export interface SerializedTaskEnvelopeV8 {
  envelope: TaskEnvelopeV8;
  serialized: string;
  sha256: string;
  bytes: number;
}

export const serializeTaskEnvelopeV8 = (input: TaskEnvelopeV8): SerializedTaskEnvelopeV8 => {
  const envelope = taskEnvelopeV8Schema.parse(input) as TaskEnvelopeV8;
  const serialized = canonicalJson(envelope as unknown as JsonValue);
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes > maxTaskEnvelopeBytes) {
    throw new Error(`Task Envelope v8 is ${bytes} bytes; the maximum is ${maxTaskEnvelopeBytes} bytes.`);
  }
  return { envelope, serialized, sha256: sha256(serialized), bytes };
};

export const parseSerializedTaskEnvelopeV8 = (source: string): SerializedTaskEnvelopeV8 => {
  const value: unknown = JSON.parse(source);
  return serializeTaskEnvelopeV8(value as TaskEnvelopeV8);
};

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
