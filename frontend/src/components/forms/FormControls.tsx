import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  const generatedId = useId();
  const id = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${generatedId}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} required={required} placeholder={placeholder} type={type} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  required,
  rows = 4,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const generatedId = useId();
  const id = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${generatedId}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={value} required={required} rows={rows} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function Section({
  title,
  description,
  children,
  className
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid content-start gap-4 rounded-lg border bg-card p-4 text-card-foreground", className)}>
      {title || description ? (
        <div className="grid gap-1">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
          {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-3 rounded-lg border border-dashed bg-muted/20 p-8 text-center">
      <p className="text-sm text-muted-foreground">{title}</p>
      {action}
    </div>
  );
}

export function TechnicalDetails({ children }: { children: ReactNode }) {
  return (
    <details className="rounded-md border bg-muted/20 p-3">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Technical details</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function IconButtonLabel({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export { Button };
