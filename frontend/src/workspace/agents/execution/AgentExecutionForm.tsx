import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ChevronDown, Cpu, Save } from "lucide-react";
import { useId, useState } from "react";
import { backendReadiness, providerLabel } from "../../runtimes/runtimeRegistry";
import { backendsForDevice, executionFormError, modelOptions, PROVIDER_DEFAULT, reasoningOptions, selectedExecutionBackend, selectedExecutionDevice } from "./executionOptions";
import { useAgentExecutionBinding } from "./useAgentExecutionBinding";

export type AgentExecutionBindingEditor = ReturnType<typeof useAgentExecutionBinding>;

export function AgentExecutionForm({ agentId, onSaved }: { agentId: string; onSaved?: () => void }) {
  const editor = useAgentExecutionBinding(agentId);
  return <AgentExecutionSettingsForm agentId={agentId} editor={editor} onSaved={onSaved} />;
}

export function AgentExecutionSettingsForm({ agentId, editor, onSaved, compact = false }: { agentId: string; editor: AgentExecutionBindingEditor; onSaved?: () => void; compact?: boolean }) {
  return compact
    ? <CompactAgentExecutionSettings agentId={agentId} editor={editor} onSaved={onSaved} />
    : <StandardAgentExecutionSettings agentId={agentId} editor={editor} onSaved={onSaved} />;
}

function CompactAgentExecutionSettings({ agentId, editor, onSaved }: { agentId: string; editor: AgentExecutionBindingEditor; onSaved?: () => void }) {
  const settings = useExecutionSettings(editor, onSaved);

  return (
    <section className="mt-5 grid gap-3 border-t border-divider-strong pt-4" aria-label="Agent execution settings">
      <header className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.05em] text-muted-foreground"><Cpu className="size-3.5" /> Execution</h3>
        <Button type="button" size="icon-sm" className="size-6" aria-label="Save execution" title="Save execution" disabled={settings.saveDisabled} onClick={settings.save}><Save className="size-3.5" /></Button>
      </header>
      {editor.error ? <p role="alert" className="text-xs leading-4 text-destructive">{editor.error}</p> : null}
      {!editor.loading && editor.devices.length === 0 ? <p className="text-xs leading-4 text-muted-foreground">No runtime computers are connected.</p> : null}
      <ExecutionSelectionFields settings={settings} compact />
      <NetworkAccessField compact checked={editor.form.policy.network} disabled={!settings.supportsNetwork} onChange={settings.setNetwork} />
      <AdvancedPolicy agentId={agentId} editor={editor} supportsRoots={settings.supportsRoots} open={settings.advancedOpen} onOpenChange={settings.setAdvancedOpen} compact />
      <p className="text-xs leading-4 text-muted-foreground">{settings.validationError ?? "Execution binding is explicit; Ballet never selects the first available runtime."}</p>
    </section>
  );
}

function StandardAgentExecutionSettings({ agentId, editor, onSaved }: { agentId: string; editor: AgentExecutionBindingEditor; onSaved?: () => void }) {
  const settings = useExecutionSettings(editor, onSaved);

  return (
    <section className="grid gap-3 border-t border-divider-strong bg-panel-section p-4" aria-label="Agent execution settings">
      <header className="flex items-start justify-between gap-3">
        <div><h3 className="flex items-center gap-2 text-sm font-semibold"><Cpu className="size-4 text-muted-foreground" /> Execution</h3><p className="text-xs text-muted-foreground">Bind this agent to one explicit computer and CLI provider.</p></div>
        {settings.readiness ? <span className={cn("border px-2 py-1 font-mono text-[0.6rem] uppercase", settings.readiness.tone === "healthy" ? "border-secondary/30 text-secondary" : settings.readiness.tone === "error" ? "border-destructive/30 text-destructive" : "border-tertiary/30 text-tertiary")}>{settings.readiness.label}</span> : null}
      </header>
      {editor.error ? <Alert variant="destructive"><AlertDescription>{editor.error}</AlertDescription></Alert> : null}
      {!editor.loading && editor.devices.length === 0 ? <Alert><AlertDescription>No runtime computers are connected. Connect one from Runtimes before configuring execution.</AlertDescription></Alert> : null}
      <ExecutionSelectionFields settings={settings} />
      <div className="border border-divider-strong bg-background px-3 py-2 text-xs"><span className="font-medium text-foreground">Write scope:</span> <span className="text-muted-foreground">current project checkout only</span></div>
      <NetworkAccessField checked={editor.form.policy.network} disabled={!settings.supportsNetwork} onChange={settings.setNetwork} />
      <AdvancedPolicy agentId={agentId} editor={editor} supportsRoots={settings.supportsRoots} open={settings.advancedOpen} onOpenChange={settings.setAdvancedOpen} />
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{settings.validationError ?? "Execution binding is explicit; Ballet never selects the first available runtime."}</p><Button type="button" size="sm" disabled={settings.saveDisabled} onClick={settings.save}><Save /> {editor.saving ? "Saving…" : "Save execution"}</Button></div>
    </section>
  );
}

