import { Button } from "@/components/ui/button";
import type { AgentExecutionMode } from "./types";

export function AgentExecutionModeSwitch({ mode, runDisabledReason, onChange }: {
  mode: AgentExecutionMode;
  runDisabledReason?: string;
  onChange: (mode: AgentExecutionMode) => void;
}) {
  return (
    <div className="flex rounded border border-divider-strong bg-background p-0.5" aria-label="Agent mode" title={runDisabledReason}>
      {(["edit", "run"] as const).map((candidate) => (
        <Button key={candidate} type="button" size="xs" variant={candidate === mode ? "default" : "ghost"} aria-pressed={candidate === mode} onClick={() => onChange(candidate)}>
          {candidate === "edit" ? "Edit" : "Run"}
        </Button>
      ))}
    </div>
  );
}
