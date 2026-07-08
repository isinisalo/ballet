import { ShieldCheck } from "lucide-react";
import type { ProjectAction } from "@shared/api/workspace-contracts";

export function LoopActionSummary({
  action,
  actionOptions,
  count = 1,
  humanGate = false
}: {
  action: ProjectAction;
  actionOptions: Array<{ value: string; label: string; description?: string }>;
  count?: number;
  humanGate?: boolean;
}) {
  const actionDescription = actionOptions.find((option) => option.value === action.id)?.description;
  const actionTitle = actionDescription || action.id || "Missing action";

  return (
    <div className="flex h-full min-w-0 flex-1 items-center gap-1 font-mono text-[0.66rem] leading-4">
      {humanGate ? <ShieldCheck className="size-3 shrink-0 text-tertiary" aria-hidden="true" /> : null}
      <span className="truncate text-tertiary" title={actionTitle}>{action.id || "Missing action"}</span>
      {count > 1 ? <span className="ml-auto shrink-0 text-muted-foreground">x{count}</span> : null}
    </div>
  );
}
