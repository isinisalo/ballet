import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toErrorMessage } from "@/lib/errors";
import { runtimeRegistryApi } from "./runtimeRegistryApi";
import type { RuntimeLogEntry } from "./types";

export function RuntimeLogsDialog({ deviceId, open, onOpenChange }: {
  deviceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [entries, setEntries] = useState<RuntimeLogEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    setEntries([]);
    setError("");
    runtimeRegistryApi.getDeviceLogs(deviceId).then((response) => {
      if (!disposed) setEntries(response.entries);
    }).catch((caught) => {
      if (!disposed) setError(toErrorMessage(caught, "Unable to load daemon logs."));
    });
    return () => { disposed = true; };
  }, [deviceId, open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/55" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[80vh] w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-divider-strong bg-card shadow-lg">
          <header className="flex items-center justify-between border-b border-divider-strong px-4 py-3">
            <div>
              <DialogPrimitive.Title className="text-sm font-semibold">Daemon logs</DialogPrimitive.Title>
              <DialogPrimitive.Description className="font-mono text-[0.65rem] text-muted-foreground">{deviceId}</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close render={<Button type="button" size="sm" variant="outline">Close</Button>} />
          </header>
          {error ? <Alert variant="destructive" className="m-3"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <div className="min-h-64 overflow-auto bg-background p-3 font-mono text-[0.68rem] leading-5">
            {entries.length === 0 && !error ? <p className="text-muted-foreground">No daemon logs available.</p> : null}
            {entries.map((entry) => (
              <div key={entry.id} className="grid min-w-max grid-cols-[7rem_3rem_minmax(0,1fr)] gap-2">
                <time className="text-muted-foreground">{new Date(entry.createdAt).toLocaleTimeString()}</time>
                <span className={entry.level === "error" ? "text-destructive" : entry.level === "warn" ? "text-tertiary" : "text-secondary"}>{entry.level.toUpperCase()}</span>
                <pre className="m-0 whitespace-pre">{entry.message}</pre>
              </div>
            ))}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
