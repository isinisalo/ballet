import { UserStoryApproval } from "./UserStoryApproval";
import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UserStoryDocument } from "@shared/orchestration/userStories";
import { ConfigureToolbar } from "../configure/ConfigureToolbar";
import { UserStoryLegend } from "./UserStoryLegend";
import { UserStoryFields } from "./UserStoryFields";
import { useUserStoryDraft } from "./useUserStoryDraft";
import { shortStoryId, storyEditorStatus } from "./userStoryPresentation";
import { UserStoryEditorFeedback } from "./UserStoryEditorFeedback";

export function UserStoryEditor({ current, locked, unavailable = false, onDirty, onBack, onSaved, onApproved, onRemoved, onRefresh }: {
  current?: UserStoryDocument; locked: boolean; unavailable?: boolean; onDirty(dirty: boolean): void; onBack(): void;
  onApproved(document: UserStoryDocument): void; onSaved(document: UserStoryDocument): void; onRemoved(id: string): void; onRefresh(): Promise<void>;
}) {
  const editor = useUserStoryDraft(current, onDirty);
  const [confirming, setConfirming] = useState(false);
  const status = storyEditorStatus(locked, unavailable, editor.pending, editor.dirty, Boolean(current));
  const disabled = locked || unavailable || editor.pending;
  return <>
    <ConfigureToolbar status={status}>
      <Button size="sm" variant="ghost" className="min-w-10" aria-label="Back to stories" disabled={editor.pending} onClick={onBack}><ArrowLeft aria-hidden="true" /></Button>
      <Button size="sm" variant="outline" disabled={editor.pending} onClick={onBack}>Cancel</Button>
      <Button size="sm" type="submit" form="user-story-form" disabled={disabled || !editor.dirty || !editor.valid || editor.stale}>Save story</Button>
    </ConfigureToolbar>
    <div className="story-workspace-content">
      <UserStoryLegend />
      <UserStoryEditorFeedback editor={editor} current={current} disabled={disabled} onRefresh={onRefresh} />
      <Card className="story-card"><CardContent className="p-5">
        <div className="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{current ? shortStoryId(current.value.id) : "NEW USER STORY"}</span>
          {current ? <Button size="sm" variant="ghost" disabled={disabled || editor.stale} onClick={() => setConfirming(true)}><Trash2 aria-hidden="true" />Delete story</Button> : <span className="text-xs text-muted-foreground">Role, Goal and Benefit are required</span>}
        </div>
        <form id="user-story-form" onSubmit={(event) => { event.preventDefault(); if (!disabled) void editor.save(onSaved); }}>
          <UserStoryFields editor={editor} disabled={disabled} />
        </form>
        {current ? <UserStoryApproval current={current} disabled={disabled || editor.dirty || editor.stale || editor.conflict}
          onApprove={() => editor.decide(true, onApproved)} onDraft={() => editor.decide(false, onApproved)} /> : null}
      </CardContent></Card>
      {current ? <p className="mt-4 break-all font-mono text-xs text-muted-foreground">{current.value.id}</p> : null}
    </div>
    <Dialog open={confirming} onOpenChange={(open) => { if (!editor.pending) setConfirming(open); }}>
      <DialogContent><DialogHeader><DialogTitle>Delete {current ? shortStoryId(current.value.id) : "User Story"}?</DialogTitle>
        <DialogDescription>This removes the story and all its acceptance criteria from the project. Unsaved edits will be discarded.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" disabled={editor.pending} onClick={() => setConfirming(false)}>Cancel</Button>
          <Button variant="destructive" disabled={disabled || editor.stale} onClick={() => { setConfirming(false); void editor.remove(onRemoved); }}>Delete story</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
