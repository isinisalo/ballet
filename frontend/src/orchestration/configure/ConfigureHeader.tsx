import type { ReactNode } from "react";
import { OperationalStatus } from "@/components/shared/workspace-ui";

export function ConfigureHeader({ eyebrow = "Configure", title, description, status, actions }: {
  eyebrow?: string; title: string; description: string; status?: string; actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border bg-panel-header px-4 py-5 md:flex-row md:items-end md:justify-between md:px-6">
      <div className="min-w-0"><div className="font-mono text-[0.68rem] uppercase tracking-wider text-tertiary">{eyebrow}</div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p></div>
      <div className="flex flex-wrap items-center gap-2">{status ? <OperationalStatus label={status} tone={statusTone(status)} /> : null}{actions}</div>
    </header>
  );
}

const statusTone = (status: string): "healthy" | "attention" | "danger" | "neutral" =>
  status.includes("Locked") ? "attention"
    : status.includes("Not ready") || status.includes("Invalid") || status.includes("blocked") ? "danger"
      : status.includes("pending") || status.includes("draft") ? "attention"
        : status.includes("Ready") || status.includes("completed") || status.includes("approved") ? "healthy" : "neutral";

export function IssueList({ issues }: { issues: Array<{ path?: string; message?: string }> }) {
  if (issues.length === 0) return <p className="text-sm text-secondary">Ready · no validation issues.</p>;
  return <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3"><strong>{issues.length} readiness issue{issues.length === 1 ? "" : "s"}</strong><ul className="mt-2 list-disc pl-5 text-sm">{issues.map((issue, index) => <li key={`${issue.path}-${index}`}><code>{issue.path}</code> {issue.message}</li>)}</ul></div>;
}
