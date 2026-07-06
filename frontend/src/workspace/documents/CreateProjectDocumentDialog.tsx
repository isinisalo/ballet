import { useEffect, useId, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { TextField } from "@/components/shared/workspace-ui";
import { toErrorMessage } from "@/lib/errors";
import { projectDocumentCreateConfig } from "./projectDocuments";
import type { ProjectDocumentCreateKind } from "../types";

export function CreateProjectDocumentDialog({
  kind,
  onOpenChange,
  onCreate
}: {
  kind: ProjectDocumentCreateKind | null;
  onOpenChange: (open: boolean) => void;
  onCreate: (kind: ProjectDocumentCreateKind, title: string) => Promise<void>;
}) {
  const formId = useId();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const open = Boolean(kind);
  const config = kind ? projectDocumentCreateConfig[kind] : projectDocumentCreateConfig.instruction;

  useEffect(() => {
    if (open) return;
    setTitle("");
    setError("");
    setPending(false);
  }, [open]);

  const submit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }

    setPending(true);
    setError("");
    try {
      if (!kind) return;
      await onCreate(kind, trimmedTitle);
      onOpenChange(false);
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "Unable to create project document."));
    } finally {
      setPending(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          className="fixed left-1/2 top-1/2 z-50 grid w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-divider-strong bg-card p-4 text-card-foreground shadow-lg outline-none transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid gap-1.5">
            <DialogPrimitive.Title className="text-sm font-semibold text-foreground">
              {config.title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm leading-relaxed text-muted-foreground">
              Create a Markdown document.
            </DialogPrimitive.Description>
          </div>
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <form id={formId} className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <FieldGroup>
              <TextField label="Title" required value={title} onChange={setTitle} />
            </FieldGroup>
          </form>
          <div className="flex items-center justify-end gap-2">
            <DialogPrimitive.Close
              render={
                <Button type="button" variant="outline" className="cursor-pointer" disabled={pending}>
                  Cancel
                </Button>
              }
            />
            <Button type="submit" form={formId} className="cursor-pointer" disabled={pending || !title.trim()}>
              <Plus data-icon="inline-start" />
              Create
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
