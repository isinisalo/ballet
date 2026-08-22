import { createHash } from "node:crypto";
import { taskEnvelopeV7Schema } from "../../shared/api/task-envelope-schemas.js";
import type { JsonValue } from "../../shared/domain/automation.js";
import {
  maxTaskEnvelopeBytes, type TaskEnvelopeV7
} from "../../shared/domain/taskEnvelope.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";

export interface SerializedTaskEnvelopeV7 {
  envelope: TaskEnvelopeV7;
  serialized: string;
  sha256: string;
  bytes: number;
}

export const serializeTaskEnvelopeV7 = (input: TaskEnvelopeV7): SerializedTaskEnvelopeV7 => {
  const envelope = taskEnvelopeV7Schema.parse(input) as TaskEnvelopeV7;
  const serialized = canonicalJson(envelope as unknown as JsonValue);
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes > maxTaskEnvelopeBytes) {
    throw new Error(`Task Envelope v7 is ${bytes} bytes; the maximum is ${maxTaskEnvelopeBytes} bytes.`);
  }
  return { envelope, serialized, sha256: sha256(serialized), bytes };
};

export const parseSerializedTaskEnvelopeV7 = (source: string): SerializedTaskEnvelopeV7 => {
  const value: unknown = JSON.parse(source);
  return serializeTaskEnvelopeV7(value as TaskEnvelopeV7);
};

const sha256 = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");
