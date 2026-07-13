import { EditorActions, ErrorPreview, Panel, WorkbenchLayout } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Pencil } from "lucide-react";
import { MarkdownBody } from "../documents/MarkdownBody";
import { countEditorWords, estimateEditorTokens, formatEditorMetric } from "../documents/editorMetrics";
import type { AgentEditorState } from "./useAgentEditor";

export function AgentInstructionsForm({ editor }: { editor: AgentEditorState }) {
  const instructions = editor.form.instructions ?? "";
  const instructionsErrorId = `${editor.instructionsId}-error`;

  return (
    <section className="min-w-0 bg-card" aria-label="Agent instructions">
      <WorkbenchLayout
        className="min-h-full"
        preview={(
          <Panel title="Markdown Preview" icon={<Eye data-icon="inline-start" />} compact contentClassName="min-h-[22rem] overflow-auto">
            <div className="markdown-body-compact">
              <MarkdownBody source={instructions} title={editor.form.name ?? "Agent instructions"} />
            </div>
          </Panel>
        )}
        editor={(
          <Panel
            title="Edit"
            icon={<Pencil data-icon="inline-start" />}
            compact
            contentClassName="p-0"
            action={(
              <EditorActions
                saveLabel="Save agent"
                formId={editor.formId}
                dirty={editor.dirty}
                valid={editor.valid}
                pending={editor.pending}
                deleteLabel="Delete agent"
                deleteType="agent"
                resourceName={editor.form.name}
                canDelete={Boolean(editor.form.id)}
                onDelete={editor.deleteAgent}
              />
            )}
          >
            <div className="flex min-h-10 flex-wrap items-center justify-end gap-3 border-b border-divider-strong bg-panel-header px-4 py-2">
              <span className="font-mono text-[0.65rem] leading-none text-muted-foreground">Words: <strong className="text-foreground">{countEditorWords(instructions)}</strong></span>
              <span className="font-mono text-[0.65rem] leading-none text-muted-foreground">Tokens: <strong className="text-foreground">{formatEditorMetric(estimateEditorTokens(instructions))}</strong></span>
            </div>
            <div className="grid gap-3 p-4">
              {editor.validationError ? <Alert variant="destructive"><AlertDescription>{editor.validationError}</AlertDescription></Alert> : null}
              {editor.form.errors?.length ? <ErrorPreview errors={editor.form.errors} /> : null}
              <Field className="gap-1.5" data-invalid={Boolean(editor.instructionsError)}>
                <FieldLabel htmlFor={editor.instructionsId} className="sr-only">Instructions</FieldLabel>
                <Textarea
                  id={editor.instructionsId}
                  className="min-h-[24rem] resize-y bg-background font-mono text-base leading-relaxed md:text-xs"
                  placeholder="Define this agent's role, expertise, and working style."
                  value={instructions}
                  required
                  aria-invalid={Boolean(editor.instructionsError)}
                  aria-describedby={editor.instructionsError ? instructionsErrorId : undefined}
                  onChange={(event) => editor.updateForm({ instructions: event.target.value })}
                />
                {editor.instructionsError ? <FieldError id={instructionsErrorId} className="text-xs">{editor.instructionsError}</FieldError> : null}
              </Field>
            </div>
          </Panel>
        )}
      />
    </section>
  );
}
