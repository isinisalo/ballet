import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toErrorMessage } from "@/lib/errors";
import { runtimeRegistryApi } from "./runtimeRegistryApi";

export function RuntimeLogsDialog({ open, onOpenChange, fallbackPath }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fallbackPath: string;
}) {
  const [path, setPath] = useState(fallbackPath);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    setLoading(true);
    setError("");
    runtimeRegistryApi.logs().then((response) => {
      if (!disposed) { setPath(response.path); setContent(response.content); }
    }).catch((cause) => {
      if (!disposed) setError(toErrorMessage(cause, "Unable to load Ballet logs."));
    }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/55" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[80vh] w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-divider-strong bg-card shadow-lg">
          <header className="flex items-center justify-between border-b border-divider-strong px-4 py-3"><div><DialogPrimitive.Title className="text-sm font-semibold">Ballet logs</DialogPrimitive.Title><DialogPrimitive.Description className="font-mono text-[0.65rem] text-muted-foreground">{path || fallbackPath}</DialogPrimitive.Description></div><DialogPrimitive.Close render={<Button type="button" size="sm" variant="outline">Close</Button>} /></header>
          {error ? <Alert variant="destructive" className="m-3"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <pre className="m-0 min-h-64 overflow-auto bg-background p-3 font-mono text-[0.68rem] leading-5 whitespace-pre">{loading ? "Loading logs…" : content || (error ? "" : "No Ballet logs available.")}</pre>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
