import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toErrorMessage } from "@/lib/errors";

export function DeleteConfirmDialog({ open, onOpenChange, deleteType, resourceName, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleteType: string;
  resourceName?: string;
  onConfirm: () => unknown | Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) { setPending(false); setError(""); }
  }, [open]);

  const confirm = async () => {
    setPending(true);
    setError("");
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (cause) {
      setError(toErrorMessage(cause, `Unable to delete ${deleteType}.`));
    } finally {
      setPending(false);
    }
  };

  const displayedName = resourceName?.trim() || `this ${deleteType}`;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 grid w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-divider-strong bg-card p-4 text-card-foreground shadow-lg outline-none transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0" onClick={(event) => event.stopPropagation()}>
          <div className="grid gap-1.5">
            <DialogPrimitive.Title className="text-sm font-semibold text-foreground">Delete {deleteType}?</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm leading-relaxed text-muted-foreground">
              Delete <span className="font-medium text-foreground">{displayedName}</span>? This action cannot be undone.
            </DialogPrimitive.Description>
          </div>
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <div className="flex items-center justify-end gap-2">
            <DialogPrimitive.Close render={<Button type="button" variant="outline" className="cursor-pointer" disabled={pending}>Cancel</Button>} />
            <Button type="button" variant="destructive" className="cursor-pointer" disabled={pending} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void confirm(); }}>Delete</Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
