import { ChevronDown, Cpu, Save } from "lucide-react";
import { useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { backendReadiness, providerLabel } from "../../runtimes/runtimeRegistry";
import { backendsForDevice, executionFormError, modelOptions, PROVIDER_DEFAULT, reasoningOptions, selectedExecutionBackend, selectedExecutionDevice } from "./executionOptions";
import { useAgentExecutionBinding } from "./useAgentExecutionBinding";

export function AgentExecutionForm({ agentId, onSaved }: { agentId: string; onSaved?: () => void }) {
  const editor = useAgentExecutionBinding(agentId);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const device = selectedExecutionDevice(editor.devices, editor.form.deviceId);
  const backend = selectedExecutionBackend(editor.devices, editor.form.runtimeBackendId);
  const validationError = executionFormError(editor.form, editor.devices);
  const readiness = device && backend ? backendReadiness(device, backend) : undefined;
  const supportsNetwork = backend?.capabilities.policy.networkControl ?? false;
  const supportsRoots = backend?.capabilities.policy.readOnlyRoots ?? false;

  return (
    <section className="grid gap-3 border-t border-divider-strong bg-panel-section p-4" aria-label="Agent execution settings">
      <header className="flex items-start justify-between gap-3">
        <div><h3 className="flex items-center gap-2 text-sm font-semibold"><Cpu className="size-4 text-muted-foreground" /> Execution</h3><p className="text-xs text-muted-foreground">Bind this agent to one explicit computer and CLI provider.</p></div>
        {readiness ? <span className={cn("border px-2 py-1 font-mono text-[0.6rem] uppercase", readiness.tone === "healthy" ? "border-secondary/30 text-secondary" : readiness.tone === "error" ? "border-destructive/30 text-destructive" : "border-tertiary/30 text-tertiary")}>{readiness.label}</span> : null}
      </header>
      {editor.error ? <Alert variant="destructive"><AlertDescription>{editor.error}</AlertDescription></Alert> : null}
      {!editor.loading && editor.devices.length === 0 ? <Alert><AlertDescription>No runtime computers are connected. Connect one from Runtimes before configuring execution.</AlertDescription></Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ExecutionSelect label="Computer" value={editor.form.deviceId} placeholder="Select computer" disabled={editor.loading} options={editor.devices.map((item) => ({ value: item.id, label: `${item.displayName} · ${item.status}` }))} onChange={editor.selectDevice} />
        <ExecutionSelect label="Provider" value={editor.form.runtimeBackendId} placeholder="Select provider" disabled={!device} options={backendsForDevice(editor.devices, editor.form.deviceId).map((item) => ({ value: item.id, label: providerLabel(item.provider) }))} onChange={editor.selectBackend} />
        <ExecutionSelect label="Model" value={editor.form.model} placeholder="Select model" disabled={!backend} options={modelOptions(backend)} onChange={(model) => {
          const options = reasoningOptions(backend, model);
          editor.updateForm({ model, reasoning: options.length === 1 && options[0].value === PROVIDER_DEFAULT ? PROVIDER_DEFAULT : "" });
        }} />
        <ExecutionSelect label="Reasoning" value={editor.form.reasoning} placeholder="Select reasoning" disabled={!backend || !editor.form.model} options={reasoningOptions(backend, editor.form.model)} onChange={(reasoning) => editor.updateForm({ reasoning })} />
      </div>
      <div className="border border-divider-strong bg-background px-3 py-2 text-xs"><span className="font-medium text-foreground">Write scope:</span> <span className="text-muted-foreground">current project checkout only</span></div>
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger render={<Button type="button" size="sm" variant="ghost" className="px-0 text-muted-foreground"><ChevronDown className={cn("transition-transform", advancedOpen && "rotate-180")} /> Advanced policy</Button>} />
        <CollapsibleContent className="grid gap-3 border-t border-divider-strong pt-3">
          <label className="flex items-center justify-between gap-4 text-xs"><span><strong className="block text-foreground">Network access</strong><span className="text-muted-foreground">Disabled by default. The provider must advertise network control.</span></span><Switch checked={editor.form.policy.network} disabled={!supportsNetwork} onCheckedChange={(network) => editor.updateForm({ policy: { ...editor.form.policy, network } })} /></label>
          <Field className="gap-1.5"><FieldLabel htmlFor={`read-only-roots-${agentId}`}>Additional read-only roots</FieldLabel><Textarea id={`read-only-roots-${agentId}`} className="min-h-20 font-mono text-xs" disabled={!supportsRoots} placeholder="One absolute path per line" value={editor.form.policy.readOnlyRoots.join("\n")} onChange={(event) => editor.updateForm({ policy: { ...editor.form.policy, readOnlyRoots: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) } })} /></Field>
        </CollapsibleContent>
      </Collapsible>
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{validationError ?? "Execution binding is explicit; Ballet never selects the first available runtime."}</p><Button type="button" size="sm" disabled={Boolean(validationError) || editor.saving || editor.loading} onClick={() => void editor.save().then((saved) => { if (saved) onSaved?.(); })}><Save /> {editor.saving ? "Saving…" : "Save execution"}</Button></div>
    </section>
  );
}

function ExecutionSelect({ label, value, placeholder, disabled, options, onChange }: { label: string; value: string; placeholder: string; disabled: boolean; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  const id = useId();
  return <Field className="gap-1.5"><FieldLabel htmlFor={id}>{label}</FieldLabel><Select value={value} disabled={disabled} onValueChange={onChange}><SelectTrigger id={id} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent align="start"><SelectGroup>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>;
}
