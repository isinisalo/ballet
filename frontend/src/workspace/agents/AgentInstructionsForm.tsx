import { CrudActions, ErrorPreview } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";
import type { AgentEditorState } from "./useAgentEditor";

export function AgentInstructionsForm({ editor }: { editor: AgentEditorState }) {
  return (
    <form id={editor.formId} className="flex min-h-[36rem] flex-col" onSubmit={(event) => { event.preventDefault(); void editor.submit(); }}>
      <header className="border-b border-divider-strong px-5 py-5 sm:px-6">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground"><FileText className="size-4 text-muted-foreground" /> Instructions</h2>
        <p className="mt-2 max-w-2xl text-sm leading-5 text-muted-foreground">Define this agent&apos;s identity and working style. Instructions are injected into the agent&apos;s context for every task. Markdown is supported.</p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-5 sm:px-6">
        {editor.validationError ? <Alert variant="destructive"><AlertDescription>{editor.validationError}</AlertDescription></Alert> : null}
        {editor.form.errors?.length ? <ErrorPreview errors={editor.form.errors} /> : null}
        <Field className="min-h-0 flex-1 gap-1.5">
          <FieldLabel htmlFor={editor.instructionsId} className="sr-only">Instructions</FieldLabel>
          <Textarea
            id={editor.instructionsId}
            className="min-h-[22rem] flex-1 resize-y bg-background font-mono text-xs leading-relaxed"
            placeholder="Define this agent's role, expertise, and working style."
            value={editor.form.instructions ?? ""}
            required
            onChange={(event) => editor.updateForm({ instructions: event.target.value })}
          />
        </Field>
      </div>
      <footer className="flex min-h-14 items-center justify-end border-t border-divider-strong bg-panel-section px-5 py-3 sm:px-6">
        <CrudActions formId={editor.formId} newLabel="New" saveLabel="Save agent" deleteLabel="Delete agent" id={editor.form.id} disabled={editor.saveDisabled} deleteType="agent" resourceName={editor.form.name} onNew={editor.newAgent} onDelete={editor.deleteAgent} showNew={false} />
      </footer>
    </form>
  );
}