function useExecutionSettings(editor: AgentExecutionBindingEditor, onSaved?: () => void) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const device = selectedExecutionDevice(editor.devices, editor.form.deviceId);
  const backend = selectedExecutionBackend(editor.devices, editor.form.runtimeBackendId);
  const validationError = executionFormError(editor.form, editor.devices);
  const readiness = device && backend ? backendReadiness(device, backend) : undefined;
  const supportsNetwork = backend?.capabilities.policy.networkControl ?? false;
  const supportsRoots = backend?.capabilities.policy.readOnlyRoots ?? false;
  const save = () => void editor.save().then((saved) => { if (saved) onSaved?.(); });
  const selectModel = (model: string) => {
    const options = reasoningOptions(backend, model);
    editor.updateForm({ model, reasoning: options.length === 1 && options[0].value === PROVIDER_DEFAULT ? PROVIDER_DEFAULT : "" });
  };
  const setNetwork = (network: boolean) => editor.updateForm({ policy: { ...editor.form.policy, network } });
  return { advancedOpen, backend, device, editor, readiness, save, saveDisabled: Boolean(validationError) || editor.saving || editor.loading, selectModel, setAdvancedOpen, setNetwork, supportsNetwork, supportsRoots, validationError };
}

function ExecutionSelectionFields({ settings, compact = false }: { settings: ReturnType<typeof useExecutionSettings>; compact?: boolean }) {
  const { backend, device, editor } = settings;
  return (
    <div className={compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"}>
      <ExecutionSelect compact={compact} label="Runtime" value={editor.form.deviceId} placeholder="Select runtime" disabled={editor.loading} options={editor.devices.map((item) => ({ value: item.id, label: `${item.displayName} · ${item.status}` }))} onChange={editor.selectDevice} />
      <ExecutionSelect compact={compact} label="Provider" value={editor.form.runtimeBackendId} placeholder="Select provider" disabled={!device} options={backendsForDevice(editor.devices, editor.form.deviceId).map((item) => ({ value: item.id, label: providerLabel(item.provider) }))} onChange={editor.selectBackend} />
      <ExecutionSelect compact={compact} label="Model" value={editor.form.model} placeholder="Select model" disabled={!backend} options={modelOptions(backend)} onChange={settings.selectModel} />
      <ExecutionSelect compact={compact} label="Reasoning effort" value={editor.form.reasoning} placeholder="Select effort" disabled={!backend || !editor.form.model} options={reasoningOptions(backend, editor.form.model)} onChange={(reasoning) => editor.updateForm({ reasoning })} />
    </div>
  );
}

function ExecutionSelect({ label, value, placeholder, disabled, options, onChange, compact = false }: { label: string; value: string; placeholder: string; disabled: boolean; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; compact?: boolean }) {
  const id = useId();
  if (compact) {
    return <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 text-xs leading-4"><FieldLabel htmlFor={id} className="text-muted-foreground">{label}</FieldLabel><Select value={value} disabled={disabled} onValueChange={onChange}><SelectTrigger id={id} className="h-8 w-full font-mono text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent align="start"><SelectGroup>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent></Select></div>;
  }
  return <Field className="gap-1.5"><FieldLabel htmlFor={id}>{label}</FieldLabel><Select value={value} disabled={disabled} onValueChange={onChange}><SelectTrigger id={id} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent align="start"><SelectGroup>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>;
}

function NetworkAccessField({ checked, disabled, onChange, compact = false }: { checked: boolean; disabled: boolean; onChange: (value: boolean) => void; compact?: boolean }) {
  if (compact) return <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 text-xs leading-4"><span className="text-muted-foreground">Network access</span><Switch checked={checked} disabled={disabled} aria-label="Network access" onCheckedChange={onChange} /></div>;
  return <label className="flex items-center justify-between gap-4 text-xs"><span><strong className="block text-foreground">Network access</strong><span className="text-muted-foreground">Disabled by default. The provider must advertise network control.</span></span><Switch checked={checked} disabled={disabled} aria-label="Network access" onCheckedChange={onChange} /></label>;
}

function AdvancedPolicy({ agentId, editor, supportsRoots, open, onOpenChange, compact = false }: { agentId: string; editor: AgentExecutionBindingEditor; supportsRoots: boolean; open: boolean; onOpenChange: (open: boolean) => void; compact?: boolean }) {
  return <Collapsible open={open} onOpenChange={onOpenChange}><CollapsibleTrigger render={<Button type="button" size="sm" variant="ghost" className={cn("px-0 text-muted-foreground", compact && "h-6 text-xs")}><ChevronDown className={cn("transition-transform", open && "rotate-180")} /> Advanced policy</Button>} /><CollapsibleContent className="grid gap-3 border-t border-divider-strong pt-3"><Field className="gap-1.5"><FieldLabel htmlFor={`read-only-roots-${agentId}`}>Additional read-only roots</FieldLabel><Textarea id={`read-only-roots-${agentId}`} className="min-h-20 font-mono text-xs" disabled={!supportsRoots} placeholder="One absolute path per line" value={editor.form.policy.readOnlyRoots.join("\n")} onChange={(event) => editor.updateForm({ policy: { ...editor.form.policy, readOnlyRoots: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) } })} /></Field></CollapsibleContent></Collapsible>;
}
