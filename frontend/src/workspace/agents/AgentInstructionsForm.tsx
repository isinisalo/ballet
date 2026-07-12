import { CrudActions, ErrorPreview, Panel } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Eye, FileText, Pencil } from "lucide-react";
import { MarkdownBody } from "../documents/MarkdownBody";
import type { AgentEditorState } from "./useAgentEditor";

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
const tokenEstimate = (value: string) => Math.ceil(value.length / 4);

export function AgentInstructionsForm({ editor }: { editor: AgentEditorState }) {
  const instructions = editor.form.instructions ?? "";
  return (
    <form id={editor.formId} className="flex min-h-[36rem] flex-col" onSubmit={(event) => { event.preventDefault(); void editor.submit(); }}>
      <header className="border-b border-divider-strong px-5 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground"><FileText className="size-4 text-muted-foreground" /> Instructions</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Preview and edit the Markdown injected into every task.</p>
      </header>
      <div className="grid min-h-0 flex-1 xl:grid-cols-2">
        <Panel title="Markdown Preview" icon={<Eye data-icon="inline-start" />} compact contentClassName="min-h-[28rem] overflow-auto">
          <div className="markdown-body-compact"><MarkdownBody source={instructions} title={editor.form.name ?? "Agent instructions"} /></div>
        </Panel>
        <div className="border-t border-divider-strong xl:border-l xl:border-t-0">
          <Panel title="Edit" icon={<Pencil data-icon="inline-start" />} compact contentClassName="p-0">
            <div className="flex min-h-10 items-center justify-end gap-3 border-b border-divider-strong bg-panel-header px-4 font-mono text-[0.62rem] text-muted-foreground">
              <span>Words: <strong className="text-foreground">{wordCount(instructions)}</strong></span>
              <span>Tokens: <strong className="text-foreground">{tokenEstimate(instructions)}</strong></span>
            </div>
            <div className="grid gap-3 p-4">
              {editor.validationError ? <Alert variant="destructive"><AlertDescription>{editor.validationError}</AlertDescription></Alert> : null}
              {editor.form.errors?.length ? <ErrorPreview errors={editor.form.errors} /> : null}
              <Field className="gap-1.5">
                <FieldLabel htmlFor={editor.instructionsId} className="sr-only">Instructions</FieldLabel>
                <Textarea
                  id={editor.instructionsId}
                  className="min-h-[24rem] resize-y bg-background font-mono text-xs leading-relaxed"
                  placeholder="Define this agent's role, expertise, and working style."
                  value={instructions}
                  required
                  onChange={(event) => editor.updateForm({ instructions: event.target.value })}
                />
              </Field>
            </div>
          </Panel>
        </div>
      </div>
      <footer className="flex min-h-14 items-center justify-end border-t border-divider-strong bg-panel-section px-5 py-3 sm:px-6">
        <CrudActions formId={editor.formId} saveLabel="Save agent" deleteLabel="Delete agent" id={editor.form.id} disabled={editor.saveDisabled} deleteType="agent" resourceName={editor.form.name} onDelete={editor.deleteAgent} />
      </footer>
    </form>
  );
}
