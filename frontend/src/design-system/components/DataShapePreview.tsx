import type { ReactNode } from "react";
import type { DataShapeFieldDraft } from "backend/shared/flow";
import { StatusPill } from "./StatusPill";
import { cn } from "@/lib/utils";

export function KeyValueGrid({
  rows
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-1 rounded-md border border-white/10 bg-black/15 p-2 text-sm sm:grid-cols-[0.36fr_0.64fr]">
          <span className="text-[0.68rem] font-semibold uppercase text-muted-foreground">{row.label}</span>
          <span className="min-w-0 break-words text-slate-200">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DataShapePreview({
  fields,
  empty = "No data fields defined.",
  compact
}: {
  fields: Array<Pick<DataShapeFieldDraft, "name" | "label" | "description" | "type" | "required">>;
  empty?: string;
  compact?: boolean;
}) {
  if (!fields.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className={cn("grid gap-2", compact && "gap-1.5")}>
      {fields.map((field) => (
        <div key={field.name} className="grid gap-2 rounded-md border border-white/10 bg-black/15 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-cyan-200">{field.name}</span>
            <StatusPill tone="accent">{field.type}</StatusPill>
            {field.required ? <StatusPill tone="warning">required</StatusPill> : null}
          </div>
          <div className="text-sm font-medium text-slate-100">{field.label ?? field.name}</div>
          {field.description ? <p className="text-xs leading-5 text-muted-foreground">{field.description}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function MappingPreview({
  rows
}: {
  rows: Array<{ target: string; source: string }>;
}) {
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={`${row.target}-${row.source}`} className="grid items-center gap-2 rounded-md border border-white/10 bg-black/15 p-2 text-sm sm:grid-cols-[minmax(0,0.36fr)_auto_minmax(0,0.64fr)]">
          <span className="font-mono text-xs text-emerald-200">{row.target}</span>
          <span className="text-muted-foreground">&larr;</span>
          <span className="min-w-0 break-words text-slate-200">{row.source}</span>
        </div>
      ))}
    </div>
  );
}
