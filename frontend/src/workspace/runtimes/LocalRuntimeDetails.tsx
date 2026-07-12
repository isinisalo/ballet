import { Badge } from "@/components/ui/badge";
import type { LocalRuntime } from "@shared/api/workspace-contracts";
import { LocalProviderTable } from "./LocalProviderTable";
import { formatRuntimeTimestamp, formatUptime } from "./runtimeRegistry";

export function LocalRuntimeDetails({ runtime }: { runtime: LocalRuntime }) {
  return (
    <section className="min-w-0 bg-background" aria-label={`${runtime.hostname || "Local"} runtime details`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-divider-strong bg-card px-4 py-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-semibold">{runtime.hostname || "Local runtime"}</h2>
            <Badge variant="outline" className="border-secondary/30 bg-secondary/10 font-mono text-[0.62rem] uppercase text-secondary">Local</Badge>
          </div>
          <p className="font-mono text-[0.65rem] text-muted-foreground">{runtime.platform}/{runtime.architecture} · instance {runtime.instanceId || "starting"}</p>
        </div>
      </header>
      <dl className="grid gap-x-6 gap-y-3 border-b border-divider-strong bg-panel-section px-4 py-3 text-xs sm:grid-cols-2 xl:grid-cols-5">
        <Metadata label="Instance ID" value={runtime.instanceId || "—"} />
        <Metadata label="Started" value={formatRuntimeTimestamp(runtime.startedAt)} />
        <Metadata label="Uptime" value={formatUptime(runtime.uptimeSeconds)} />
        <Metadata label="Active runs" value={String(runtime.activeRunCount)} />
        <Metadata label="Application log" value={runtime.logsPath || "—"} />
      </dl>
      <div className="grid gap-2 border-b border-divider-strong px-4 py-3 text-xs sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <Metadata label="Workspace checkout" value={runtime.checkout.path || "—"} />
        <Metadata label="HEAD / config" value={[runtime.checkout.headSha?.slice(0, 10), runtime.checkout.configHash?.slice(0, 10)].filter(Boolean).join(" · ") || "—"} />
        <Badge variant="outline" className={runtime.checkout.dirty ? "self-end border-tertiary/30 text-tertiary" : "self-end text-muted-foreground"}>{runtime.checkout.dirty ? "Dirty" : "Clean"}</Badge>
      </div>
      <LocalProviderTable providers={runtime.providers} />
    </section>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-[0.68rem] text-foreground" title={value}>{value}</dd>
    </div>
  );
}
