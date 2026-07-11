import type { RunTarget } from "@shared/api/workspace-contracts";
import { Bot, Play, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function RunTargetCard({ target, pending, onOpen, onStart }: {
  target: RunTarget;
  pending: boolean;
  onOpen: () => void;
  onStart: () => void;
}) {
  const Icon = target.kind === "loop" ? Route : Bot;
  const issueLabels = [...new Set(target.issues.map((issue) => {
    const owner = issue.stepId ?? issue.agentId;
    return owner ? `${owner}: ${issue.message}` : issue.message;
  }))];
  const reason = issueLabels.length > 3
    ? `${issueLabels.slice(0, 3).join(" · ")} · +${issueLabels.length - 3} more`
    : issueLabels.join(" · ");
  const fullReason = issueLabels.join(" · ");
  return (
    <article className="grid min-w-0 gap-3 border border-divider-strong bg-panel-section p-3">
      <header className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xs font-medium">{target.name}</h3>
          <p className="truncate font-mono text-[0.62rem] text-muted-foreground">{target.id}</p>
        </div>
        <Badge variant={target.ready ? "secondary" : "outline"}>{target.activeRootRunId ? "active" : target.ready ? "ready" : "blocked"}</Badge>
      </header>
      {target.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{target.description}</p> : null}
      {reason ? <p className="line-clamp-2 font-mono text-[0.62rem] text-tertiary" title={fullReason}>{reason}</p> : <p className="font-mono text-[0.62rem] text-secondary">preflight ready</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="xs" onClick={onOpen}>{target.activeRootRunId ? "Monitor" : "Details"}</Button>
        {!target.activeRootRunId ? <Button type="button" size="xs" disabled={!target.ready || pending} title={fullReason} onClick={onStart}><Play />Start</Button> : null}
      </div>
    </article>
  );
}
