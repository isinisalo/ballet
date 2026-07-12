import type { RuntimeEvent } from "../CliRuntimeAdapter.js";
import type { CopilotSessionEvent } from "./copilotSdkTypes.js";

const value = (input: unknown): string => typeof input === "string" ? input : "";

// The switch is an explicit protocol boundary and intentionally enumerates supported SDK events.
// eslint-disable-next-line complexity
export const normalizeCopilotEvent = (event: CopilotSessionEvent): RuntimeEvent[] => {
  const data = event.data ?? {};
  const id = value(data.toolCallId) || value(data.id) || value(data.messageId) || undefined;
  switch (event.type) {
    case "assistant.message_delta":
      return value(data.deltaContent) ? [{ type: "assistant.delta", text: value(data.deltaContent), itemId: id }] : [];
    case "assistant.message":
      return value(data.content) ? [{ type: "assistant.message", text: value(data.content), itemId: id }] : [];
    case "assistant.reasoning_delta":
    case "assistant.reasoning":
      return [];
    case "tool.execution_start":
      return id ? [{ type: "tool.started", toolCallId: id, name: value(data.toolName) || "tool", input: data.arguments ?? data.toolArgs }] : [];
    case "tool.execution_partial_result":
      return id && value(data.partialOutput) ? [{ type: "tool.output", toolCallId: id, text: value(data.partialOutput) }] : [];
    case "tool.execution_progress":
      return id && value(data.progressMessage) ? [{ type: "tool.output", toolCallId: id, text: value(data.progressMessage) }] : [];
    case "tool.execution_complete": {
      if (!id) return [];
      const result = record(data.result);
      const error = record(data.error);
      const output = value(result.detailedContent) || value(result.content) || value(error.message);
      return [
        ...(output ? [{ type: "tool.output" as const, toolCallId: id, text: output }] : []),
        {
          type: "tool.completed" as const,
          toolCallId: id,
          name: value(data.toolName) || "tool",
          success: data.success !== false && !data.error,
          output: data.result ?? data.error
        }
      ];
    }
    case "session.usage_info":
      return [{ type: "usage", usage: {
        inputTokens: numberValue(data.inputTokens),
        outputTokens: numberValue(data.outputTokens),
        cachedInputTokens: numberValue(data.cacheReadTokens)
      } }];
    case "session.error":
      return [{ type: "diagnostic", level: "error", message: value(data.message) || "Copilot session error.", data }];
    case "permission.requested":
      return [{ type: "diagnostic", level: "warning", message: "Copilot requested an unresolved permission.", data }];
    default:
      return [];
  }
};

const numberValue = (input: unknown): number | undefined =>
  typeof input === "number" && Number.isFinite(input) ? input : undefined;

const record = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};

export const copilotMessageText = (message: unknown): string => {
  if (!message || typeof message !== "object") return "";
  const data = (message as { data?: Record<string, unknown> }).data;
  return value(data?.content);
};
