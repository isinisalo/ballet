import { useEffect, useState } from "react";
import { FileText, RefreshCw, RotateCw } from "lucide-react";
import type { LocalDaemonLogEntry, LocalDaemonStatus } from "@shared/domain/runtime";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OperationalStatus } from "@/components/shared/workspace-ui";
import { orchestrationApi } from "../orchestrationApi";
import { ConfigureHeader } from "./ConfigureHeader";
import { ConfigureToolbar } from "./ConfigureToolbar";

export function RuntimesWorkspace(props: { selectedId?: string; navigate(path: string): void }) {
  void props;
  const [runtime, setRuntime] = useState<LocalDaemonStatus>();
  const [logs, setLogs] = useState<LocalDaemonLogEntry[]>([]);
  const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const refresh = async () => {
    try { setRuntime(await orchestrationApi.localRuntime()); setError(""); }
    catch (reason) { setError(message(reason)); }
  };
  useEffect(() => { void refresh(); const timer = window.setInterval(() => { void refresh(); }, 5_000); return () => window.clearInterval(timer); }, []);
  const action = async (operation: () => Promise<unknown>) => {
    setPending(true); setError("");
    try { await operation(); await refresh(); } catch (reason) { setError(message(reason)); } finally { setPending(false); }
  };
  return <>
    <ConfigureHeader title="Runtimes" description="Inspect the checkout-local daemon and its Codex CLI runtime." />
    <ConfigureToolbar status={runtime?.status ?? "Loading local daemon"} label="Local daemon">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => void action(() => orchestrationApi.refreshRuntime())}><RefreshCw />Refresh providers</Button>
      <Button size="sm" variant="outline" disabled={pending || !runtime || runtime.activeTaskCount > 0}
        onClick={() => void action(() => orchestrationApi.restartRuntime())}><RotateCw />Restart daemon</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => void action(async () => {
        setLogs((await orchestrationApi.runtimeLogs()).entries);
      })}><FileText />Load logs</Button>
    </ConfigureToolbar>
    {error ? <Alert variant="destructive" className="m-4"><AlertDescription>{error}</AlertDescription></Alert> : null}
    <div className="grid gap-4 p-4 md:p-6">
      <LocalDaemonFacts runtime={runtime} />
      <section aria-labelledby="providers-heading"><h2 id="providers-heading" className="mb-2 font-semibold">Local providers</h2>
        <div className="grid gap-3 sm:grid-cols-2">{runtime?.providers.map((provider) => <article key={provider.provider} className="border bg-card p-3">
          <div className="flex items-center justify-between gap-3"><strong>Codex CLI</strong>
            <OperationalStatus compact label={provider.health} tone={provider.health === "ready" ? "healthy" : "neutral"} /></div>
          <p className="mt-1 text-xs text-muted-foreground">{provider.cliVersion ?? "Version unavailable"} · auth {provider.authStatus}</p>
          <p className="mt-2 text-xs">{provider.capabilities.models.length} models · {provider.busy ? "busy" : "idle"}</p>
          {provider.healthMessage ? <p className="mt-2 text-xs text-destructive">{provider.healthMessage}</p> : null}
        </article>)}</div>
      </section>
      {logs.length > 0 ? <section aria-labelledby="daemon-logs-heading"><h2 id="daemon-logs-heading" className="mb-2 font-semibold">Daemon logs</h2>
        <pre className="max-h-80 overflow-auto border bg-background p-3 text-xs">{logs.map((entry) => `${entry.createdAt} [${entry.level}] ${entry.message}`).join("\n")}</pre>
      </section> : null}
    </div>
  </>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>;
}
const message = (reason: unknown): string => reason instanceof Error ? reason.message : "Runtime operation failed.";

function LocalDaemonFacts({ runtime }: { runtime?: LocalDaemonStatus }) {
  return <section className="border bg-card" aria-labelledby="local-daemon-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-panel-header p-3">
          <div><h2 id="local-daemon-heading" className="font-semibold">Checkout-local daemon</h2>
            <p className="font-mono text-xs text-muted-foreground">{runtime ? `v${runtime.daemonVersion} · last seen ${runtime.lastSeenAt}` : "Loading…"}</p></div>
          <OperationalStatus compact label={runtime?.status ?? "loading"}
            tone={runtime?.status === "online" ? "healthy" : runtime?.status === "error" ? "danger" : "neutral"} />
        </div>
        <dl className="grid gap-3 p-3 text-sm sm:grid-cols-4">
          <Fact label="PID" value={runtime?.pid ? String(runtime.pid) : "—"} />
          <Fact label="Uptime" value={runtime ? `${runtime.uptimeSeconds}s` : "—"} />
          <Fact label="Active tasks" value={String(runtime?.activeTaskCount ?? 0)} />
          <Fact label="Recent error" value={runtime?.recentError ?? "None"} />
        </dl>
      </section>;
}
