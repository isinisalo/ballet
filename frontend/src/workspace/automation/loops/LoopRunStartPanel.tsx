import { useState } from "react";
import { Play } from "lucide-react";
import { TextAreaField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import type { RuntimePreflightIssue } from "@shared/api/workspace-contracts";

export function LoopRunStartPanel({
  disabledReason,
  preflightIssues = [],
  pending,
  onStart
}: {
  disabledReason?: string;
  preflightIssues?: RuntimePreflightIssue[];
  pending: boolean;
  onStart: (input: string) => Promise<boolean>;
}) {
  const [input, setInput] = useState("");
  const blocked = Boolean(disabledReason) || preflightIssues.length > 0;

  const start = async () => {
    if (await onStart(input)) setInput("");
  };

  return (
    <section className="grid gap-3 border-t border-divider-strong bg-card p-4" aria-label="Start loop run">
      {preflightIssues.length > 0 ? (
        <div className="grid gap-1 border border-destructive/30 bg-destructive/5 p-3" role="alert">
          <p className="text-xs font-medium text-destructive">Runtime preflight failed</p>
          <ul className="grid gap-1 font-mono text-[0.65rem] text-destructive">
            {preflightIssues.map((issue, index) => <li key={`${issue.stepId ?? issue.agentId}-${issue.code}-${index}`}>{issue.stepId ? `${issue.stepId} · ` : ""}{issue.message}</li>)}
          </ul>
          <a href="/runtimes" className="text-xs text-primary underline-offset-4 hover:underline">Open Runtimes</a>
        </div>
      ) : null}
      <TextAreaField label="Manual input (optional)" value={input} rows={3} disabled={pending || blocked} onChange={setInput} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{preflightIssues.length > 0 ? "Resolve every runtime issue before starting." : disabledReason ?? "Starts a new manual run from this loop's saved start step."}</p>
        <Button type="button" disabled={pending || blocked} onClick={() => void start()}>
          <Play /> {pending ? "Starting…" : "Start"}
        </Button>
      </div>
    </section>
  );
}
