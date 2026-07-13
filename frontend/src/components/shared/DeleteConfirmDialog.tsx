import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toErrorMessage } from "@/lib/errors";
import { LoaderCircle } from "lucide-react";

export function DeleteConfirmDialog({ open, onOpenChange, deleteType, resourceName, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleteType: string;
  resourceName?: string;
  onConfirm: () => unknown | Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!open && !pendingRef.current) { setPending(false); setError(""); }
  }, [open]);

  const confirm = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (cause) {
      setError(toErrorMessage(cause, `Unable to delete ${deleteType}.`));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const displayedName = resourceName?.trim() || `this ${deleteType}`;
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (nextOpen || !pendingRef.current) onOpenChange(nextOpen); }}>
      <DialogContent showCloseButton={false} aria-busy={pending} onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete {deleteType}?</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium text-foreground">{displayedName}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending}>Cancel</Button>} />
            <Button type="button" variant="destructive" className="cursor-pointer" disabled={pending} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void confirm(); }}>
              {pending ? <><LoaderCircle className="animate-spin motion-reduce:animate-none" /> Deleting…</> : "Delete"}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
