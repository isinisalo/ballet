import { createHash } from "node:crypto";
import { taskEnvelopeV9Schema } from "../../shared/api/task-envelope-schemas.js";
import type { JsonValue } from "../../shared/domain/automation.js";
import { maxTaskEnvelopeBytes, type TaskEnvelopeV9 } from "../../shared/domain/taskEnvelope.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";

export interface SerializedTaskEnvelopeV9 {
  envelope: TaskEnvelopeV9;
  serialized: string;
  sha256: string;
  bytes: number;
}

export function serializeTaskEnvelopeV9(input: TaskEnvelopeV9): SerializedTaskEnvelopeV9 {
  const envelope = taskEnvelopeV9Schema.parse(input) as TaskEnvelopeV9;
  const serialized = canonicalJson(envelope as unknown as JsonValue);
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes > maxTaskEnvelopeBytes) throw new Error(
    `Task Envelope v9 is ${bytes} bytes; the maximum is ${maxTaskEnvelopeBytes} bytes.`
  );
  return { envelope, serialized, sha256: sha256(serialized), bytes };
}

export function parseSerializedTaskEnvelopeV9(source: string): SerializedTaskEnvelopeV9 {
  return serializeTaskEnvelopeV9(JSON.parse(source) as TaskEnvelopeV9);
}

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
