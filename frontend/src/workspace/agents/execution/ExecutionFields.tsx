import { useId } from "react";
import type { LocalProviderStatus, RuntimeProvider } from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { providerLabel } from "../../runtimes/runtimeRegistry";
import { modelOptions, reasoningOptions } from "./executionOptions";
import type { AgentRuntimeConfigurationEditor } from "./AgentExecutionForm";

export function ExecutionSelectionFields({ compact, editor, provider, onProviderChange, onModelChange, onReasoningChange }: {
  compact: boolean;
  editor: AgentRuntimeConfigurationEditor;
  provider?: LocalProviderStatus;
  onProviderChange: (provider: RuntimeProvider) => void;
  onModelChange: (model: string) => void;
  onReasoningChange: (reasoning: string) => void;
}) {
  const models = provider ? modelOptions(provider) : editor.form.model ? [{ value: editor.form.model, label: editor.form.model }] : [];
  const reasoning = provider ? reasoningOptions(provider, editor.form.model) : editor.form.reasoning ? [{ value: editor.form.reasoning, label: editor.form.reasoning }] : [];
  return (
    <div className={compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-3"}>
      <ExecutionSelect compact={compact} label="Provider" value={editor.form.provider} placeholder="Select provider" options={editor.providers.map((item) => ({ value: item.provider, label: providerLabel(item.provider) }))} onChange={(value) => onProviderChange(value as RuntimeProvider)} />
      <ExecutionSelect compact={compact} label="Model" value={editor.form.model} placeholder="Select model" disabled={!provider} options={models} onChange={onModelChange} />
      <ExecutionSelect compact={compact} label="Reasoning effort" value={editor.form.reasoning} placeholder="Select effort" disabled={!provider || !editor.form.model} options={reasoning} onChange={onReasoningChange} />
    </div>
  );
}

export function ExecutionPolicyFields({ agentId, compact, editor, provider, advancedOpen, onAdvancedOpenChange, onPersist }: {
  agentId: string;
  compact: boolean;
  editor: AgentRuntimeConfigurationEditor;
  provider?: LocalProviderStatus;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
  onPersist: (pending: Promise<boolean>) => void;
}) {
  const supportsNetwork = provider?.capabilities.policy.networkControl ?? false;
  const supportsRoots = provider?.capabilities.policy.readOnlyRoots ?? false;
  const setRoots = (value: string) => editor.updateForm({ policy: { ...editor.form.policy, readOnlyRoots: value.split("\n").map((root) => root.trim()).filter(Boolean) } });
  return (
    <>
      <div className={compact ? "grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 text-xs leading-4" : "flex items-center justify-between gap-4 text-xs"}><span className="text-muted-foreground">Network access</span><Switch checked={editor.form.policy.network} disabled={!supportsNetwork} aria-label="Network access" onCheckedChange={(network) => onPersist(editor.updateAndSave({ policy: { ...editor.form.policy, network } }))} /></div>
      <Collapsible open={advancedOpen} onOpenChange={onAdvancedOpenChange}>
        <CollapsibleTrigger render={<Button type="button" size="sm" variant="ghost" className={cn("px-0 text-muted-foreground", compact && "h-6 text-xs")}><ChevronDown className={cn("transition-transform", advancedOpen && "rotate-180")} /> Advanced policy</Button>} />
        <CollapsibleContent className="grid gap-3 border-t border-divider-strong pt-3"><Field className="gap-1.5"><FieldLabel htmlFor={`read-only-roots-${agentId}`}>Additional read-only roots</FieldLabel><Textarea id={`read-only-roots-${agentId}`} className="min-h-20 font-mono text-base md:text-xs" disabled={!supportsRoots} placeholder="One absolute path per line" value={editor.form.policy.readOnlyRoots.join("\n")} onBlur={() => onPersist(editor.saveIfValid())} onChange={(event) => setRoots(event.target.value)} /></Field></CollapsibleContent>
      </Collapsible>
    </>
  );
}

function ExecutionSelect({ label, value, placeholder, disabled = false, options, onChange, compact }: { label: string; value: string; placeholder: string; disabled?: boolean; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; compact: boolean }) {
  const id = useId();
  const select = <Select items={options} value={value} disabled={disabled} onValueChange={(next) => { if (next !== null) onChange(next); }}><SelectTrigger id={id} className={compact ? "h-10 w-full font-mono text-base md:h-8 md:text-xs" : "w-full"}><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent align="start"><SelectGroup>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent></Select>;
  return compact ? <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 text-xs leading-4"><FieldLabel htmlFor={id} className="text-muted-foreground">{label}</FieldLabel>{select}</div> : <Field className="gap-1.5"><FieldLabel htmlFor={id}>{label}</FieldLabel>{select}</Field>;
}
