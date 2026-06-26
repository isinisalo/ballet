import type { DataShapeFieldDraft, SafeDeleteResult } from "backend/shared/flow";
import { DiagnosticsList } from "@/components/diagnostics/DiagnosticsList";

export function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={mono ? "break-all font-mono text-xs" : "break-words text-sm"}>{value}</div>
    </div>
  );
}

export function SafeDeletePanel({ result, targetName }: { result: SafeDeleteResult; targetName: string }) {
  return (
    <div className={result.allowed ? "rounded-md border bg-background p-3 text-sm" : "rounded-md border border-destructive bg-destructive/10 p-3 text-sm"}>
      <div className="font-medium">{result.allowed ? `${targetName} is safe to delete` : `${targetName} cannot be deleted yet`}</div>
      <div className="mt-1 text-muted-foreground">
        {result.allowed
          ? "No current resources reference it."
          : `Referenced by ${result.references.map((reference) => reference.label).join(", ")}.`}
      </div>
      {result.diagnostics.length ? <div className="mt-3"><DiagnosticsList diagnostics={result.diagnostics} /></div> : null}
    </div>
  );
}

export function AdvancedSource({ value }: { value: unknown }) {
  return (
    <details className="rounded-md border bg-muted/20 p-3">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Advanced source</summary>
      <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-background p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

export function PanelHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid gap-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

export function FieldList({ fields, emptyLabel }: { fields: DataShapeFieldDraft[]; emptyLabel: string }) {
  if (!fields.length) return <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">{emptyLabel}</div>;
  return (
    <div className="grid gap-2">
      {fields.map((field) => (
        <div key={field.name} className="grid gap-2 rounded-md border bg-muted/20 p-3 text-sm md:grid-cols-[1fr_8rem_6rem_1.5fr]">
          <div>
            <div className="font-medium">{field.label || field.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{field.name}</div>
          </div>
          <div>{field.type}</div>
          <div>{field.required ? "Required" : "Optional"}</div>
          <div className="text-muted-foreground">
            {field.description || (field.example !== undefined ? `Example: ${String(field.example)}` : "No description.")}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReferenceList({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3 text-sm">
      <div className="font-medium">{title}</div>
      {items.length ? (
        <ul className="mt-2 grid gap-1">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : <div className="mt-2 text-muted-foreground">{emptyLabel}</div>}
    </div>
  );
}

export function FlowStep({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{title}</div>
      <div className="mt-2 grid gap-1">
        {items.length ? items.map((item) => <div key={item} className="font-medium">{item}</div>) : <div className="text-muted-foreground">{emptyLabel}</div>}
      </div>
    </div>
  );
}
