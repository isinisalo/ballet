import { useState } from "react";
import { LoaderCircle, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

type DeleteActionProps = {
  deleteLabel: string;
  deleteType: string;
  resourceName?: string;
  disabled?: boolean;
  onDelete: () => unknown | Promise<unknown>;
};

type EditorActionState = "pending" | "locked" | "invalid" | "dirty" | "saved";

const editorActionStateLabel: Record<EditorActionState, string> = {
  pending: "Saving…",
  locked: "Locked by active Run",
  invalid: "Invalid",
  dirty: "Unsaved",
  saved: "Saved"
};

const editorActionStateClass: Record<EditorActionState, string> = {
  pending: "text-primary",
  locked: "text-tertiary",
  invalid: "text-destructive",
  dirty: "text-tertiary",
  saved: "text-muted-foreground"
};

function resolveEditorActionState({ pending, locked, valid, dirty }: { pending: boolean; locked: boolean; valid: boolean; dirty: boolean }): EditorActionState {
  if (pending) return "pending";
  if (locked) return "locked";
  if (!valid) return "invalid";
  return dirty ? "dirty" : "saved";
}

export function DeleteAction({ deleteLabel, deleteType, resourceName, disabled = false, onDelete }: DeleteActionProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        className="min-h-10 min-w-10"
        variant="destructive"
        disabled={disabled}
        aria-label={deleteLabel}
        title={deleteLabel}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setConfirmOpen(true);
        }}
      >
        <Trash2 data-icon="inline-start" />
      </Button>
      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        deleteType={deleteType}
        resourceName={resourceName}
        onConfirm={onDelete}
      />
    </>
  );
}

export function EditorActions({
  saveLabel,
  formId,
  onSave,
  dirty = true,
  valid = true,
  pending = false,
  locked = false,
  deleteLabel = "Delete",
  deleteType = "item",
  resourceName,
  canDelete = false,
  onDelete
}: {
  saveLabel: string;
  formId?: string;
  onSave?: () => void | Promise<void>;
  dirty?: boolean;
  valid?: boolean;
  pending?: boolean;
  locked?: boolean;
  deleteLabel?: string;
  deleteType?: string;
  resourceName?: string;
  canDelete?: boolean;
  onDelete?: () => unknown | Promise<unknown>;
}) {
  const saveDisabled = pending || locked || !dirty || !valid;
  const state = resolveEditorActionState({ pending, locked, valid, dirty });

  return (
    <div className="flex items-center justify-end gap-2" data-slot="editor-actions" data-state={state}>
      <span
        className={cn("font-mono text-[0.62rem] uppercase", editorActionStateClass[state])}
        aria-live="polite"
      >
        {editorActionStateLabel[state]}
      </span>
      <Button
        type={formId ? "submit" : "button"}
        size="icon-sm"
        className="min-h-10 min-w-10"
        form={formId}
        disabled={saveDisabled}
        aria-label={pending ? `${saveLabel} in progress` : saveLabel}
        title={saveLabel}
        onClick={onSave ? (event) => { event.preventDefault(); void onSave(); } : undefined}
      >
        {pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
      </Button>
      {canDelete && onDelete ? (
        <DeleteAction deleteLabel={deleteLabel} deleteType={deleteType} resourceName={resourceName} disabled={pending} onDelete={onDelete} />
      ) : null}
    </div>
  );
}
