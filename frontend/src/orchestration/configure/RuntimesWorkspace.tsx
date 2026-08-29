import { useEffect, useState } from "react";
import { Copy, Plus, RefreshCw, RotateCw, Trash2 } from "lucide-react";
import type { RuntimeDevice } from "@shared/domain/runtime";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { orchestrationApi, type PairingSessionView } from "../orchestrationApi";
import { ConfigureHeader } from "./ConfigureHeader";
import { ConfigureToolbar } from "./ConfigureToolbar";

export function RuntimesWorkspace({ selectedId, navigate }: { selectedId?: string; navigate(path: string): void }) {
  const [devices, setDevices] = useState<RuntimeDevice[]>([]);
  const [pairing, setPairing] = useState<PairingSessionView>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const refresh = async () => { try { setDevices(await orchestrationApi.runtimeDevices()); setError(""); } catch (reason) { setError(message(reason)); } };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!pairing || pairing.status === "claimed" || pairing.status === "expired") return;
    const timer = window.setInterval(() => { void orchestrationApi.pairing(pairing.id).then((next) => { setPairing(next); if (next.claimedDevice) void refresh(); }).catch((reason) => setError(message(reason))); }, 2_000);
    return () => window.clearInterval(timer);
  }, [pairing?.id, pairing?.status]);
  const action = async (operation: () => Promise<unknown>) => { setPending(true); setError(""); try { await operation(); await refresh(); } catch (reason) { setError(message(reason)); } finally { setPending(false); } };
  const selected = devices.find((device) => device.id === selectedId);
  return <><ConfigureHeader title="Runtimes" description="Pair exact computers and inspect the Codex CLI and GitHub Copilot CLI backends advertised by their daemon." /><ConfigureToolbar status={`${devices.length} computers`} label={selected?.displayName}><Button size="sm" onClick={() => void action(async () => setPairing(await orchestrationApi.createPairing()))}><Plus />Connect computer</Button>{pairing?.status === "pending" ? <Button size="sm" onClick={() => void action(async () => setPairing(await orchestrationApi.approvePairing(pairing.id)))}>Approve computer</Button> : null}{selected ? <><Button size="sm" variant="outline" disabled={pending} onClick={() => void action(() => orchestrationApi.refreshRuntime(selected.id))}><RefreshCw />Refresh</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => void action(() => orchestrationApi.restartRuntime(selected.id))}><RotateCw />Restart</Button><Button size="sm" variant="destructive" disabled={pending || selected.activeRunCount > 0} onClick={() => { if (window.confirm(`Disconnect ${selected.displayName}?`)) void action(() => orchestrationApi.revokeRuntime(selected.id)); }}><Trash2 />Disconnect</Button></> : null}</ConfigureToolbar>
    {error ? <Alert variant="destructive" className="m-4"><AlertDescription>{error}</AlertDescription></Alert> : null}
    {pairing ? <section className="m-4 grid gap-3 border bg-card p-4 md:m-6" aria-label="Computer pairing"><div><h2 className="font-semibold">Pair computer</h2><p className="text-xs text-muted-foreground">Code <code className="text-tertiary">{pairing.userCode}</code> · {pairing.status}</p></div>{pairing.installCommand ? <div className="flex min-w-0 items-center gap-2"><code className="min-w-0 flex-1 overflow-x-auto border bg-background p-3 text-xs">{pairing.installCommand}</code><Button size="icon" variant="outline" aria-label="Copy daemon setup command" onClick={() => void navigator.clipboard.writeText(pairing.installCommand!)}><Copy /></Button></div> : null}<p className="text-xs text-muted-foreground">Run the command on the target Mac, then approve this exact pairing. Remote control-plane URLs require HTTPS.</p></section> : null}
    <div className="grid gap-3 p-4 md:p-6">{devices.length === 0 ? <section className="grid min-h-56 place-items-center border border-dashed text-center"><div><h2 className="font-semibold">No computers connected</h2><p className="text-sm text-muted-foreground">Connect a daemon to expose Codex CLI and Copilot CLI.</p></div></section> : devices.map((device) => <section key={device.id} className="border bg-card"><button className="w-full border-b bg-panel-header p-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-current={device.id === selectedId ? "page" : undefined} onClick={() => navigate(`/runtimes?id=${encodeURIComponent(device.id)}`)}><h2 className="font-semibold">{device.displayName}</h2><p className="font-mono text-xs text-muted-foreground">{device.hostname} · {device.status} · daemon {device.diagnostics.daemonVersion}</p></button><div className="grid gap-2 p-3 sm:grid-cols-2">{device.backends.map((backend) => <article key={backend.id} className="border bg-background p-3"><div className="flex items-center justify-between"><strong>{backend.provider === "codex" ? "Codex CLI" : "GitHub Copilot CLI"}</strong><span className="font-mono text-xs text-muted-foreground">{backend.health}</span></div><p className="mt-1 text-xs text-muted-foreground">{backend.cliVersion ?? "Version unavailable"} · auth {backend.authStatus}</p><p className="mt-2 text-xs">{backend.capabilities.models.length} models · {backend.assignedAgentCount} assigned agents</p></article>)}</div></section>)}</div>
  </>;
}

const message = (reason: unknown): string => reason instanceof Error ? reason.message : "Runtime operation failed.";
