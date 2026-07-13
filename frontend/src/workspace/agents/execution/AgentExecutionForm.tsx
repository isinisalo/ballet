import { useState } from "react";
import { Cpu } from "lucide-react";
import type { AgentRuntimeConfiguration, LocalRuntime } from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { providerReadiness } from "../../runtimes/runtimeRegistry";
import { ExecutionPolicyFields, ExecutionSelectionFields } from "./ExecutionFields";
import { executionFormError, PROVIDER_DEFAULT, reasoningOptions, selectedExecutionProvider } from "./executionOptions";
import { useAgentRuntimeConfiguration } from "./useAgentRuntimeConfiguration";

export type AgentRuntimeConfigurationEditor = ReturnType<typeof useAgentRuntimeConfiguration>;

export function AgentExecutionForm({ agentId, runtime, configuration, onSaved }: {
  agentId: string;
  runtime: LocalRuntime;
  configuration?: AgentRuntimeConfiguration;
  onSaved?: () => void;
}) {
  const editor = useAgentRuntimeConfiguration(agentId, runtime, configuration);
  return <AgentExecutionSettingsForm agentId={agentId} editor={editor} onSaved={onSaved} />;
}

export function AgentExecutionSettingsForm({ agentId, editor, onSaved, compact = false }: {
  agentId: string;
  editor: AgentRuntimeConfigurationEditor;
  onSaved?: () => void;
  compact?: boolean;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const provider = selectedExecutionProvider(editor.providers, editor.form.provider);
  const readiness = provider ? providerReadiness(provider) : undefined;
  const validationError = executionFormError(editor.form, editor.providers);
  const persist = (pending: Promise<boolean>) => void pending.then((saved) => { if (saved) onSaved?.(); });
  const selectModel = (model: string) => {
    const options = reasoningOptions(provider, model);
    persist(editor.updateAndSave({ model, reasoning: options.length === 1 && options[0]?.value === PROVIDER_DEFAULT ? PROVIDER_DEFAULT : "" }));
  };

  return (
    <section className={cn(
      "grid gap-3 border-divider-strong",
      compact
        ? "border-t px-5 py-4"
        : "border-t bg-panel-section p-4"
    )} aria-label="Agent execution settings">
      <header className={cn(!compact && "flex items-start justify-between gap-3")}>
        <div><h3 className={cn("flex items-center gap-2 font-medium", compact ? "font-mono text-[10px] uppercase leading-4 tracking-[0.05em] text-muted-foreground" : "text-sm font-semibold")}><Cpu className={compact ? "size-3.5" : "size-4 text-muted-foreground"} /> Execution</h3>{!compact ? <p className="text-xs text-muted-foreground">Configure the local CLI provider and portable execution intent.</p> : null}</div>
        {readiness && !compact ? <span className={cn("border px-2 py-1 font-mono text-[0.6rem] uppercase", readiness.tone === "healthy" ? "border-secondary/30 text-secondary" : readiness.tone === "error" ? "border-destructive/30 text-destructive" : "border-tertiary/30 text-tertiary")}>{readiness.label}</span> : null}
      </header>
      {editor.error ? compact ? <p role="alert" className="text-xs leading-4 text-destructive">{editor.error}</p> : <Alert variant="destructive"><AlertDescription>{editor.error}</AlertDescription></Alert> : null}
      {editor.configuration?.issues.length ? <RuntimeIssues issues={editor.configuration.issues.map((issue) => issue.message)} compact={compact} /> : null}
      <ExecutionSelectionFields
        compact={compact}
        editor={editor}
        provider={provider}
        onProviderChange={(value) => persist(editor.selectProvider(value))}
        onModelChange={selectModel}
        onReasoningChange={(reasoning) => persist(editor.updateAndSave({ reasoning }))}
      />
      {!compact ? <div className="border border-divider-strong bg-background px-3 py-2 text-xs"><span className="font-medium text-foreground">Write scope:</span> <span className="text-muted-foreground">current project checkout only</span></div> : null}
      <ExecutionPolicyFields
        agentId={agentId}
        compact={compact}
        editor={editor}
        provider={provider}
        advancedOpen={advancedOpen}
        onAdvancedOpenChange={setAdvancedOpen}
        onPersist={persist}
      />
      <p className="text-xs leading-4 text-muted-foreground">{editor.saving ? "Autosave · Saving execution configuration…" : validationError ?? "Autosave · Intent is stored in .ballet/project.json; absolute roots stay in .git/ballet/settings.json."}</p>
    </section>
  );
}

function RuntimeIssues({ issues, compact }: { issues: string[]; compact: boolean }) {
  const content = <><span>{issues.join(" · ")}</span>{" "}<a className="font-medium underline underline-offset-2" href="/runtimes">Open Runtimes</a></>;
  return compact ? <p role="alert" className="font-mono text-[0.62rem] leading-4 text-destructive">{content}</p> : <Alert variant="destructive"><AlertDescription>{content}</AlertDescription></Alert>;
}
