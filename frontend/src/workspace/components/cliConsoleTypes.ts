export type CliConsoleProvider = "codex" | "copilot";
export type CliConsoleKind = "system" | "think" | "agent" | "command" | "output" | "file" | "tool" | "info" | "warn" | "error";
export type CliConsolePhase = "started" | "delta" | "completed";
export type CliConsoleStatus = "connecting" | "connected" | "reconnecting" | "stored" | "disconnected";

export interface CliConsoleEvent {
  id: number;
  taskId: string;
  sequence: number;
  source: "ballet" | CliConsoleProvider;
  kind: CliConsoleKind;
  level: "info" | "warn" | "error";
  phase: CliConsolePhase;
  itemId?: string;
  message: string;
  data?: Record<string, unknown>;
  contentBytes: number;
  terminal: boolean;
  createdAt: string;
}

export interface CliConsolePage {
  entries: CliConsoleEvent[];
  lastId: number;
  hasMore: boolean;
  truncated: boolean;
}
