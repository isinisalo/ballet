import { useState } from "react";
import { Plus, ServerCog } from "lucide-react";
import { Panel } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConnectComputerDialog } from "./ConnectComputerDialog";
import { RuntimeDeviceDetail } from "./RuntimeDeviceDetail";
import { RuntimeDeviceList } from "./RuntimeDeviceList";
import { useRuntimeRegistry } from "./useRuntimeRegistry";

export function RuntimeRegistryView({ selectedDeviceId, onSelectDevice }: {
  selectedDeviceId?: string;
  onSelectDevice: (deviceId?: string) => void;
}) {
  const registry = useRuntimeRegistry(selectedDeviceId);
  const pairingId = new URLSearchParams(window.location.search).get("pairing") ?? undefined;
  const [connectOpen, setConnectOpen] = useState(Boolean(pairingId));
  const onlineCount = registry.devices.filter((device) => device.status === "online").length;

  return (
    <Panel
      title="Runtimes"
      titleExtra={<span className="font-mono text-[0.62rem] text-muted-foreground">{registry.devices.length} computers · {onlineCount} online</span>}
      icon={<ServerCog />}
      contentClassName="p-0"
      action={<Button type="button" size="sm" onClick={() => setConnectOpen(true)}><Plus /> Connect computer</Button>}
    >
      {registry.error ? <Alert variant="destructive" className="m-3"><AlertDescription>{registry.error}</AlertDescription></Alert> : null}
      <div className="grid min-h-[34rem] min-w-0 grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <RuntimeDeviceList
          devices={registry.devices}
          selectedDeviceId={selectedDeviceId}
          search={registry.search}
          status={registry.status}
          loading={registry.loading}
          onSearchChange={registry.setSearch}
          onStatusChange={registry.setStatus}
          onSelect={onSelectDevice}
        />
        {!registry.loading && registry.devices.length === 0 && !registry.search && registry.status === "all" ? (
          <section className="grid min-h-[28rem] place-items-center p-6 text-center">
            <div className="grid max-w-sm justify-items-center gap-2">
              <ServerCog className="size-6 text-muted-foreground" />
              <h2 className="text-sm font-semibold">No computers connected</h2>
              <p className="text-xs text-muted-foreground">Connect a local daemon to make Codex CLI and GitHub Copilot CLI available to agents.</p>
              <Button type="button" size="sm" onClick={() => setConnectOpen(true)}><Plus /> Connect computer</Button>
            </div>
          </section>
        ) : (
          <RuntimeDeviceDetail
            device={registry.device}
            pendingAction={registry.pendingAction}
            onAction={registry.runAction}
            onDisconnected={() => onSelectDevice(undefined)}
          />
        )}
      </div>
      <ConnectComputerDialog
        open={connectOpen}
        initialPairingId={pairingId}
        onOpenChange={(nextOpen) => {
          setConnectOpen(nextOpen);
          if (!nextOpen && pairingId) {
            const url = new URL(window.location.href);
            url.searchParams.delete("pairing");
            window.history.replaceState({}, "", `${url.pathname}${url.search}`);
          }
        }}
        onConnected={(deviceId) => {
          void registry.refresh();
          if (deviceId) onSelectDevice(deviceId);
        }}
      />
    </Panel>
  );
}
