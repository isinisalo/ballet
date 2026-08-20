import { useState, type FormEvent } from "react";
import type { RespondToNodeRunRequest } from "@shared/api/workspace-contracts";
import { SelectField, TextAreaField } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  buildHumanValidationResponse,
  type HumanEscalationKind,
  type HumanValidationState
} from "./humanNodeResponse";

const initialFields = () => ({
  state: "PASS" as HumanValidationState, summary: "", evidence: "{}", checks: "[]", statePatch: "",
  feedback: "", expectedCorrection: "", escalationKind: "capability" as HumanEscalationKind,
  reason: "", requestedCapability: "", requestedOutcome: "{}", evidenceRefs: "[]"
});
type Fields = ReturnType<typeof initialFields>;

export function HumanValidationResponseForm({ pending, onRespond }: {
  pending: boolean;
  onRespond: (request: RespondToNodeRunRequest) => Promise<boolean>;
}) {
  const [fields, setFields] = useState(initialFields);
  const [error, setError] = useState("");
  const set = (key: keyof Fields) => (value: string) => setFields((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    try { await onRespond(buildHumanValidationResponse(fields)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const completed = fields.state === "PASS" || fields.state === "FAIL";
  return (
    <form className="grid gap-3" aria-label="Human Validation response" onSubmit={(event) => void submit(event)}>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <SelectField label="Validation outcome" density="compact" value={fields.state} disabled={pending} onChange={(value) => setFields((current) => ({ ...current, state: value as HumanValidationState }))} options={[
        { value: "PASS", label: "Completed · PASS" }, { value: "FAIL", label: "Completed · FAIL" },
        { value: "blocked", label: "Blocked" }, { value: "failed", label: "Failed" }
      ]} />
      <TextAreaField label="Summary" density="compact" required value={fields.summary} disabled={pending} onChange={set("summary")} />
      {completed ? <TextAreaField label="Evidence (JSON)" density="compact" value={fields.evidence} disabled={pending} onChange={set("evidence")} /> : null}
      {fields.state === "PASS" ? <TextAreaField label="State patch (JSON Patch, optional)" density="compact" value={fields.statePatch} disabled={pending} onChange={set("statePatch")} /> : null}
      {fields.state === "FAIL" ? <EscalationFields fields={fields} pending={pending} set={set} setKind={(escalationKind) => setFields((current) => ({ ...current, escalationKind }))} /> : null}
      <TextAreaField label="Checks (JSON array)" density="compact" value={fields.checks} disabled={pending} onChange={set("checks")} />
      <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit Validation outcome"}</Button></div>
    </form>
  );
}

function EscalationFields({ fields, pending, set, setKind }: {
  fields: Fields; pending: boolean;
  set: (key: keyof Fields) => (value: string) => void;
  setKind: (kind: HumanEscalationKind) => void;
}) {
  return <div className="grid gap-3 border-l-2 border-tertiary/50 pl-3">
    <TextAreaField label="Feedback" density="compact" required value={fields.feedback} disabled={pending} onChange={set("feedback")} />
    <TextAreaField label="Expected correction" density="compact" required value={fields.expectedCorrection} disabled={pending} onChange={set("expectedCorrection")} />
    <TextAreaField label="Escalation reason" density="compact" required value={fields.reason} disabled={pending} onChange={set("reason")} />
    <SelectField label="Escalation request" density="compact" value={fields.escalationKind} disabled={pending} onChange={(value) => setKind(value as HumanEscalationKind)} options={[
      { value: "capability", label: "Requested capability" }, { value: "outcome", label: "Requested outcome" }
    ]} />
    {fields.escalationKind === "capability"
      ? <TextAreaField label="Requested capability" density="compact" required value={fields.requestedCapability} disabled={pending} onChange={set("requestedCapability")} />
      : <TextAreaField label="Requested outcome (JSON)" density="compact" required value={fields.requestedOutcome} disabled={pending} onChange={set("requestedOutcome")} />}
    <TextAreaField label="Evidence references (JSON array)" density="compact" value={fields.evidenceRefs} disabled={pending} onChange={set("evidenceRefs")} />
  </div>;
}
