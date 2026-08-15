import { z } from "zod";

export const executionTaskRowSchema = z.object({
  task_id: z.string(), provider: z.enum(["codex", "copilot"]), kind: z.literal("node_execution"),
  root_run_id: z.string(), node_run_id: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  spec_json: z.string(), spec_hash: z.string(), started_at: z.string().nullable(),
  completed_at: z.string().nullable(), cancel_requested_at: z.string().nullable(),
  error_code: z.string().nullable(), error_message: z.string().nullable(), outcome_json: z.string().nullable(),
  retained_content_bytes: z.number().int(), events_truncated: z.union([z.literal(0), z.literal(1)]),
  last_sequence: z.number().int(), created_at: z.string(), updated_at: z.string()
}).strict();

export const executionEventRowSchema = z.object({
  id: z.number().int(), task_id: z.string(), sequence: z.number().int(),
  source: z.enum(["ballet", "codex", "copilot"]),
  kind: z.enum(["system", "think", "agent", "command", "output", "file", "tool", "info", "warn", "error"]),
  level: z.enum(["info", "warn", "error"]), phase: z.enum(["started", "delta", "completed"]),
  item_id: z.string().nullable(), message: z.string(), data_json: z.string().nullable(),
  content_bytes: z.number().int(), terminal: z.union([z.literal(0), z.literal(1)]), created_at: z.string()
}).strict();

export type ExecutionTaskRow = z.infer<typeof executionTaskRowSchema>;
export type ExecutionEventRow = z.infer<typeof executionEventRowSchema>;

export const readExecutionInteger = (value: unknown, key: string): number => {
  if (typeof value === "object" && value !== null && key in value) {
    const field = Reflect.get(value, key);
    if (typeof field === "number" && Number.isSafeInteger(field)) return field;
  }
  throw new Error(`Execution database returned an invalid ${key} value.`);
};

export const readExecutionString = (value: unknown, key: string): string => {
  if (typeof value === "object" && value !== null && key in value) {
    const field = Reflect.get(value, key);
    if (typeof field === "string") return field;
  }
  throw new Error(`Execution database returned an invalid ${key} value.`);
};
