import { Save } from "lucide-react";
import { automationFieldLimits } from "@shared/api/automationValidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type WorkflowNameMode = "read" | "create" | "edit";

export function WorkflowHeaderNameEditor({
  mode,
  selectedWorkflowId,
  value,
  canSave,
  onEdit,
  onValueChange,
  onSave
}: {
  mode: WorkflowNameMode;
  selectedWorkflowId?: string;
  value: string;
  canSave: boolean;
  onEdit: () => void;
  onValueChange: (value: string) => void;
  onSave: () => void;
}) {
  if (mode === "read") {
    if (!selectedWorkflowId) return null;
    return (
      <button
        type="button"
        className="min-w-0 cursor-pointer truncate rounded px-1 py-0.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
        title={selectedWorkflowId}
        onClick={onEdit}
      >
        {selectedWorkflowId}
      </button>
    );
  }

  return (
    <form
      className="flex min-w-0 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) onSave();
      }}
    >
      <Input
        aria-label="Workflow name"
        aria-invalid={!canSave}
        autoFocus
        className={cn("h-8 w-[min(18rem,42vw)] min-w-0 font-mono text-xs", !canSave && "border-destructive")}
        minLength={automationFieldLimits.token.min}
        maxLength={automationFieldLimits.token.max}
        value={value}
        placeholder="Workflow name"
        onChange={(event) => onValueChange(event.target.value)}
      />
      <Button type="submit" size="sm" disabled={!canSave} aria-label="Save workflow" title="Save workflow">
        <Save data-icon="inline-start" />
        Save
      </Button>
    </form>
  );
}
