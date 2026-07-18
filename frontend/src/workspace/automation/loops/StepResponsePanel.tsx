import { useEffect, useRef, useState, type FormEvent } from "react";
import type { RespondToStepRunRequest, StepRun } from "@shared/api/workspace-contracts";
import { TextAreaField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";

export function StepResponsePanel({
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
  const needsInput = stepRun.type === "agent" && stepRun.status === "needs_input";
  const error = attempted && !input.trim() ? "Response is required." : undefined;
  const busy = pending || submitting;

  useEffect(() => {
    setInput("");
    setAttempted(false);
    setSubmitting(false);
    submittingRef.current = false;
  }, [stepRun.stepRunId, stepRun.updatedAt]);

  const respond = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || pending) return;
    setAttempted(true);
    if (!input.trim()) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const request: RespondToStepRunRequest = needsInput
      ? { kind: "resume", input }
      : {
          kind: "human",
          result: submitter?.value === "rejected" ? "rejected" : "approved",
          input
        };
    submittingRef.current = true;
    setSubmitting(true);
    try {
      if (await onRespond(stepRun.stepRunId, request)) {
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
      aria-label={needsInput ? `Agent input ${stepRun.stepId}` : `Human gate ${stepRun.stepId}`}
      noValidate
      onSubmit={(event) => void respond(event)}
      onKeyDown={(event) => {
        if (needsInput && event.target instanceof HTMLTextAreaElement && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.currentTarget.requestSubmit();
        }
      }}
    >
      <div>
        <p className="font-mono text-xs font-medium text-tertiary">
          {needsInput ? "Input needed" : "Waiting for human"} · {stepRun.stepId}
        </p>
        {needsInput && stepRun.outcome?.state === "needs_input" ? (
          <div className="mt-2 grid gap-2 text-xs">
            <p className="whitespace-pre-wrap text-foreground">{stepRun.outcome.question}</p>
            <p className="whitespace-pre-wrap text-muted-foreground">{stepRun.outcome.context}</p>
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Input is required before selecting the transition.</p>
        )}
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
        {needsInput ? (
          <Button type="submit" disabled={busy}>Continue step</Button>
        ) : (
          <>
            <Button type="submit" name="result" value="rejected" variant="destructive" disabled={busy}>Rejected</Button>
            <Button type="submit" name="result" value="approved" variant="secondary" disabled={busy}>Approved</Button>
          </>
        )}
      </div>
    </form>
  );
}
