import { useRef, useState, type FormEvent } from "react";
import { Play } from "lucide-react";
import { TextAreaField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import type { RuntimePreflightIssue } from "@shared/api/workspace-contracts";

export function LoopRunStartPanel({
  disabledReason,
  preflightIssues = [],
  bypassesSchedule = false,
  pending,
  onStart
}: {
  disabledReason?: string;
  preflightIssues?: RuntimePreflightIssue[];
  bypassesSchedule?: boolean;
  pending: boolean;
  onStart: (input: string) => Promise<boolean>;
}) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const blocked = Boolean(disabledReason) || preflightIssues.length > 0;
  const busy = pending || submitting;

  const start = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || pending || blocked) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      if (await onStart(input)) setInput("");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form
      className="grid gap-3 border-t border-divider-strong bg-card p-4"
      aria-label="Start loop run"
      onSubmit={(event) => void start(event)}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLTextAreaElement && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.currentTarget.requestSubmit();
        }
      }}
    >
      {preflightIssues.length > 0 ? (
        <div className="grid gap-1 border border-destructive/30 bg-destructive/5 p-3" role="alert">
          <p className="text-xs font-medium text-destructive">Runtime preflight failed</p>
          <ul className="grid gap-1 font-mono text-[0.65rem] text-destructive">
            {preflightIssues.map((issue, index) => <li key={`${issue.stepId ?? issue.agentId}-${issue.code}-${index}`}>{issue.stepId ? `${issue.stepId} · ` : ""}{issue.message}</li>)}
          </ul>
          <a href="/runtimes" className="text-xs text-primary underline-offset-4 hover:underline">Open Runtimes</a>
        </div>
      ) : null}
      <TextAreaField label="Manual input (optional)" density="compact" value={input} rows={3} disabled={busy || blocked} onChange={setInput} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{preflightIssues.length > 0 ? "Resolve every runtime issue before starting." : disabledReason ?? (bypassesSchedule ? "Starts from the first executable step and bypasses the saved schedule." : "Starts a new manual run from this loop's saved start step.")}</p>
        <Button type="submit" disabled={busy || blocked}>
          <Play /> {busy ? "Starting…" : "Start"}
        </Button>
      </div>
    </form>
  );
}
