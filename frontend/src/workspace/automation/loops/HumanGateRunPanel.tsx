import { useEffect, useState } from "react";
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

  useEffect(() => setInput(""), [stepRun.stepRunId]);

  const respond = async (result: "approved" | "rejected") => {
    if (!input.trim()) return;
    if (await onRespond(stepRun.stepRunId, result, input)) setInput("");
  };

  return (
    <section className="grid gap-3 border-t border-tertiary/40 bg-card p-4" aria-label={`Human gate ${stepRun.stepId}`}>
      <div>
        <p className="font-mono text-xs font-medium text-tertiary">Waiting for human · {stepRun.stepId}</p>
        <p className="mt-1 text-xs text-muted-foreground">Input is required before selecting the transition.</p>
      </div>
      <TextAreaField label="Response" value={input} rows={3} required disabled={pending} onChange={setInput} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="destructive" disabled={pending || !input.trim()} onClick={() => void respond("rejected")}>Rejected</Button>
        <Button type="button" variant="secondary" disabled={pending || !input.trim()} onClick={() => void respond("approved")}>Approved</Button>
      </div>
    </section>
  );
}
