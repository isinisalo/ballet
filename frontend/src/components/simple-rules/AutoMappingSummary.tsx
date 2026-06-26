export interface AutoMappingSummaryRow {
  targetField: string;
  sourceLabel: string;
  required: boolean;
  status: "mapped" | "defaulted" | "missing" | "custom";
}

export function AutoMappingSummary({
  title,
  rows,
  emptyLabel = "No data fields are required."
}: {
  title: string;
  rows: AutoMappingSummaryRow[];
  emptyLabel?: string;
}) {
  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {rows.length ? (
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.targetField} className="grid gap-1 text-sm sm:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]">
              <div className="font-medium">{row.targetField}{row.required ? <span className="text-muted-foreground"> *</span> : null}</div>
              <div className={row.status === "missing" ? "text-destructive" : "text-muted-foreground"}>{row.sourceLabel}</div>
            </div>
          ))}
        </div>
      ) : <div className="text-sm text-muted-foreground">{emptyLabel}</div>}
    </div>
  );
}
