import { useState, type FormEvent } from "react";
import type { RespondToNodeRunRequest } from "@shared/api/workspace-contracts";
import { SelectField, TextAreaField } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  buildHumanValidationResponse,
  type HumanRepairMode,
  type HumanValidationState
} from "./humanNodeResponse";

const initialFields = () => ({
  state: "OK" as HumanValidationState, summary: "", evidence: "{}", checks: "[]", statePatch: "",
  repairMode: "LOCAL_RETRY" as HumanRepairMode, feedback: "", expectedCorrection: "",
  reason: "", requestedCapability: "", evidenceRefs: "[]"
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
  const completed = fields.state === "OK" || fields.state === "FAIL";
  return (
    <form className="grid gap-3" aria-label="Human Validation response" onSubmit={(event) => void submit(event)}>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <SelectField label="Validation outcome" density="compact" value={fields.state} disabled={pending} onChange={(value) => setFields((current) => ({ ...current, state: value as HumanValidationState }))} options={[
        { value: "OK", label: "Completed · OK" }, { value: "FAIL", label: "Completed · FAIL" },
        { value: "blocked", label: "Blocked" }, { value: "failed", label: "Failed" }
      ]} />
      <TextAreaField label="Summary" density="compact" required value={fields.summary} disabled={pending} onChange={set("summary")} />
      {completed ? <TextAreaField label="Evidence (JSON)" density="compact" value={fields.evidence} disabled={pending} onChange={set("evidence")} /> : null}
      {fields.state === "OK" ? <TextAreaField label="State patch (JSON Patch, optional)" density="compact" value={fields.statePatch} disabled={pending} onChange={set("statePatch")} /> : null}
      {fields.state === "FAIL" ? <RepairFields fields={fields} pending={pending} set={set} setMode={(repairMode) => setFields((current) => ({ ...current, repairMode }))} /> : null}
      <TextAreaField label="Checks (JSON array)" density="compact" value={fields.checks} disabled={pending} onChange={set("checks")} />
      <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit Validation outcome"}</Button></div>
    </form>
  );
}

function RepairFields({ fields, pending, set, setMode }: {
  fields: Fields; pending: boolean;
  set: (key: keyof Fields) => (value: string) => void;
  setMode: (mode: HumanRepairMode) => void;
}) {
  return <div className="grid gap-3 border-l-2 border-tertiary/50 pl-3">
    <SelectField label="Repair mode" density="compact" value={fields.repairMode} disabled={pending} onChange={(value) => setMode(value as HumanRepairMode)} options={[
      { value: "LOCAL_RETRY", label: "Local retry" }, { value: "ORCHESTRATOR_REPAIR", label: "Orchestrator repair" }
    ]} />
    {fields.repairMode === "LOCAL_RETRY" ? <>
      <TextAreaField label="Feedback" density="compact" required value={fields.feedback} disabled={pending} onChange={set("feedback")} />
      <TextAreaField label="Expected correction" density="compact" required value={fields.expectedCorrection} disabled={pending} onChange={set("expectedCorrection")} />
    </> : <>
      <TextAreaField label="Repair reason" density="compact" required value={fields.reason} disabled={pending} onChange={set("reason")} />
      <TextAreaField label="Requested capability" density="compact" required value={fields.requestedCapability} disabled={pending} onChange={set("requestedCapability")} />
      <TextAreaField label="Evidence references (JSON array)" density="compact" value={fields.evidenceRefs} disabled={pending} onChange={set("evidenceRefs")} />
    </>}
  </div>;
}
