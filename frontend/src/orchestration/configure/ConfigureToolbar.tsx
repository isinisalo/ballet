import type { ReactNode } from "react";
import { OperationalStatus } from "@/components/shared/workspace-ui";

export function ConfigureToolbar({ label, status, children }: { label?: ReactNode; status?: string; children?: ReactNode }) {
  return <div data-slot="configure-toolbar" role="toolbar" aria-label="Workspace actions" className="sticky top-0 z-20 flex min-h-12 min-w-0 items-center gap-3 overflow-x-auto border-b border-border bg-background/95 px-4 py-1.5 backdrop-blur md:px-6">
    <div className="flex min-w-max items-center gap-2">{status ? <OperationalStatus compact label={status} tone={tone(status)} /> : null}{label ? <span className="font-mono text-xs text-muted-foreground">{label}</span> : null}</div>
    <div className="ml-auto flex min-w-max items-center gap-2 [&_[data-slot=button]]:min-h-10 md:[&_[data-slot=button]]:min-h-8">{children}</div>
  </div>;
}

const tone = (status: string): "healthy" | "attention" | "danger" | "neutral" =>
  status.includes("Locked") ? "attention"
    : status.includes("Not ready") || status.includes("Invalid") || status.includes("blocked") ? "danger"
      : status.includes("pending") || status.includes("draft") || status.includes("Unsaved") ? "attention"
        : status.includes("Ready") || status.includes("Saved") || status.includes("approved") ? "healthy" : "neutral";
