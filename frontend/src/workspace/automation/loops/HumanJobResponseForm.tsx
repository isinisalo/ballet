import { useState, type FormEvent } from "react";
import type { RespondToNodeRunRequest } from "@shared/api/workspace-contracts";
import { SelectField, TextAreaField } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buildHumanJobResponse, type HumanJobState } from "./humanNodeResponse";

export function HumanJobResponseForm({ pending, onRespond }: {
  pending: boolean;
  onRespond: (request: RespondToNodeRunRequest) => Promise<boolean>;
}) {
  const [state, setState] = useState<HumanJobState>("completed");
  const [summary, setSummary] = useState("");
  const [artifacts, setArtifacts] = useState("{}");
  const [checks, setChecks] = useState("[]");
  const [statePatch, setStatePatch] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    try { await onRespond(buildHumanJobResponse({ state, summary, artifacts, checks, statePatch })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };

  return (
    <form className="grid gap-3" aria-label="Human Job response" onSubmit={(event) => void submit(event)}>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <SelectField label="Job outcome" density="compact" value={state} disabled={pending} onChange={(value) => setState(value as HumanJobState)} options={[
        { value: "completed", label: "Completed" }, { value: "blocked", label: "Blocked" }, { value: "failed", label: "Failed" }
      ]} />
      <TextAreaField label="Summary" density="compact" required value={summary} disabled={pending} onChange={setSummary} />
      {state === "completed" ? <>
        <TextAreaField label="Artifacts (JSON object)" density="compact" value={artifacts} disabled={pending} onChange={setArtifacts} />
        <TextAreaField label="State patch (JSON Patch, optional)" density="compact" value={statePatch} disabled={pending} onChange={setStatePatch} />
      </> : null}
      <TextAreaField label="Checks (JSON array)" density="compact" value={checks} disabled={pending} onChange={setChecks} />
      <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit Job outcome"}</Button></div>
    </form>
  );
}
