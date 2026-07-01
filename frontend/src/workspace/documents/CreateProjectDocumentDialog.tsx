import { useEffect, useId, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { TextField } from "@/components/shared/workspace-ui";
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
    } catch {
      // Async create failures are surfaced by the shared mutation notification layer.
    } finally {
      setPending(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 grid w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-divider-strong bg-card p-4 text-card-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
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
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="outline" className="cursor-pointer" disabled={pending}>
                Cancel
              </Button>
            </DialogPrimitive.Close>
            <Button type="submit" form={formId} className="cursor-pointer" disabled={pending || !title.trim()}>
              <Plus data-icon="inline-start" />
              Create
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
