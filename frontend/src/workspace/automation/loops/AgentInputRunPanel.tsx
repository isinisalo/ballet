import { useEffect, useRef, useState, type FormEvent } from "react";
import type { RespondToStepRunRequest, StepRun } from "@shared/api/workspace-contracts";
import { TextAreaField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";

export function AgentInputRunPanel({
  stepRun,
  pending,
  onRespond
}: {
  stepRun: StepRun;
  pending: boolean;
  onRespond: (stepRunId: string, request: RespondToStepRunRequest) => Promise<boolean>;
}) {
  const [input, setInput] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const error = attempted && !input.trim() ? "Input is required." : undefined;
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
    submittingRef.current = true;
    setSubmitting(true);
    try {
      if (await onRespond(stepRun.stepRunId, { kind: "agent-input", input })) {
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
      aria-label={`Agent input ${stepRun.stepId}`}
      noValidate
      onSubmit={(event) => void respond(event)}
    >
      <div>
        <p className="font-mono text-xs font-medium text-tertiary">Additional input required · {stepRun.stepId}</p>
        <p className="mt-1 text-xs text-muted-foreground">Answer the agent request to resume this step.</p>
      </div>
      <TextAreaField
        label="Additional input"
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
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={busy}>Resume agent</Button>
      </div>
    </form>
  );
}
