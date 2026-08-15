import type { ExecutionProfile, ExecutionProfileSaveRequest, LocalRuntime } from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { EditorActions, SelectField, TextField } from "@/components/shared/workspace-ui";
import { Cpu } from "lucide-react";
import { useWorkspaceNavigationBlocker, type WorkspaceNavigation } from "../useWorkspaceNavigation";
import { modelOptions, providerOptions, reasoningOptions } from "./executionProfileOptions";
import { useExecutionProfileEditor } from "./useExecutionProfileEditor";

const ignoreNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"] = () => undefined;

export function ExecutionProfileEditor({ profile, existingProfileIds, runtime, create, update, remove, onSaved, onDeleted, setNavigationBlocker }: {
  profile?: ExecutionProfile;
  existingProfileIds: readonly string[];
  runtime: LocalRuntime;
  create: (id: string, request: ExecutionProfileSaveRequest) => Promise<ExecutionProfile>;
  update: (id: string, request: ExecutionProfileSaveRequest) => Promise<ExecutionProfile>;
  remove: (id: string) => Promise<void>;
  onSaved?: (profile: ExecutionProfile) => void;
  onDeleted?: (id: string) => void;
  setNavigationBlocker?: WorkspaceNavigation["setNavigationBlocker"];
}) {
  const editor = useExecutionProfileEditor({ profile, existingProfileIds, runtime, create, update, remove, onSaved, onDeleted });
  useWorkspaceNavigationBlocker(setNavigationBlocker ?? ignoreNavigationBlocker, editor.dirty, "Discard unsaved execution profile changes?");
  const models = modelOptions(editor.provider, editor.draft.model);
  const efforts = reasoningOptions(editor.provider, editor.draft.model, editor.draft.reasoningEffort);

  return (
    <section className="@container/execution-profile border-y border-divider-strong bg-card">
      <form id={editor.formId} className="grid min-h-[34rem] @3xl/execution-profile:grid-cols-[18rem_minmax(0,1fr)]" onSubmit={(event) => { event.preventDefault(); void editor.submit(); }}>
        <aside className="border-b border-divider-strong bg-background px-5 py-5 @3xl/execution-profile:border-b-0 @3xl/execution-profile:border-r">
          <div className="grid gap-3">
            <Cpu className="size-8 text-primary" aria-hidden="true" />
            <div><h1 className="text-base font-semibold leading-5">{profile ? editor.draft.name || "Unnamed execution profile" : "New execution profile"}</h1><p className="mt-1 text-xs text-muted-foreground">Portable runtime intent for executable Steps.</p></div>
            <dl className="grid gap-3 border-t border-divider-strong pt-4 text-xs">
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">ID</dt><dd className="truncate font-mono" title={editor.id}>{editor.id || "Generated from name"}</dd></div>
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">Availability</dt><dd className={editor.availabilityError ? "text-destructive" : "text-secondary"}>{editor.availabilityError ?? (editor.valid ? "Available" : "Incomplete")}</dd></div>
            </dl>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="flex min-h-12 items-center justify-between gap-3 border-b border-divider-strong px-4 py-2.5"><div><h2 className="font-mono text-xs font-medium">Execution profile</h2><p className="text-xs text-muted-foreground">Changes persist only when you Save.</p></div><EditorActions saveLabel="Save execution profile" formId={editor.formId} dirty={editor.dirty} valid={editor.valid} pending={editor.pending} canDelete={Boolean(profile)} deleteLabel="Delete execution profile" deleteType="execution profile" resourceName={profile?.name} onDelete={editor.deleteProfile} /></header>
          <div className="grid max-w-2xl gap-4 p-5">
            {editor.error ? <Alert variant="destructive"><AlertDescription>{editor.error}</AlertDescription></Alert> : null}
            <TextField label="Name" required value={editor.draft.name} error={editor.nameError ?? editor.idError} disabled={editor.pending} onChange={(name) => editor.update({ name })} />
            <SelectField label="Provider" required value={editor.draft.provider} placeholder="Select provider" options={providerOptions(runtime, editor.draft.provider)} error={editor.providerError} disabled={editor.pending} onChange={editor.selectProvider} />
            <SelectField label="Model" required value={editor.draft.model} placeholder={editor.provider ? "Select model" : "Select provider first"} options={models} error={editor.modelError} disabled={editor.pending || !editor.provider} onChange={editor.selectModel} />
            <SelectField label="Reasoning effort" required value={editor.draft.reasoningEffort} placeholder={editor.draft.model ? "Select reasoning effort" : "Select model first"} options={efforts} error={editor.reasoningError} disabled={editor.pending || !editor.draft.model} onChange={(reasoningEffort) => editor.update({ reasoningEffort })} />
            <Field className="grid gap-1.5"><div className="flex min-h-10 items-center justify-between gap-4 rounded border border-input px-3 md:min-h-8"><FieldLabel htmlFor="execution-profile-network" className="text-sm md:text-xs">Network access</FieldLabel><Switch id="execution-profile-network" aria-describedby="execution-profile-network-description" checked={editor.draft.networkAccess} disabled={editor.pending} onCheckedChange={(networkAccess) => editor.update({ networkAccess })} /></div><FieldDescription id="execution-profile-network-description">Allow network access only when this profile explicitly requires it.</FieldDescription></Field>
          </div>
        </div>
      </form>
    </section>
  );
}
