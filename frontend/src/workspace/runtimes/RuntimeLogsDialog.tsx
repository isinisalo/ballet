import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    setPath(fallbackPath);
    setContent("");
    setLoading(true);
    setError("");
    runtimeRegistryApi.logs().then((response) => {
      if (!disposed) { setPath(response.path); setContent(response.content); }
    }).catch((cause) => {
      if (!disposed) setError(toErrorMessage(cause, "Unable to load Ballet logs."));
    }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [fallbackPath, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="flex max-h-[80vh] w-[min(56rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="flex-row items-center justify-between border-b border-divider-strong px-4 py-3">
            <div className="min-w-0">
              <DialogTitle>Ballet logs</DialogTitle>
              <DialogDescription className="truncate font-mono text-[0.68rem]">{path || fallbackPath}</DialogDescription>
            </div>
            <DialogClose render={<Button type="button" size="sm" variant="outline">Close</Button>} />
          </DialogHeader>
          {error ? <Alert variant="destructive" className="m-3"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <pre className="m-0 min-h-64 overflow-auto bg-background p-3 font-mono text-[0.68rem] leading-5 whitespace-pre">{loading ? "Loading logs…" : content || (error ? "" : "No Ballet logs available.")}</pre>
        </DialogContent>
    </Dialog>
  );
}
