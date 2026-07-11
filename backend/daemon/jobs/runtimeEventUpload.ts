import type { RuntimeEvent } from "../providers/CliRuntimeAdapter.js";
import type { RuntimeProvider } from "../../../shared/domain/runtime.js";
import type { RuntimeEventUpload } from "../transport/DaemonControlPlane.js";

// The branch count mirrors the closed RuntimeEvent union; splitting it would hide exhaustiveness.
// eslint-disable-next-line complexity
export const runtimeEventToUpload = (event: RuntimeEvent, sequence: number, provider: RuntimeProvider = "codex"): RuntimeEventUpload => {
  const base = { sequence, createdAt: new Date().toISOString(), terminal: false };
  switch (event.type) {
    case "execution.started":
      return { ...base, source: event.provider, kind: "system", level: "info", phase: "started", message: "Runtime execution started.", data: { executionId: event.executionId, at: event.at } };
    case "session.started":
      return { ...base, source: "ballet", kind: "system", level: "info", phase: "completed", message: "Provider session established.", data: { sessionId: event.sessionId } };
    case "assistant.delta":
      return { ...base, source: provider, kind: "agent", level: "info", phase: "delta", message: event.text, itemId: event.itemId };
    case "assistant.message":
      return { ...base, source: provider, kind: "agent", level: "info", phase: "completed", message: event.text, itemId: event.itemId };
    case "reasoning.summary":
      return { ...base, source: provider, kind: "think", level: "info", phase: "delta", message: event.text, itemId: event.itemId, data: { summary: event.text } };
    case "tool.started":
      return { ...base, source: provider, kind: event.name === "shell" ? "command" : "tool", level: "info", phase: "started", message: `${event.name} started.`, itemId: event.toolCallId, data: asData(event.input) };
    case "tool.output":
      return { ...base, source: provider, kind: "output", level: "info", phase: "delta", message: event.text, itemId: event.toolCallId };
    case "tool.completed":
      return { ...base, source: provider, kind: event.name === "file_change" ? "file" : "tool", level: event.success ? "info" : "error", phase: "completed", message: `${event.name} ${event.success ? "completed" : "failed"}.`, itemId: event.toolCallId, data: asData(event.output) };
    case "permission.denied":
      return { ...base, source: event.request.provider, kind: "warn", level: "warn", phase: "completed", message: `Runtime policy denied ${event.request.operation}.`, data: asData(event.request) };
    case "usage":
      return { ...base, source: provider, kind: "info", level: "info", phase: "completed", message: "Token usage updated.", data: asData(event.usage) };
    case "diagnostic":
      return { ...base, source: provider, kind: event.level === "warning" ? "warn" : event.level === "error" ? "error" : "info", level: event.level === "warning" ? "warn" : event.level, phase: "completed", message: event.message, data: asData(event.data) };
    case "execution.completed":
      return { ...base, source: "ballet", kind: "system", level: "info", phase: "completed", message: "Runtime execution completed.", data: { sessionId: event.sessionId }, terminal: true };
    case "execution.failed":
      return { ...base, source: "ballet", kind: "error", level: "error", phase: "completed", message: event.message, data: { retryable: event.retryable }, terminal: true };
  }
};

const asData = (value: unknown): Record<string, unknown> | undefined => {
  if (value === undefined) return undefined;
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : { value };
};
