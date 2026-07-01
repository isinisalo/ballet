import { Bot, ChartNoAxesColumnIncreasing } from "lucide-react";
import type { Agent } from "../../../../shared/api/workspace-contracts";
import type { Runtime } from "../../../../shared/api/workspace-contracts";
import { CrudActions, ErrorPreview, Panel, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { nextReasoningEffort, reasoningEffortTone } from "./agentOptions";
import { type RemoveAgent, type SaveAgent, type AgentEditorState, useAgentEditor } from "./useAgentEditor";

function AgentEditorActions({ editor }: { editor: AgentEditorState }) {
  return (
    <CrudActions
      formId={editor.formId}
      newLabel="New"
      saveLabel="Save agent"
      deleteLabel="Delete agent"
      id={editor.form.id}
      disabled={editor.saveDisabled}
      deleteType="agent"
      resourceName={editor.form.name}
      onNew={editor.newAgent}
      onDelete={editor.deleteAgent}
    />
  );
}

export function AgentEditorContent({ editor, showNameField = true }: { editor: AgentEditorState; showNameField?: boolean }) {
  return (
    <div className="grid gap-3">
      {editor.form.errors?.length ? <ErrorPreview errors={editor.form.errors} /> : null}
      <form id={editor.formId} className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void editor.submit(); }}>
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
          <Select value={editor.runtimeValue} onValueChange={editor.updateRuntime} disabled={editor.runtimeOptions.length === 0}>
            <SelectTrigger size="sm" className="h-7 min-w-0 flex-[1_1_5.5rem] justify-between px-2">
              <SelectValue placeholder="No runtime" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                {editor.runtimeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={editor.modelValue} onValueChange={(model) => editor.updateForm({ model })}>
            <SelectTrigger size="sm" className="h-7 min-w-0 flex-[1_1_4.75rem] justify-between px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                {editor.modelOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className={cn("shrink-0", reasoningEffortTone(editor.reasoningValue))}
            aria-label={`Reasoning effort: ${editor.reasoningOptions.find((option) => option.value === editor.reasoningValue)?.label ?? editor.reasoningValue}`}
            title={`Reasoning effort: ${editor.reasoningOptions.find((option) => option.value === editor.reasoningValue)?.label ?? editor.reasoningValue}`}
            onClick={() => editor.updateForm({ modelReasoningEffort: nextReasoningEffort(editor.reasoningValue) })}
          >
            <ChartNoAxesColumnIncreasing data-icon="inline-start" />
          </Button>
        </div>
        <FieldGroup>
          {showNameField ? <TextField label="Name" required compact value={editor.form.name ?? ""} onChange={(name) => editor.updateForm({ name })} /> : null}
          <TextAreaField label="Description" rows={2} compact value={editor.form.description ?? ""} onChange={(description) => editor.updateForm({ description })} />
        </FieldGroup>
        <FieldGroup>
          <Field className="gap-1.5">
            <FieldLabel htmlFor={editor.instructionsId} className="text-muted-foreground">Instructions</FieldLabel>
            <Textarea
              id={editor.instructionsId}
              className="min-h-40 resize-y font-mono text-xs leading-relaxed"
              value={editor.form.instructions ?? ""}
              required
              onChange={(event) => editor.updateForm({ instructions: event.target.value })}
            />
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}

function AgentEditorPanel({ editor }: { editor: AgentEditorState }) {
  return (
    <Panel
      title={editor.form.id ? "Update agent" : "Create agent"}
      icon={<Bot data-icon="inline-start" />}
      action={<AgentEditorActions editor={editor} />}
    >
      <AgentEditorContent editor={editor} />
    </Panel>
  );
}

export function AgentEditor(props: {
  agent?: Agent;
  runtimes: Runtime[];
  save: SaveAgent;
  remove: RemoveAgent;
  onSaved?: (agent: Agent) => void;
  onNew?: () => void;
  onDeleted?: (id: string) => void;
}) {
  const editor = useAgentEditor(props);
  return <AgentEditorPanel editor={editor} />;
}
