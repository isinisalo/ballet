import { useState } from "react";
import type { UseCase } from "@shared/orchestration/direction";
import { useCaseApprovalHash } from "@shared/orchestration/direction";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function UseCaseApprovalActions({ value, disabled, onApprove, onDraft }: {
  value: UseCase; disabled: boolean;
  onApprove?(value: UseCase): Promise<void>;
  onDraft?(value: UseCase): Promise<void>;
}) {
  const [confirming, setConfirming] = useState<UseCase>();
  const unchanged = confirming && useCaseApprovalHash(confirming) === useCaseApprovalHash(value);
  return <>
    {value.status === "draft"
      ? <Button size="sm" disabled={disabled} onClick={() => setConfirming(value)}>Approve exact content…</Button>
      : <Button size="sm" variant="outline" disabled={disabled} onClick={() => void onDraft?.(value)}>Return to draft</Button>}
    <Dialog open={Boolean(confirming)} onOpenChange={(open) => { if (!open) setConfirming(undefined); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve {confirming?.id}?</DialogTitle>
          <DialogDescription>This approves the exact persisted semantic content with hash <code className="break-all">{confirming ? useCaseApprovalHash(confirming) : ""}</code>. Saving Markdown never approves it.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirming(undefined)}>Cancel</Button>
          <Button disabled={disabled || !unchanged} onClick={() => {
            if (confirming) void onApprove?.(confirming);
            setConfirming(undefined);
          }}>Approve exact content</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
