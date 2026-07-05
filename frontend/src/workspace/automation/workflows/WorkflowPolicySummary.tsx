import type { PointerEvent } from "react";
import type { ProjectPolicy } from "../../../../../shared/api/workspace-contracts";
import { cn } from "@/lib/utils";

export function WorkflowPolicySummary({
  policy,
  editing,
  actionOptions,
  noSelectionValue,
  onActionChange
}: {
  policy: ProjectPolicy;
  editing: boolean;
  actionOptions: Array<{ value: string; label: string; description?: string }>;
  noSelectionValue: string;
  onActionChange: (action: string) => void;
}) {
  const sourceValue = policy.source === "trigger" ? policy.trigger : policy.event;
  const actionDescription = actionOptions.find((option) => option.value === policy.action)?.description;
  const actionTitle = actionDescription || policy.action || "Missing action";
  const editSelectClass = "h-5 min-h-5 max-h-5 w-full min-w-0 max-w-full flex-1 cursor-pointer rounded border border-input bg-background px-1.5 py-0 font-mono text-[0.62rem] leading-4 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";
  const stopCanvasPointerEvent = (event: PointerEvent<HTMLSelectElement>) => event.stopPropagation();

  return (
    <div className="grid min-w-0 gap-1 font-mono text-[0.62rem] leading-4">
      <div className="flex min-w-0 gap-1">
        <span className="shrink-0 text-foreground">type:</span>
        <span className="truncate text-primary" title={policy.source || "event"}>{policy.source || "event"}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <span className="shrink-0 text-foreground">on:</span>
        <span className="truncate text-primary" title={sourceValue || "Missing source"}>{sourceValue || "Missing source"}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <span className="shrink-0 text-foreground">start:</span>
        {editing ? (
          <select
            aria-label="Workflow policy action"
            className={cn(editSelectClass, "text-tertiary")}
            title={actionTitle}
            value={policy.action || noSelectionValue}
            onChange={(event) => onActionChange(event.target.value)}
            onPointerDown={stopCanvasPointerEvent}
            onPointerMove={stopCanvasPointerEvent}
            onPointerUp={stopCanvasPointerEvent}
            onDragStart={(event) => event.stopPropagation()}
          >
            {actionOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : (
          <span className="truncate text-tertiary" title={actionTitle}>{policy.action || "Missing action"}</span>
        )}
      </div>
    </div>
  );
}
