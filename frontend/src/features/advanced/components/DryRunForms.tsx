import { useId } from "react";
import type { DataShapeFieldDraft } from "backend/shared/flow";
import { TextField } from "@/components/forms/FormControls";
import { ReferenceList } from "@/features/advanced/components/AdvancedPanels";
import { exampleForField, formatJson, isRecord } from "@/features/advanced/model/advanced-resource-model";

export type FieldValueDraft = Record<string, string>;

export const fieldValueDraftFromRecord = (fields: DataShapeFieldDraft[], record: Record<string, unknown>): FieldValueDraft =>
  Object.fromEntries(fields.map((field) => {
    const recordValue = record[field.name];
    const fallback = field.example ?? field.default ?? exampleForField(field);
    const value = recordValue === undefined || emptyRequiredStructuredValue(field, recordValue) ? fallback : recordValue;
    return [field.name, fieldInputValue(value, field)];
  }));

export const recordFromFieldValues = (fields: DataShapeFieldDraft[], values: FieldValueDraft, groupLabel: string): Record<string, unknown> =>
  Object.fromEntries(fields.flatMap((field) => {
    const parsed = parseFieldInput(field, values[field.name] ?? "", groupLabel);
    return parsed === undefined ? [] : [[field.name, parsed]];
  }));

export function DataValueEditor({
  title,
  fields,
  values,
  onChange,
  labelPrefix,
  emptyLabel
}: {
  title: string;
  fields: DataShapeFieldDraft[];
  values: FieldValueDraft;
  onChange: (values: FieldValueDraft) => void;
  labelPrefix: string;
  emptyLabel: string;
}) {
  const update = (fieldName: string, value: string) => onChange({ ...values, [fieldName]: value });
  return (
    <div className="grid gap-3 rounded-md border bg-background p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {fields.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <FieldValueInput
              key={field.name}
              field={field}
              label={`${labelPrefix} ${field.label || field.name}`}
              value={values[field.name] ?? ""}
              onChange={(value) => update(field.name, value)}
            />
          ))}
        </div>
      ) : <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{emptyLabel}</div>}
    </div>
  );
}

