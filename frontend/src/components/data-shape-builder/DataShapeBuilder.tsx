import { Braces, CheckCircle2, Hash, List, Plus, ToggleLeft, Trash2, Type } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { DataShapeFieldDraft } from "backend/shared/flow";
import { Button } from "@/components/ui/button";
import { CheckboxLike } from "./CheckboxLike";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  defaultField,
  fieldErrors,
  fieldTypes,
  parseAllowedValues,
  parseFieldValue,
  valueToInput
} from "@/components/data-shape-builder/data-shape-builder-model";

export {
  defaultField,
  fieldErrors,
  fieldTypes,
  parseAllowedValues,
  parseFieldValue,
  valueToInput
} from "@/components/data-shape-builder/data-shape-builder-model";

export function DataShapeBuilder({
  fields,
  onChange,
  title = "Fields"
}: {
  fields: DataShapeFieldDraft[];
  onChange: (fields: DataShapeFieldDraft[]) => void;
  title?: string;
}) {
  const update = (index: number, patch: Partial<DataShapeFieldDraft>) => {
    onChange(fields.map((field, current) => current === index ? { ...field, ...patch } : field));
  };
  const remove = (index: number) => onChange(fields.filter((_field, current) => current !== index));
  const add = () => onChange([...fields, defaultField()]);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="size-4" />
          Add field
        </Button>
      </div>
      <div className="grid gap-2">
        {fields.length === 0 ? <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No fields yet.</p> : null}
        {fields.map((field, index) => {
          const errors = fieldErrors(field, fields, index);
          return (
            <div key={index} className="grid gap-3 rounded-lg border border-white/10 bg-black/15 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <FieldTypeIcon type={field.type} />
                <span className="font-mono text-xs text-cyan-200">{field.name || `field_${index + 1}`}</span>
                {field.required ? <span className="inline-flex items-center gap-1 rounded-sm border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[0.68rem] uppercase text-amber-100"><CheckCircle2 className="size-3" />required</span> : null}
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_10rem_6rem_auto] lg:items-end">
                <LabeledInput label="Field name" value={field.name} onChange={(name) => update(index, { name })} />
                <LabeledInput label="Display label" value={field.label ?? ""} onChange={(label) => update(index, { label })} />
                <div className="grid gap-1.5">
                  <Label>Type</Label>
                  <Select value={field.type} onValueChange={(type) => update(index, { type: type as DataShapeFieldDraft["type"] })}>
                    <SelectTrigger aria-label={`Type for ${field.label || field.name || `field ${index + 1}`}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {fieldTypes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <CheckboxLike label="Required" checked={Boolean(field.required)} onChange={(required) => update(index, { required })} />
                <Button type="button" size="icon-sm" variant="destructive" aria-label="Remove field" title="Remove field" onClick={() => remove(index)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <LabeledInput label="Description" value={field.description ?? ""} onChange={(description) => update(index, { description })} />
                <AllowedValuesInput
                  label="Allowed values"
                  values={field.allowedValues ?? []}
                  onChange={(value) => update(index, { allowedValues: parseAllowedValues(value) })}
                />
                <LabeledInput
                  label="Default"
                  value={valueToInput(field.default, field.type)}
                  placeholder={field.type === "object" ? "{\"key\":\"value\"}" : "Optional fallback"}
                  onChange={(value) => update(index, { default: parseFieldValue(value, field.type) })}
                />
                <LabeledInput
                  label="Example"
                  value={valueToInput(field.example, field.type)}
                  placeholder={field.type === "number-list" ? "1, 2, 3" : "Example value"}
                  onChange={(value) => update(index, { example: parseFieldValue(value, field.type) })}
                />
              </div>
              {errors.length ? (
                <div role="alert" className="grid gap-1 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                  {errors.map((error) => <div key={error}>{error}</div>)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AllowedValuesInput({
  label,
  values,
  onChange
}: {
  label: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(() => values.join(", "));

  useEffect(() => {
    const incoming = values.join(", ");
    const normalizedDraft = parseAllowedValues(draft).join(", ");
    if (incoming !== normalizedDraft) setDraft(incoming);
  }, [draft, values]);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={draft}
        placeholder="Approved, Changes requested"
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function FieldTypeIcon({ type }: { type: DataShapeFieldDraft["type"] }) {
  const Icon = type === "number" || type === "number-list"
    ? Hash
    : type === "boolean"
      ? ToggleLeft
      : type === "object" || type === "object-list"
        ? Braces
        : type.endsWith("-list")
          ? List
          : Type;
  return (
    <span className="grid size-8 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
      <Icon className="size-4" />
    </span>
  );
}
