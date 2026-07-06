import type { ProjectPolicy } from "@shared/api/workspace-contracts";

export function WorkflowPolicySummary({
  policy,
  actionOptions,
  count = 1
}: {
  policy: ProjectPolicy;
  actionOptions: Array<{ value: string; label: string; description?: string }>;
  count?: number;
}) {
  const actionDescription = actionOptions.find((option) => option.value === policy.action)?.description;
  const actionTitle = actionDescription || policy.action || "Missing action";

  return (
    <div className="flex h-full min-w-0 flex-1 items-center gap-1 font-mono text-[0.66rem] leading-4">
      <span className="truncate text-tertiary" title={actionTitle}>{policy.action || "Missing action"}</span>
      {count > 1 ? <span className="ml-auto shrink-0 text-muted-foreground">x{count}</span> : null}
    </div>
  );
}