export function DryRunResultSummary({ kind, result }: { kind: "routing" | "emission"; result: unknown }) {
  if (!result) return null;
  const decisions = isRecord(result) && Array.isArray(result.decisions) ? result.decisions.filter(isRecord) : [];
  const events = isRecord(result) && Array.isArray(result.events) ? result.events.filter(isRecord) : [];
  const message = isRecord(result) && typeof result.message === "string"
    ? result.message
    : kind === "routing"
      ? `${decisions.length} routing decision${decisions.length === 1 ? "" : "s"} evaluated.`
      : `${events.length} event${events.length === 1 ? "" : "s"} emitted.`;

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3 text-sm">
      <div className="font-medium">{message}</div>
      {decisions.length ? (
        <div className="grid gap-2">
          {decisions.map((decision, index) => (
            <div key={index} className="rounded-md bg-muted/30 p-2">
              <span className="font-medium">{String(decision.policyName ?? decision.emissionPolicyId ?? decision.policyId ?? `Decision ${index + 1}`)}</span>
              {" · "}
              {String(decision.status ?? "evaluated")}
              {typeof decision.reason === "string" ? <span className="text-muted-foreground"> · {decision.reason}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      {events.length ? <ReferenceList title="Emitted events" items={events.map((event) => String(event.type ?? event.eventType ?? "Event"))} emptyLabel="No events emitted." /> : null}
      <details className="rounded-md border bg-muted/20 p-3">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Dry-run details</summary>
        <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-background p-3 text-xs">{formatJson(result)}</pre>
      </details>
    </div>
  );
}

function FieldValueInput({
  field,
  label,
  value,
  onChange
}: {
  field: DataShapeFieldDraft;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  if (field.type === "boolean" || field.allowedValues?.length) {
    const options = field.type === "boolean" ? ["true", "false"] : field.allowedValues ?? [];
    return (
      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor={id}>{label}</label>
        <select
          id={id}
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {!field.required ? <option value="">No value</option> : null}
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
    );
  }
  if (field.type === "object" || field.type === "object-list") {
    return (
      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor={id}>{label}</label>
        <textarea
          id={id}
          className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
          value={value}
          placeholder={field.type === "object-list" ? "name=npm test, status=passed" : "key=value, status=passed"}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="text-xs text-muted-foreground">
          {field.type === "object-list" ? "Use one item per line with key=value pairs." : "Use key=value pairs separated by commas."}
        </div>
      </div>
    );
  }
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      type={field.type === "number" ? "number" : "text"}
      placeholder={field.type === "text-list" || field.type === "number-list" ? "Comma-separated values" : undefined}
    />
  );
}

const fieldInputValue = (value: unknown, field: DataShapeFieldDraft): string => {
  if (value === undefined) return "";
  if (field.type === "object") return typeof value === "string" ? value : keyValueLineFromRecord(value);
  if (field.type === "object-list") return Array.isArray(value)
    ? value.map(keyValueLineFromRecord).filter(Boolean).join("\n")
    : typeof value === "string" ? value : keyValueLineFromRecord(value);
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
};

const scalarFromText = (value: string): string | number | boolean => {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  const numberValue = Number(trimmed);
  return trimmed && Number.isFinite(numberValue) ? numberValue : trimmed;
};

const keyValueLineFromRecord = (value: unknown): string => {
  if (!isRecord(value)) return "";
  return Object.entries(value)
    .map(([key, child]) => `${key}=${Array.isArray(child) || isRecord(child) ? JSON.stringify(child) : String(child)}`)
    .join(", ");
};

const recordFromKeyValueLine = (value: string, label: string): Record<string, unknown> => {
  const entries = value.split(/[,;]\s*/).map((entry) => entry.trim()).filter(Boolean);
  if (!entries.length) return {};
  const record: Record<string, unknown> = {};
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator <= 0) throw new Error(`${label} must use key=value pairs.`);
    const key = entry.slice(0, separator).trim();
    const raw = entry.slice(separator + 1).trim();
    if (!key) throw new Error(`${label} contains an empty key.`);
    record[key] = scalarFromText(raw);
  }
  return record;
};

const emptyRequiredStructuredValue = (field: DataShapeFieldDraft, value: unknown): boolean =>
  Boolean(field.required) && (
    (Array.isArray(value) && value.length === 0) ||
    (isRecord(value) && Object.keys(value).length === 0)
  );

const parseFieldInput = (field: DataShapeFieldDraft, raw: string, groupLabel: string): unknown => {
  const value = raw.trim();
  const fieldLabel = field.label || field.name;
  if (!value) {
    if (field.required) throw new Error(`${groupLabel}: ${fieldLabel} is required.`);
    return undefined;
  }
  if (field.type === "number") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${groupLabel}: ${fieldLabel} must be a number.`);
    return parsed;
  }
  if (field.type === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error(`${groupLabel}: ${fieldLabel} must be true or false.`);
  }
  if (field.type === "text-list") return value.split(",").map((item) => item.trim()).filter(Boolean);
  if (field.type === "number-list") {
    const values = value.split(",").map((item) => item.trim()).filter(Boolean);
    const numbers = values.map(Number);
    if (!numbers.every(Number.isFinite)) throw new Error(`${groupLabel}: ${fieldLabel} must be a comma-separated number list.`);
    return numbers;
  }
  if (field.type === "object" || field.type === "object-list") {
    if (field.type === "object") return recordFromKeyValueLine(value, `${groupLabel}: ${fieldLabel}`);
    const records = value.split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) =>
      recordFromKeyValueLine(line, `${groupLabel}: ${fieldLabel}`)
    );
    return records;
  }
  return raw;
};
