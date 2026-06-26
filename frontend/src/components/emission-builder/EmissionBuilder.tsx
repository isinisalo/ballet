import type { DataShapeFieldDraft } from "backend/shared/flow";
import type { Condition } from "backend/shared/conditions";
import { useId } from "react";
import { ConditionBuilder } from "@/components/condition-builder/ConditionBuilder";
import { conditionDraftToCondition, type ConditionDraft } from "@/components/condition-builder/condition-builder-model";
import { DataShapeBuilder } from "@/components/data-shape-builder/DataShapeBuilder";
import { TextField, TextAreaField } from "@/components/forms/FormControls";

export interface ResultBranchDraft {
  eventId?: string;
  eventName: string;
  eventDescription: string;
  fields: DataShapeFieldDraft[];
  condition: ConditionDraft;
  subjectField: string;
  requireSummaryGate: boolean;
  onGateFailure: "skip" | "fail_run";
}

export interface EmissionEventOption {
  id: string;
  name: string;
  description?: string;
  fields: DataShapeFieldDraft[];
}

export const defaultResultBranch = (): ResultBranchDraft => ({
  eventName: "Completed",
  eventDescription: "Published when the task completes.",
  fields: [{ name: "summary", type: "text", required: true }],
  condition: { field: "decision", op: "eq", value: "approved" },
  subjectField: "subject",
  requireSummaryGate: true,
  onGateFailure: "fail_run"
});

export const branchCondition = (branch: ResultBranchDraft): Condition | undefined =>
  conditionDraftToCondition(branch.condition);

const cloneFields = (fields: DataShapeFieldDraft[]) =>
  fields.map((field) => ({
    ...field,
    ...(field.allowedValues ? { allowedValues: [...field.allowedValues] } : {})
  }));

export function EmissionBuilder({
  branch,
  eventOptions = [],
  inputFields = [],
  resultFields,
  onChange
}: {
  branch: ResultBranchDraft;
  eventOptions?: EmissionEventOption[];
  inputFields?: DataShapeFieldDraft[];
  resultFields: DataShapeFieldDraft[];
  onChange: (branch: ResultBranchDraft) => void;
}) {
  const generatedId = useId();
  const eventSourceId = `emission-event-source-${generatedId}`;
  const subjectSourceId = `emission-subject-source-${generatedId}`;
  const gateFailureId = `emission-gate-failure-${generatedId}`;
  const subjectOptions = inputFields.filter((field) => field.type === "text" || field.type === "number" || field.type === "boolean");
  const selectedSubjectField = subjectOptions.some((field) => field.name === branch.subjectField)
    ? branch.subjectField
    : subjectOptions[0]?.name || "subject";
  const chooseEvent = (eventId: string) => {
    const selected = eventOptions.find((event) => event.id === eventId);
    onChange({
      ...branch,
      eventId: eventId || undefined,
      ...(selected
        ? {
            eventName: selected.name,
            eventDescription: selected.description ?? branch.eventDescription,
            fields: cloneFields(selected.fields)
          }
        : {})
    });
  };
  return (
    <div className="grid gap-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
      {eventOptions.length ? (
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor={eventSourceId}>Event to publish</label>
          <select
            id={eventSourceId}
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={branch.eventId ?? ""}
            onChange={(event) => chooseEvent(event.target.value)}
          >
            <option value="">Create a new event</option>
            {eventOptions.map((event) => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Published event" value={branch.eventName} onChange={(eventName) => onChange({ ...branch, eventName })} />
        <TextAreaField label="Event description" rows={2} value={branch.eventDescription} onChange={(eventDescription) => onChange({ ...branch, eventDescription })} />
      </div>
      <ConditionBuilder
        fields={resultFields}
        value={branch.condition}
        onChange={(condition) => onChange({ ...branch, condition })}
      />
      <DataShapeBuilder
        title="Event data"
        fields={branch.fields}
        onChange={(fields) => onChange({ ...branch, fields })}
      />
      <div className="grid gap-4 rounded-md border border-white/10 bg-black/15 p-3">
        <div className="grid gap-1">
          <h3 className="text-sm font-medium">Publishing behavior</h3>
          <p className="text-sm leading-6 text-muted-foreground">Configure the business event that continues or completes the Flow after this result branch.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor={subjectSourceId}>Subject source</label>
            <select
              id={subjectSourceId}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={selectedSubjectField}
              onChange={(event) => onChange({ ...branch, subjectField: event.target.value })}
            >
              {subjectOptions.length ? subjectOptions.map((field) => (
                <option key={field.name} value={field.name}>{field.label || field.name}</option>
              )) : <option value="subject">Flow subject</option>}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor={gateFailureId}>Gate failure behavior</label>
            <select
              id={gateFailureId}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={branch.onGateFailure}
              onChange={(event) => onChange({ ...branch, onGateFailure: event.target.value as ResultBranchDraft["onGateFailure"] })}
            >
              <option value="fail_run">Fail this run</option>
              <option value="skip">Skip publishing this event</option>
            </select>
          </div>
        </div>
        <label className="flex items-start gap-2 rounded-md border border-white/10 bg-black/20 p-3 text-sm">
          <input
            aria-label="Require summary before publishing"
            className="mt-1"
            type="checkbox"
            checked={branch.requireSummaryGate}
            onChange={(event) => onChange({ ...branch, requireSummaryGate: event.target.checked })}
          />
          <span>
            <span className="block font-medium">Require summary before publishing</span>
            <span className="block leading-6 text-muted-foreground">Verify that the agent returned a summary before publishing the event.</span>
          </span>
        </label>
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <BranchFact label="Subject mapping" value={`Agent input ${selectedSubjectField}`} />
          <BranchFact label="Technical check" value={branch.requireSummaryGate ? "Require a summary" : "No summary gate"} />
          <BranchFact label="Deduplication" value="Run and branch scoped" />
        </div>
      </div>
    </div>
  );
}

function BranchFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="break-words text-sm">{value}</div>
    </div>
  );
}
