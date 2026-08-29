import type { RuntimeEvent } from "../CliRuntimeAdapter.js";
import type { CodexRpcMessage } from "./CodexJsonRpcClient.js";

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === "string" ? value : "";

export interface CodexTurnState {
  threadId?: string;
  turnId?: string;
  finalText: string;
  status?: string;
  error?: string;
}

// The switch is an explicit protocol boundary and intentionally enumerates supported notifications.
export const normalizeCodexNotification = (
  message: CodexRpcMessage,
  state: CodexTurnState
): RuntimeEvent[] => { // eslint-disable-line complexity
  const params = record(message.params);
  const item = record(params.item);
  const itemId = text(params.itemId) || text(item.id) || undefined;
  switch (message.method) {
    case "ballet/nonJsonOutput":
      return [{ type: "diagnostic", level: "warning", message: "Codex emitted non-JSON output.", data: params.line }];
    case "thread/started": {
      const thread = record(params.thread);
      const threadId = text(thread.id) || text(params.threadId);
      if (threadId) state.threadId = threadId;
      return threadId ? [{ type: "session.started", sessionId: threadId }] : [];
    }
    case "turn/started": {
      const turn = record(params.turn);
      state.turnId = text(turn.id) || state.turnId;
      return [];
    }
    case "item/agentMessage/delta":
      return text(params.delta) ? [{ type: "assistant.delta", text: text(params.delta), itemId }] : [];
    case "item/reasoning/summaryTextDelta":
      return text(params.delta) ? [{ type: "reasoning.summary", text: text(params.delta), itemId }] : [];
    case "item/commandExecution/outputDelta":
      return text(params.delta) && itemId ? [{ type: "tool.output", toolCallId: itemId, text: text(params.delta) }] : [];
    case "item/started":
      return startedItem(item, itemId);
    case "item/completed":
      return completedItem(item, itemId, state);
    case "turn/completed": {
      const turn = record(params.turn);
      state.turnId = text(turn.id) || state.turnId;
      state.status = text(turn.status) || "completed";
      state.error = text(record(turn.error).message) || undefined;
      return [];
    }
    case "error": {
      const error = record(params.error);
      state.error = text(error.message) || "Codex app-server reported an error.";
      return [{ type: "diagnostic", level: "error", message: state.error, data: error }];
    }
    default:
      return [];
  }
};

const startedItem = (item: Record<string, unknown>, itemId?: string): RuntimeEvent[] => {
  if (!itemId) return [];
  const type = text(item.type);
  if (type === "commandExecution") {
    return [{ type: "tool.started", toolCallId: itemId, name: "shell", input: { command: item.command, cwd: item.cwd } }];
  }
  if (type === "fileChange") {
    return [{ type: "tool.started", toolCallId: itemId, name: "file_change", input: item.changes }];
  }
  if (["mcpToolCall", "dynamicToolCall", "collabToolCall", "webSearch"].includes(type)) {
    return [{ type: "tool.started", toolCallId: itemId, name: text(item.tool) || text(item.server) || type, input: item.arguments ?? item.query }];
  }
  return [];
};

const completedItem = (
  item: Record<string, unknown>,
  itemId: string | undefined,
  state: CodexTurnState
): RuntimeEvent[] => {
  const type = text(item.type);
  if (type === "agentMessage") {
    const message = text(item.text);
    if (message && (!item.phase || item.phase === "final_answer")) state.finalText = message;
    return message ? [{ type: "assistant.message", text: message, itemId }] : [];
  }
  if (!itemId) return [];
  if (type === "commandExecution") {
    const success = item.status !== "failed" && (typeof item.exitCode !== "number" || item.exitCode === 0);
    return [{ type: "tool.completed", toolCallId: itemId, name: "shell", success, output: {
      exitCode: item.exitCode,
      aggregatedOutput: item.aggregatedOutput
    } }];
  }
  if (type === "fileChange") {
    return [{ type: "tool.completed", toolCallId: itemId, name: "file_change", success: item.status !== "failed", output: item.changes }];
  }
  if (["mcpToolCall", "dynamicToolCall", "collabToolCall", "webSearch"].includes(type)) {
    return [{
      type: "tool.completed",
      toolCallId: itemId,
      name: text(item.tool) || text(item.server) || type,
      success: item.status !== "failed" && !item.error,
      output: item.result ?? item.error
    }];
  }
  return [];
};

export const threadIdFromCodexResult = (value: unknown): string | undefined => text(record(record(value).thread).id);
export const turnIdFromCodexResult = (value: unknown): string | undefined => text(record(record(value).turn).id);

export const modelsFromCodexResult = (value: unknown): Array<{
  id: string;
  name: string;
  isDefault?: boolean;
  reasoningOptions?: string[];
  defaultReasoning?: string;
  capabilities?: { reasoning?: boolean };
}> => {
  const result = record(value);
  const entries = Array.isArray(result.data) ? result.data : Array.isArray(result.models) ? result.models : [];
  return entries.flatMap((entry) => {
    const model = record(entry);
    const id = text(model.id) || text(model.model);
    if (!id) return [];
    const reasoningOptions = Array.isArray(model.supportedReasoningEfforts)
      ? model.supportedReasoningEfforts.flatMap((option) => {
        const effort = text(record(option).reasoningEffort);
        return effort ? [effort] : [];
      })
      : [];
    return [{
      id,
      name: text(model.displayName) || text(model.name) || id,
      isDefault: model.isDefault === true,
      reasoningOptions,
      defaultReasoning: text(model.defaultReasoningEffort) || undefined,
      capabilities: { reasoning: reasoningOptions.length > 0 }
    }];
  });
};

export const nextCodexModelCursor = (value: unknown): string | undefined => {
  const cursor = record(value).nextCursor;
  return typeof cursor === "string" && cursor ? cursor : undefined;
};
