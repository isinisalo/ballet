import type { ReactNode } from "react";

export function SimpleFlowBoundaryEditor({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 rounded-md border bg-background p-3">{children}</div>;
}
