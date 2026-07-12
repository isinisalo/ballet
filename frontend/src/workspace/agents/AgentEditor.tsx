import { CrudActions, ErrorPreview, Panel, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { Agent, AgentExecutionState, AgentRuntimeConfiguration, LocalRuntime } from "@shared/api/workspace-contracts";
import { Bot } from "lucide-react";
import { AgentAvatarField } from "./AgentAvatarField";
import { AgentEditWorkspace } from "./AgentEditWorkspace";
import { type AgentEditorState, type RemoveAgent, type SaveAgent, useAgentEditor } from "./useAgentEditor";

function AgentEditorActions({ editor }: { editor: AgentEditorState }) {
  return <CrudActions formId={editor.formId} newLabel="New" saveLabel="Save agent" deleteLabel="Delete agent" id={editor.form.id} disabled={editor.saveDisabled} deleteType="agent" resourceName={editor.form.name} onNew={editor.newAgent} onDelete={editor.deleteAgent} showNew={false} />;
}

export function AgentEditorContent({ editor, showNameField = true }: { editor: AgentEditorState; showNameField?: boolean }) {
  return (
    <div className="grid gap-3">
      {editor.validationError ? <Alert variant="destructive"><AlertDescription>{editor.validationError}</AlertDescription></Alert> : null}
      {editor.form.errors?.length ? <ErrorPreview errors={editor.form.errors} /> : null}
      <form id={editor.formId} className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void editor.submit(); }}>
        <FieldGroup>
          {showNameField ? <TextField label="Name" required compact value={editor.form.name ?? ""} onChange={(name) => editor.updateForm({ name })} /> : null}
          <TextAreaField label="Description" rows={2} compact value={editor.form.description ?? ""} onChange={(description) => editor.updateForm({ description })} />
          <AgentAvatarField avatar={editor.form.avatar} onChange={(avatar) => editor.updateForm({ avatar })} />
        </FieldGroup>
        <FieldGroup>
          <Field className="gap-1.5">
            <FieldLabel htmlFor={editor.instructionsId} className="text-muted-foreground">Instructions</FieldLabel>
            <Textarea id={editor.instructionsId} className="min-h-40 resize-y font-mono text-xs leading-relaxed" value={editor.form.instructions ?? ""} required onChange={(event) => editor.updateForm({ instructions: event.target.value })} />
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}

export function AgentEditor(props: {
  agent?: Agent;
  executionState?: AgentExecutionState;
  runtime: LocalRuntime;
  runtimeConfiguration?: AgentRuntimeConfiguration;
  save: SaveAgent;
  remove: RemoveAgent;
  onSaved?: (agent: Agent) => void;
  onNew?: () => void;
  onDeleted?: (id: string) => void;
}) {
  const editor = useAgentEditor(props);
  if (props.agent) return <AgentEditWorkspace agent={props.agent} executionState={props.executionState} runtime={props.runtime} runtimeConfiguration={props.runtimeConfiguration} editor={editor} />;
  return <Panel title={editor.form.id ? "Update agent" : "Create agent"} icon={<Bot data-icon="inline-start" />} action={<AgentEditorActions editor={editor} />}><AgentEditorContent editor={editor} /></Panel>;
}
