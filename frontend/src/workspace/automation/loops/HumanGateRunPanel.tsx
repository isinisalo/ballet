import { useEffect, useRef, useState, type FormEvent } from "react";
import type { StepRun } from "@shared/api/workspace-contracts";
import { TextAreaField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";

export function HumanGateRunPanel({
  stepRun,
  pending,
  onRespond
}: {
  stepRun: StepRun;
  pending: boolean;
  onRespond: (stepRunId: string, result: "approved" | "rejected", input: string) => Promise<boolean>;
}) {
  const [input, setInput] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const error = attempted && !input.trim() ? "Response is required." : undefined;
  const busy = pending || submitting;

  useEffect(() => {
    setInput("");
    setAttempted(false);
    setSubmitting(false);
    submittingRef.current = false;
  }, [stepRun.stepRunId]);

  const respond = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || pending) return;
    setAttempted(true);
    if (!input.trim()) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const result = submitter?.value === "rejected" ? "rejected" : "approved";
    submittingRef.current = true;
    setSubmitting(true);
    try {
      if (await onRespond(stepRun.stepRunId, result, input)) {
        setInput("");
        setAttempted(false);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form
      className="grid gap-3 border-t border-tertiary/40 bg-card p-4"
      aria-label={`Human gate ${stepRun.stepId}`}
      noValidate
      onSubmit={(event) => void respond(event)}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLTextAreaElement && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.currentTarget.requestSubmit();
        }
      }}
    >
      <div>
        <p className="font-mono text-xs font-medium text-tertiary">Waiting for human · {stepRun.stepId}</p>
        <p className="mt-1 text-xs text-muted-foreground">Input is required before selecting the transition.</p>
      </div>
      <TextAreaField
        label="Response"
        density="compact"
        value={input}
        rows={3}
        required
        error={error}
        disabled={busy}
        onChange={(value) => {
          setInput(value);
          if (attempted && value.trim()) setAttempted(false);
        }}
      />
      <div className="flex justify-end gap-2">
        <Button type="submit" name="result" value="rejected" variant="destructive" disabled={busy}>Rejected</Button>
        <Button type="submit" name="result" value="approved" variant="secondary" disabled={busy}>Approved</Button>
      </div>
    </form>
  );
}
