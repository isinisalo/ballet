import { cn } from "@/lib/utils";
import type { Agent, AgentExecutionState } from "@shared/api/workspace-contracts";
import { providerLabel } from "../runtimes/runtimeRegistry";

const statusLabel: Record<AgentExecutionState["status"], string> = {
  running: "Running",
  idle: "Idle",
  busy: "Busy",
  attention: "Needs attention",
  unbound: "Unbound",
  offline: "Offline"
};

const statusClass: Record<AgentExecutionState["status"], string> = {
  running: "border-secondary/30 bg-secondary/10 text-secondary",
  idle: "border-tertiary/30 bg-tertiary/10 text-tertiary",
  busy: "border-tertiary/30 bg-tertiary/10 text-tertiary",
  attention: "border-tertiary/30 bg-tertiary/10 text-tertiary",
  unbound: "border-muted-foreground/25 bg-muted text-muted-foreground",
  offline: "border-muted-foreground/25 bg-muted text-muted-foreground"
};

const statusDotClass: Record<AgentExecutionState["status"], string> = {
  running: "bg-secondary shadow-[0_0_0_3px] shadow-secondary/15",
  idle: "bg-tertiary shadow-[0_0_0_3px] shadow-tertiary/10",
  busy: "bg-tertiary shadow-[0_0_0_3px] shadow-tertiary/10",
  attention: "bg-tertiary shadow-[0_0_0_3px] shadow-tertiary/10",
  unbound: "bg-muted-foreground/50",
  offline: "bg-muted-foreground/50"
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export function AgentLiveStatusBadge({ state }: { state?: AgentExecutionState }) {
  const status = state?.status ?? "unbound";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-xl border px-2 py-0.5 text-xs leading-4", statusClass[status])}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", statusDotClass[status], status === "running" && "animate-pulse")} />
      {statusLabel[status]}
    </span>
  );
}

export function AgentProfilePanel({ agent, executionState }: { agent: Agent; executionState?: AgentExecutionState }) {
  const description = agent.description.trim();
  const provider = executionState?.provider ? providerLabel(executionState.provider) : "Not configured";
  const runtime = executionState?.deviceId ?? "Not configured";

  return (
    <aside className="bg-background px-3 py-3">
      <div className="grid gap-2">
        <div className="grid gap-1">
          <h2 className="text-base font-semibold leading-5 text-foreground">{agent.name}</h2>
          <p className="text-xs leading-4 text-muted-foreground">{description || "<show description here>"}</p>
        </div>
        <AgentLiveStatusBadge state={executionState} />
      </div>
      <ProfileSection title="Properties">
        <ProfileRow label="Runtime" value={runtime} technical />
        <ProfileRow label="Provider" value={provider} />
        <ProfileRow label="Enabled" value={agent.enabled ? "Enabled" : "Disabled"} />
        <ProfileRow label="Skills" value={String(agent.skills.length)} />
      </ProfileSection>
      <ProfileSection title="Details">
        <ProfileRow label="ID" value={agent.id} technical />
        <ProfileRow label="Created" value={formatTimestamp(agent.createdAt)} />
        <ProfileRow label="Updated" value={formatTimestamp(agent.updatedAt)} />
      </ProfileSection>
    </aside>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-5 border-t border-divider-strong pt-4"><h3 className="mb-3 font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.05em] text-muted-foreground">{title}</h3><dl className="grid gap-3">{children}</dl></section>;
}

function ProfileRow({ label, value, technical = false }: { label: string; value: string; technical?: boolean }) {
  return <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 text-xs leading-4"><dt className="text-muted-foreground">{label}</dt><dd title={value} className={cn("min-w-0 truncate text-foreground", technical && "font-mono")}>{value}</dd></div>;
}