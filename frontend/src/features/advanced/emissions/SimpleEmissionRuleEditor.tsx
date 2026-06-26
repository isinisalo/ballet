import type { ReactNode } from "react";

export function SimpleEmissionRuleEditor({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 rounded-lg border border-border bg-card p-3">{children}</div>;
}
