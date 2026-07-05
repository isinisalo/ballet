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
  const actionDescription = actionOptions.find((option) => option.value === policy.action)?.description;
  const actionTitle = actionDescription || policy.action || "Missing action";
  const editSelectClass = "h-[18px] min-h-[18px] max-h-[18px] w-full min-w-0 max-w-full flex-1 cursor-pointer rounded border border-input bg-background px-1 py-0 font-mono text-[0.62rem] leading-4 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";
  const stopCanvasPointerEvent = (event: PointerEvent<HTMLSelectElement>) => event.stopPropagation();

  return (
    <div className="flex h-full min-w-0 flex-1 items-center font-mono text-[0.66rem] leading-4">
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
  );
}
