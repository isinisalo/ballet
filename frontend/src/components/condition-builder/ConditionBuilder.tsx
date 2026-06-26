import { Plus, Trash2 } from "lucide-react";
import type { DataShapeFieldDraft } from "backend/shared/flow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  conditionDraftSummary,
  defaultLeafDraft,
  isLeafDraft,
  opLabels,
  type ConditionDraft,
  type ConditionOperator,
  type GroupConditionDraft,
  type LeafConditionDraft
} from "@/components/condition-builder/condition-builder-model";

export {
  conditionDraftSummary,
  conditionDraftToCondition,
  conditionToConditionDraft
} from "@/components/condition-builder/condition-builder-model";
export type {
  ConditionDraft,
  ConditionOperator,
  GroupConditionDraft,
  LeafConditionDraft,
  NotConditionDraft
} from "@/components/condition-builder/condition-builder-model";

export function ConditionBuilder({
  fields,
  value,
  onChange,
  rootLabel = "Result field"
}: {
  fields: DataShapeFieldDraft[];
  value: ConditionDraft;
  onChange: (value: ConditionDraft) => void;
  rootLabel?: string;
}) {
  const updateKind = (kind: "leaf" | "all" | "any" | "not") => {
    if (kind === "leaf") return onChange(isLeafDraft(value) ? value : defaultLeafDraft(fields));
    if (kind === "not") {
      return onChange({
        kind: "not",
        condition: value.kind === "not" ? value.condition : isLeafDraft(value) ? value : defaultLeafDraft(fields)
      });
    }
    return onChange({
      kind,
      conditions: value.kind === kind ? value.conditions : [isLeafDraft(value) ? value : defaultLeafDraft(fields)]
    });
  };
  const selectedKind = isLeafDraft(value) ? "leaf" : value.kind;

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 md:grid-cols-[12rem_1fr] md:items-end">
        <div className="grid gap-1.5">
          <Label>Match</Label>
          <Select value={selectedKind} onValueChange={(kind) => updateKind(kind as "leaf" | "all" | "any" | "not")}>
            <SelectTrigger aria-label="Match"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="leaf">One condition</SelectItem>
                <SelectItem value="all">All conditions</SelectItem>
                <SelectItem value="any">Any condition</SelectItem>
                <SelectItem value="not">Not condition</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-md border bg-muted/20 p-2 text-sm">{conditionDraftSummary(value, fields)}</div>
      </div>
      {isLeafDraft(value) ? (
        <LeafConditionEditor fields={fields} value={value} onChange={onChange} rootLabel={rootLabel} />
      ) : value.kind === "not" ? (
        <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
          <ConditionBuilder fields={fields} value={value.condition} onChange={(condition) => onChange({ ...value, condition })} rootLabel={rootLabel} />
        </div>
      ) : (
        <ConditionGroupEditor fields={fields} value={value} onChange={onChange} rootLabel={rootLabel} />
      )}
    </div>
  );
}

function LeafConditionEditor({
  fields,
  value,
  onChange,
  rootLabel
}: {
  fields: DataShapeFieldDraft[];
  value: LeafConditionDraft;
  onChange: (value: ConditionDraft) => void;
  rootLabel: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_12rem_1fr] md:items-end">
      <div className="grid gap-1.5">
        <Label>{rootLabel}</Label>
        <Select value={value.field} onValueChange={(field) => onChange({ ...value, field })}>
          <SelectTrigger aria-label={rootLabel}><SelectValue placeholder="Choose field" /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {fields.map((field) => <SelectItem key={field.name} value={field.name}>{field.label || field.name}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Condition</Label>
        <Select value={value.op} onValueChange={(op) => onChange({ ...value, op: op as ConditionOperator })}>
          <SelectTrigger aria-label="Condition"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {opLabels.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Value</Label>
        <Input value={value.value} disabled={value.op === "exists"} onChange={(event) => onChange({ ...value, value: event.target.value })} />
      </div>
    </div>
  );
}

function ConditionGroupEditor({
  fields,
  value,
  onChange,
  rootLabel
}: {
  fields: DataShapeFieldDraft[];
  value: GroupConditionDraft;
  onChange: (value: ConditionDraft) => void;
  rootLabel: string;
}) {
  const updateChild = (index: number, condition: ConditionDraft) => {
    onChange({
      ...value,
      conditions: value.conditions.map((current, currentIndex) => currentIndex === index ? condition : current)
    });
  };
  const removeChild = (index: number) => {
    const remaining = value.conditions.filter((_condition, currentIndex) => currentIndex !== index);
    onChange({
      ...value,
      conditions: remaining.length ? remaining : [defaultLeafDraft(fields)]
    });
  };
  const addChild = () => {
    onChange({ ...value, conditions: [...value.conditions, defaultLeafDraft(fields)] });
  };

  return (
    <div className="grid gap-2">
      {value.conditions.map((condition, index) => (
        <div key={index} className="grid gap-2 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Condition {index + 1}</div>
            <Button type="button" size="icon-sm" variant="destructive" aria-label={`Remove condition ${index + 1}`} title={`Remove condition ${index + 1}`} onClick={() => removeChild(index)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
          <ConditionBuilder fields={fields} value={condition} onChange={(next) => updateChild(index, next)} rootLabel={rootLabel} />
        </div>
      ))}
      <div>
        <Button type="button" size="sm" variant="outline" onClick={addChild}>
          <Plus className="size-4" />
          Add condition
        </Button>
      </div>
    </div>
  );
}
