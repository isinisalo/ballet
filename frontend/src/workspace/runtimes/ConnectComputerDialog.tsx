import { useEffect } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Laptop, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PairingSessionContent } from "./PairingSessionContent";
import { usePairingSession } from "./usePairingSession";

export function ConnectComputerDialog({ open, initialPairingId, onOpenChange, onConnected }: {
  open: boolean;
  initialPairingId?: string;
  onOpenChange: (open: boolean) => void;
  onConnected: (deviceId?: string) => void;
}) {
  const pairing = usePairingSession(open, initialPairingId);

  useEffect(() => {
    if (!open) pairing.reset();
  }, [open, pairing.reset]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/55" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(46rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-divider-strong bg-card shadow-lg">
          <header className="flex items-start justify-between gap-3 border-b border-divider-strong p-4">
            <div className="flex items-start gap-2">
              <Laptop className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <DialogPrimitive.Title className="text-sm font-semibold">Connect a computer</DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground">Pair a local daemon, then use its Codex CLI or GitHub Copilot CLI from Ballet.</DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close render={<Button type="button" size="icon-sm" variant="ghost" aria-label="Close"><X /></Button>} />
          </header>
          {pairing.error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{pairing.error}</AlertDescription></Alert> : null}
          {!pairing.session ? (
            <div className="grid gap-4 p-4">
              <div className="grid gap-2 border border-divider-strong bg-panel-section p-3 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">Local credentials stay local.</span> Ballet dispatches work to the daemon; it does not import CLI tokens.</p>
                <p>Initial support is limited to Apple silicon and Intel Macs with Codex CLI or GitHub Copilot CLI.</p>
              </div>
              <div className="flex justify-end"><Button type="button" disabled={pairing.pending === "create"} onClick={() => void pairing.create()}>{pairing.pending === "create" ? "Creating…" : "Create one-time code"}</Button></div>
            </div>
          ) : (
            <PairingSessionContent
              session={pairing.session}
              pending={pairing.pending !== null}
              onApprove={() => void pairing.approve()}
              onCheck={() => void pairing.refresh()}
              onRegenerate={() => { pairing.reset(); void pairing.create(); }}
              onDone={() => {
                onConnected(pairing.session?.deviceId ?? pairing.session?.claimedDevice?.id);
                onOpenChange(false);
              }}
            />
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
