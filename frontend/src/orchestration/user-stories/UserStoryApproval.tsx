import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UserStoryDocument } from "@shared/orchestration/userStories";

export function UserStoryApproval({ current, disabled, onApprove, onDraft }: {
  current: UserStoryDocument; disabled: boolean; onApprove(): Promise<void>; onDraft(): Promise<void>;
}) {
  const [confirming, setConfirming] = useState<UserStoryDocument>();
  const unchanged = confirming?.contentHash === current.contentHash;
  const { value } = current;
  return <section aria-label="Story approval" className="mt-5 space-y-3 border-t border-border pt-4">
    <div className="flex flex-wrap items-center gap-3"><Badge variant="outline">{value.status === "approved" ? "Approved" : "Draft"}</Badge>
      {value.status === "draft" ? <Button type="button" size="sm" disabled={disabled} onClick={() => setConfirming(current)}>Approve story</Button>
        : <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void onDraft()}>Return to draft</Button>}
    </div>
    <details className="text-xs text-muted-foreground"><summary className="min-h-10 py-2 md:min-h-0 md:py-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Approval details</summary>
      <p className="mt-2">Approval records agreement on this story. It does not indicate implementation or passing tests.</p>
      <dl className="mt-2 grid min-w-0 gap-1 break-all"><dt>Saved semantic hash</dt><dd className="font-mono">{current.semanticHash}</dd>
        <dt>File hash</dt><dd className="font-mono">{current.contentHash}</dd><dt>Approval revision</dt><dd>{value.approvalRevision}</dd>
        {value.approval ? <><dt>Approved by</dt><dd>{value.approval.approvedBy}</dd><dt>Approved at</dt><dd>{value.approval.approvedAt}</dd>
          <dt>Approved content hash</dt><dd className="font-mono">{value.approval.contentHash}</dd></> : null}
      </dl>
    </details>
    <Dialog open={Boolean(confirming)} onOpenChange={(open) => { if (!open) setConfirming(undefined); }}>
      <DialogContent><DialogHeader><DialogTitle>Approve this story?</DialogTitle><DialogDescription>
        This records your explicit approval, revision {(confirming?.value.approvalRevision ?? 0) + 1}, of the saved semantic content with hash <code className="break-all">{confirming?.semanticHash}</code>. Semantic edits return the story to Draft.
      </DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirming(undefined)}>Cancel</Button>
        <Button disabled={disabled || !unchanged} onClick={() => { setConfirming(undefined); void onApprove(); }}>Confirm approval</Button>
      </DialogFooter></DialogContent>
    </Dialog>
  </section>;
}
