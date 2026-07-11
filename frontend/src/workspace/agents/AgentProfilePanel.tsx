import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Agent, AgentExecutionState } from "@shared/api/workspace-contracts";
import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { AgentExecutionSettingsForm, type AgentExecutionBindingEditor } from "./execution/AgentExecutionForm";
import type { AgentEditorState } from "./useAgentEditor";

const statusLabel: Record<AgentExecutionState["status"], string> = {
  running: "Running",
  idle: "Idle",
  busy: "Busy",
  attention: "Needs attention",
  unbound: "Unbound",
  offline: "Offline"
};

const statusClass: Record<AgentExecutionState["status"], string> = {
  running: "border-secondary/30 bg-secondary/10 text-secondary",
  idle: "border-tertiary/30 bg-tertiary/10 text-tertiary",
  busy: "border-tertiary/30 bg-tertiary/10 text-tertiary",
  attention: "border-tertiary/30 bg-tertiary/10 text-tertiary",
  unbound: "border-muted-foreground/25 bg-muted text-muted-foreground",
  offline: "border-muted-foreground/25 bg-muted text-muted-foreground"
};

const statusDotClass: Record<AgentExecutionState["status"], string> = {
  running: "bg-secondary shadow-[0_0_0_3px] shadow-secondary/15",
  idle: "bg-tertiary shadow-[0_0_0_3px] shadow-tertiary/10",
  busy: "bg-tertiary shadow-[0_0_0_3px] shadow-tertiary/10",
  attention: "bg-tertiary shadow-[0_0_0_3px] shadow-tertiary/10",
  unbound: "bg-muted-foreground/50",
  offline: "bg-muted-foreground/50"
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export function AgentLiveStatusBadge({ state }: { state?: AgentExecutionState }) {
  const status = state?.status ?? "unbound";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-xl border px-2 py-0.5 text-xs leading-4", statusClass[status])}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", statusDotClass[status], status === "running" && "animate-pulse")} />
      {statusLabel[status]}
    </span>
  );
}

export function AgentProfilePanel({ agent, executionState, editor, executionEditor }: {
  agent: Agent;
  executionState?: AgentExecutionState;
  editor: AgentEditorState;
  executionEditor: AgentExecutionBindingEditor;
}) {
  const [editingField, setEditingField] = useState<"name" | "description" | null>(null);
  const name = editor.form.name ?? agent.name;
  const description = editor.form.description ?? agent.description;

  return (
    <aside className="bg-background px-3 py-3">
      <div className="grid gap-2">
        <EditableAgentName
          name={name}
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
      <AgentExecutionSettingsForm
        compact
        agentId={agent.id}
        editor={executionEditor}
        nodeStyle={editor.form.nodeStyle ?? agent.nodeStyle ?? "terra"}
        nodeStyleSaving={editor.nodeStyleSaving}
        nodeStyleError={editor.nodeStyleError}
        onNodeStyleChange={(style) => { void editor.saveNodeStyle(style); }}
      />
      <ProfileSection title="Details">
        <ProfileRow label="Skills" value={String(agent.skills.length)} />
        <ProfileRow label="ID" value={agent.id} technical />
        <ProfileRow label="Created" value={formatTimestamp(agent.createdAt)} />
        <ProfileRow label="Updated" value={formatTimestamp(agent.updatedAt)} />
      </ProfileSection>
    </aside>
  );
}

function EditableAgentName({ name, editing, onChange, onEdit, onDone, onCancel }: {
  name: string;
  editing: boolean;
  onChange: (value: string) => void;
  onEdit: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input autoFocus aria-label="Agent name" className="h-8 min-w-0 flex-1 text-xs" value={name} onChange={(event) => onChange(event.target.value)} />
        <Button type="button" size="icon-sm" className="size-6" aria-label="Finish editing agent name" title="Finish editing agent name" onClick={onDone}><Check /></Button>
        <Button type="button" size="icon-sm" variant="ghost" className="size-6" aria-label="Cancel editing agent name" title="Cancel editing agent name" onClick={onCancel}><X /></Button>
      </div>
    );
  }

  return (
    <h2 className="min-w-0 text-base font-semibold leading-5 text-foreground">
      <button type="button" className="group flex w-full items-center gap-1 text-left" aria-label="Edit agent name" title="Edit agent name" onClick={onEdit}>
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <Pencil aria-hidden="true" className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </button>
    </h2>
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
        <Textarea autoFocus aria-label="Agent description" className="min-h-16 flex-1 resize-y text-xs leading-4" rows={2} value={description} onChange={(event) => onChange(event.target.value)} />
        <div className="grid gap-1">
          <Button type="button" size="icon-sm" className="size-6" aria-label="Finish editing agent description" title="Finish editing agent description" onClick={onDone}><Check /></Button>
          <Button type="button" size="icon-sm" variant="ghost" className="size-6" aria-label="Cancel editing agent description" title="Cancel editing agent description" onClick={onCancel}><X /></Button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" className="group flex w-full items-start gap-1 text-left text-xs leading-4 text-muted-foreground" aria-label="Edit agent description" title="Edit agent description" onClick={onEdit}>
      <span className="min-w-0 flex-1">{description.trim() || "<show description here>"}</span>
      <Pencil aria-hidden="true" className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </button>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-5 border-t border-divider-strong pt-4"><h3 className="mb-3 font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.05em] text-muted-foreground">{title}</h3><dl className="grid gap-3">{children}</dl></section>;
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
