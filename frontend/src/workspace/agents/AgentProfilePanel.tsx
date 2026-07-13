import { Button } from "@/components/ui/button";
import { OperationalStatus, type OperationalStatusTone } from "@/components/shared/workspace-ui";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Agent, AgentExecutionState } from "@shared/api/workspace-contracts";
import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { AgentAvatarField } from "./AgentAvatarField";
import { AgentExecutionSettingsForm, type AgentRuntimeConfigurationEditor } from "./execution/AgentExecutionForm";
import type { AgentEditorState } from "./useAgentEditor";

const statusLabel: Record<AgentExecutionState["status"], string> = {
  running: "Running",
  idle: "Idle",
  busy: "Busy",
  attention: "Needs attention",
  unbound: "Unbound",
  offline: "Offline"
};

const statusTone: Record<AgentExecutionState["status"], OperationalStatusTone> = {
  running: "active",
  idle: "attention",
  busy: "attention",
  attention: "attention",
  unbound: "neutral",
  offline: "neutral"
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export function AgentLiveStatusBadge({ state }: { state?: AgentExecutionState }) {
  const status = state?.status ?? "unbound";
  return <OperationalStatus compact label={statusLabel[status]} tone={statusTone[status]} />;
}

export function AgentProfilePanel({ agent, executionState, editor, executionEditor }: {
  agent: Agent;
  executionState?: AgentExecutionState;
  editor: AgentEditorState;
  executionEditor: AgentRuntimeConfigurationEditor;
}) {
  const [editingField, setEditingField] = useState<"name" | "description" | null>(null);
  const name = editor.form.name ?? agent.name;
  const description = editor.form.description ?? agent.description;

  return (
    <aside className="bg-background">
      <div className="grid gap-3 px-5 py-5">
        <AgentAvatarField profile compact avatar={editor.form.avatar} onChange={(avatar) => editor.updateForm({ avatar })} />
        <EditableAgentName
          id={editor.nameId}
          name={name}
          error={editor.nameError}
          editing={editingField === "name"}
          onChange={(nextName) => editor.updateForm({ name: nextName })}
          onEdit={() => setEditingField("name")}
          onDone={() => setEditingField(null)}
          onCancel={() => {
            editor.updateForm({ name: agent.name });
            setEditingField(null);
          }}
        />
        <EditableAgentDescription
          description={description}
          editing={editingField === "description"}
          onChange={(nextDescription) => editor.updateForm({ description: nextDescription })}
          onEdit={() => setEditingField("description")}
          onDone={() => setEditingField(null)}
          onCancel={() => {
            editor.updateForm({ description: agent.description });
            setEditingField(null);
          }}
        />
        <AgentLiveStatusBadge state={executionState} />
      </div>
      <AgentExecutionSettingsForm compact agentId={agent.id} editor={executionEditor} />
      <ProfileSection title="Details">
        <ProfileRow label="Skills" value={String(agent.skills.length)} />
        <ProfileRow label="ID" value={agent.id} technical />
        <ProfileRow label="Created" value={formatTimestamp(agent.createdAt)} />
        <ProfileRow label="Updated" value={formatTimestamp(agent.updatedAt)} />
      </ProfileSection>
    </aside>
  );
}

export function NewAgentProfilePanel({ editor }: { editor: AgentEditorState }) {
  const nameErrorId = `${editor.nameId}-error`;

  return (
    <aside className="bg-background">
      <div className="grid gap-3 px-5 py-5">
        <AgentAvatarField profile compact avatar={editor.form.avatar} onChange={(avatar) => editor.updateForm({ avatar })} />
        <h1 className="text-base font-semibold leading-5 text-foreground">New agent</h1>
        <Field className="gap-1.5" data-invalid={Boolean(editor.nameError)}>
          <FieldLabel htmlFor={editor.nameId} className="text-xs text-muted-foreground">Name</FieldLabel>
          <Input
            id={editor.nameId}
            className="h-10 text-base md:h-8 md:text-xs"
            value={editor.form.name ?? ""}
            required
            aria-invalid={Boolean(editor.nameError)}
            aria-describedby={editor.nameError ? nameErrorId : undefined}
            onChange={(event) => editor.updateForm({ name: event.target.value })}
          />
          {editor.nameError ? <FieldError id={nameErrorId} className="text-xs">{editor.nameError}</FieldError> : null}
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor={editor.descriptionId} className="text-xs text-muted-foreground">Description</FieldLabel>
          <Textarea
            id={editor.descriptionId}
            className="min-h-20 resize-y text-base leading-5 md:text-xs md:leading-4"
            rows={3}
            value={editor.form.description ?? ""}
            onChange={(event) => editor.updateForm({ description: event.target.value })}
          />
        </Field>
        <AgentLiveStatusBadge />
      </div>
    </aside>
  );
}

function EditableAgentName({ id, name, error, editing, onChange, onEdit, onDone, onCancel }: {
  id: string;
  name: string;
  error: string;
  editing: boolean;
  onChange: (value: string) => void;
  onEdit: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const errorId = `${id}-error`;
  if (editing) {
    return (
      <Field className="gap-1" data-invalid={Boolean(error)}>
        <h1 className="sr-only">{name || "Unnamed agent"}</h1>
        <FieldLabel htmlFor={id} className="sr-only">Agent name</FieldLabel>
        <div className="flex items-center gap-1">
          <Input id={id} autoFocus aria-label="Agent name" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className="h-10 min-w-0 flex-1 text-base md:h-8 md:text-xs" value={name} onChange={(event) => onChange(event.target.value)} />
          <Button type="button" size="icon-sm" aria-label="Finish editing agent name" title="Finish editing agent name" onClick={onDone}><Check /></Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel editing agent name" title="Cancel editing agent name" onClick={onCancel}><X /></Button>
        </div>
        {error ? <FieldError id={errorId} className="text-xs">{error}</FieldError> : null}
      </Field>
    );
  }

  return (
    <div className="grid gap-1">
      <div className="group flex min-w-0 items-center gap-1">
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold leading-5 text-foreground">{name || "Unnamed agent"}</h1>
        <button type="button" className="inline-flex size-10 shrink-0 items-center justify-center transition-opacity md:size-5 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100" aria-label="Edit agent name" title="Edit agent name" onClick={onEdit}>
          <Pencil aria-hidden="true" className="size-3" />
        </button>
      </div>
      {error ? <FieldError className="text-xs">{error}</FieldError> : null}
    </div>
  );
}

function EditableAgentDescription({ description, editing, onChange, onEdit, onDone, onCancel }: {
  description: string;
  editing: boolean;
  onChange: (value: string) => void;
  onEdit: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  if (editing) {
    return (
      <div className="flex items-start gap-1">
        <Textarea autoFocus aria-label="Agent description" className="min-h-20 flex-1 resize-y text-base leading-5 md:min-h-16 md:text-xs md:leading-4" rows={2} value={description} onChange={(event) => onChange(event.target.value)} />
        <div className="grid gap-1">
          <Button type="button" size="icon-sm" aria-label="Finish editing agent description" title="Finish editing agent description" onClick={onDone}><Check /></Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel editing agent description" title="Cancel editing agent description" onClick={onCancel}><X /></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex w-full items-start gap-1 text-xs leading-4 text-muted-foreground">
      <p className="min-w-0 flex-1">{description.trim() || "No description"}</p>
      <button type="button" className="inline-flex size-10 shrink-0 items-center justify-center transition-opacity md:size-5 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100" aria-label="Edit agent description" title="Edit agent description" onClick={onEdit}>
        <Pencil aria-hidden="true" className="size-3" />
      </button>
    </div>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-t border-divider-strong px-5 py-4"><h2 className="mb-3 font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.05em] text-muted-foreground">{title}</h2><dl className="grid gap-3">{children}</dl></section>;
}

function ProfileRow({ label, value, technical = false }: {
  label: string;
  value: string;
  technical?: boolean;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 text-xs leading-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd title={value} className={cn("min-w-0 truncate text-foreground", technical && "font-mono")}>{value}</dd>
    </div>
  );
}
