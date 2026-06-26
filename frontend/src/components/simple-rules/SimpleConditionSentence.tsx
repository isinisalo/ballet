import type { DataShapeFieldDraft } from "backend/shared/flow";

export type SimpleConditionOperator = "eq" | "neq" | "exists" | "contains" | "gt" | "lt";

export function SimpleConditionSentence({
  rootLabel,
  fields,
  field,
  operator,
  value,
  onFieldChange,
  onOperatorChange,
  onValueChange
}: {
  rootLabel: string;
  fields: DataShapeFieldDraft[];
  field: string;
  operator: SimpleConditionOperator;
  value: string;
  onFieldChange: (field: string) => void;
  onOperatorChange: (operator: SimpleConditionOperator) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
      <div className="text-sm font-medium">Route only when</div>
      <div className="grid gap-2 md:grid-cols-[1fr_10rem_1fr]">
        <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label={`${rootLabel} field`} value={field} onChange={(event) => onFieldChange(event.target.value)}>
          {fields.map((item) => <option key={item.name} value={item.name}>{item.label || item.name}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Condition operator" value={operator} onChange={(event) => onOperatorChange(event.target.value as SimpleConditionOperator)}>
          <option value="eq">is</option>
          <option value="neq">is not</option>
          <option value="exists">exists</option>
          <option value="contains">contains</option>
          <option value="gt">greater than</option>
          <option value="lt">less than</option>
        </select>
        <input
          className="h-10 rounded-md border bg-background px-3 text-sm"
          aria-label="Condition value"
          value={value}
          disabled={operator === "exists"}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </div>
    </div>
  );
}
