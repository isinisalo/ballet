import type { AutomationLoopMode } from "../types";
import { Button } from "@/components/ui/button";

export function AutomationModeSwitch({
  mode,
  disabled,
  onChange
}: {
  mode: AutomationLoopMode;
  disabled?: boolean;
  onChange: (mode: AutomationLoopMode) => void;
}) {
  return (
    <div className="flex rounded border border-divider-strong bg-background p-0.5" aria-label="Loop mode">
      {(["edit", "run"] as const).map((candidate) => (
        <Button
          key={candidate}
          type="button"
          size="xs"
          variant={candidate === mode ? "default" : "ghost"}
          disabled={disabled && candidate === "run"}
          aria-pressed={candidate === mode}
          onClick={() => onChange(candidate)}
        >
          {candidate === "edit" ? "Edit" : "Run"}
        </Button>
      ))}
    </div>
  );
}
