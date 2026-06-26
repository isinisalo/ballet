import type { ReactNode } from "react";

export function AdvancedDisclosure({
  title = "Advanced details",
  description,
  children
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <details className="rounded-md border bg-muted/20 p-3">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">{title}</summary>
      {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      <div className="mt-3 grid gap-3">{children}</div>
    </details>
  );
}
