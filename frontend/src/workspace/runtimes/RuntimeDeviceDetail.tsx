import { FileText, RefreshCw, RotateCcw, Unplug } from "lucide-react";
import { useState } from "react";
import { DeleteConfirmDialog } from "@/components/shared/workspace-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRuntimeTimestamp } from "./runtimeRegistry";
import type { RuntimeDeviceAction } from "./useRuntimeRegistry";
import type { RuntimeDevice } from "./types";
import { RuntimeBackendTable } from "./RuntimeBackendTable";
import { RuntimeLogsDialog } from "./RuntimeLogsDialog";

const statusTone: Record<RuntimeDevice["status"], string> = {
  online: "border-secondary/30 bg-secondary/10 text-secondary",
  offline: "text-muted-foreground"
};

export function RuntimeDeviceDetail({ device, pendingAction, onAction, onDisconnected }: {
  device?: RuntimeDevice | null;
  pendingAction: RuntimeDeviceAction | null;
  onAction: (action: RuntimeDeviceAction) => Promise<boolean>;
  onDisconnected: () => void;
}) {
  const [logsOpen, setLogsOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  if (!device) {
    return (
      <section className="grid min-h-[30rem] place-items-center p-6 text-center">
        <div className="grid max-w-sm gap-1">
          <h2 className="text-sm font-semibold">Select a computer</h2>
          <p className="text-xs text-muted-foreground">Choose a connected computer to inspect daemon and CLI readiness.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0 bg-background" aria-label={`${device.displayName} runtime details`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-divider-strong bg-card px-4 py-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-semibold">{device.displayName}</h2>
            <Badge variant="outline" className={cn("font-mono text-[0.62rem] uppercase", statusTone[device.status])}>{device.status}</Badge>
          </div>
          <p className="font-mono text-[0.65rem] text-muted-foreground">{device.hostname} · {device.platform}/{device.architecture} · daemon {device.diagnostics.daemonVersion}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => setLogsOpen(true)}><FileText /> View logs</Button>
          <Button type="button" size="sm" variant="outline" disabled={pendingAction !== null} onClick={() => void onAction("refresh")}><RefreshCw /> Refresh capabilities</Button>
          <Button type="button" size="sm" variant="outline" disabled={pendingAction !== null || device.status !== "online"} onClick={() => void onAction("restart")}><RotateCcw /> Request restart</Button>
          <Button type="button" size="sm" variant="destructive" disabled={pendingAction !== null} onClick={() => setDisconnectOpen(true)}><Unplug /> Disconnect</Button>
        </div>
      </header>
      <dl className="grid gap-x-6 gap-y-3 border-b border-divider-strong bg-panel-section px-4 py-3 text-xs sm:grid-cols-2 xl:grid-cols-5">
        <Metadata label="Device ID" value={device.id} />
        <Metadata label="Daemon ID" value={device.diagnostics.daemonId} />
        <Metadata label="Uptime" value={formatUptime(device.diagnostics.uptimeSeconds)} />
        <Metadata label="Last seen" value={formatRuntimeTimestamp(device.diagnostics.lastSeenAt)} />
        <Metadata label="Connected" value={formatRuntimeTimestamp(device.diagnostics.connectedAt)} />
        <Metadata label="Active runs" value={String(device.activeRunCount)} />
        <Metadata label="Busy runtimes" value={String(device.busyBackendCount)} />
      </dl>
      {device.diagnostics.recentError ? <p className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 font-mono text-[0.68rem] text-destructive">{device.diagnostics.recentError}</p> : null}
      {device.checkout ? (
        <div className="grid gap-2 border-b border-divider-strong px-4 py-3 text-xs sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
          <Metadata label="Workspace checkout" value={device.checkout.path} />
          <Metadata label="Repository / revision" value={[device.checkout.repositoryUrl, device.checkout.headSha?.slice(0, 10)].filter(Boolean).join(" · ") || "—"} />
          <Badge variant="outline" className={device.checkout.dirty ? "self-end border-tertiary/30 text-tertiary" : "self-end text-muted-foreground"}>{device.checkout.dirty ? "Dirty" : "Clean"}</Badge>
        </div>
      ) : (
        <p className="border-b border-divider-strong px-4 py-3 text-xs text-tertiary">No checkout is mapped to this computer for the active project.</p>
      )}
      <RuntimeBackendTable device={device} />
      <RuntimeLogsDialog deviceId={device.id} open={logsOpen} onOpenChange={setLogsOpen} />
      <DeleteConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        deleteType="connected computer"
        resourceName={device.displayName}
        onConfirm={async () => {
          if (await onAction("disconnect")) onDisconnected();
        }}
      />
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

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", `${minutes}m`].filter(Boolean).join(" ");
};
