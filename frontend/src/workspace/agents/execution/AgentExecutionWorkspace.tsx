import type { ReactNode } from "react";
import { AgentExecutionModeSwitch } from "./AgentExecutionModeSwitch";
import { AgentRunPane } from "./AgentRunPane";
import type { AgentExecutionMode } from "./types";

export function AgentExecutionWorkspace({ agentId, mode, editContent, runDisabledReason, onModeChange }: {
  agentId: string;
  mode: AgentExecutionMode;
  editContent: ReactNode;
  runDisabledReason?: string;
  onModeChange: (mode: AgentExecutionMode) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex justify-end"><AgentExecutionModeSwitch mode={mode} runDisabledReason={runDisabledReason} onChange={onModeChange} /></div>
      {mode === "edit" ? editContent : <AgentRunPane agentId={agentId} disabledReason={runDisabledReason} />}
    </div>
  );
}
