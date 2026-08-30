import { Cpu, Search } from "lucide-react";
import type { LocalProviderStatus } from "@shared/domain/runtime";
import type { AgentDefinition } from "@shared/orchestration/environment";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { OperationalStatus, SelectField, TextAreaField } from "@/components/shared/workspace-ui";
import type { AgentExecutionBindingState } from "./useAgentExecutionBinding";

export function AgentExecutionBinding({ agent, execution }: {
  agent: AgentDefinition; execution: AgentExecutionBindingState;
}) {
  return <aside aria-label="Agent profile" className="min-w-0 border-b border-divider-strong bg-background lg:border-r lg:border-b-0">
    <section className="grid gap-3 px-5 py-4">
      <div className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">Avatar</div>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full border border-divider-strong bg-card"><Search className="size-6" /></span>
        <span className="min-w-0 flex-1 truncate rounded-sm border bg-card px-3 py-2 font-mono text-xs">{agent.id}</span>
      </div>
      <h1 className="text-base font-semibold">{agent.name}</h1>
      <p className="text-xs leading-4 text-muted-foreground">{agent.description}</p>
      <OperationalStatus compact label={agent.enabled ? "Enabled" : "Disabled"} tone={agent.enabled ? "healthy" : "neutral"} />
    </section>
    <section className="grid gap-3 border-t border-divider-strong px-5 py-4" aria-label="Agent execution settings">
      <h2 className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground"><Cpu className="size-3.5" />Execution</h2>
      {execution.error ? <Alert variant="destructive"><AlertDescription>{execution.error}</AlertDescription></Alert> : null}
      <NativeSelect label="Provider" value={execution.provider} onChange={execution.selectProvider}
        options={execution.providers.map((provider) => ({ value: provider.provider, label: providerName(provider) }))} />
      <NativeSelect label="Model" value={execution.model} onChange={(value) => {
        execution.setModel(value); const next = execution.models.find((model) => model.id === value);
        execution.setReasoningEffort(next?.defaultReasoning ?? next?.reasoningOptions[0] ?? "");
      }} options={execution.models.map((model) => ({ value: model.id, label: model.label }))} />
      <NativeSelect label="Reasoning" value={execution.reasoningEffort} onChange={execution.setReasoningEffort}
        options={execution.reasoningOptions.map((value) => ({ value, label: value }))} />
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 text-xs">
        <span className="text-muted-foreground">Network</span>
        <Switch checked={execution.network} disabled={!execution.providerStatus?.capabilities.policy.networkControl}
          aria-label="Network" onCheckedChange={execution.setNetwork} />
      </div>
      <TextAreaField label="Read-only roots" layout="row" density="compact" value={execution.readOnlyRoots}
        disabled={!execution.providerStatus?.capabilities.policy.readOnlyRoots} placeholder="One path per line"
        onChange={execution.setReadOnlyRoots} />
      <p className="text-xs text-muted-foreground">{execution.pending ? "Saving execution…"
        : execution.binding ? "Local execution binding saved" : "Select a ready local provider"}</p>
    </section>
    <section className="border-t border-divider-strong px-5 py-4">
      <h2 className="mb-3 font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">Details</h2>
      <dl className="grid gap-3 text-xs"><ProfileRow label="Skills" value={String(agent.skillResources.length)} />
        <ProfileRow label="ID" value={agent.id} technical /><ProfileRow label="Instruction" value={agent.instructionResource} technical /></dl>
    </section>
  </aside>;
}

function NativeSelect({ label, value, options, onChange }: {
  label: string; value: string; options: Array<{ value: string; label: string }>; onChange(value: string): void;
}) { return <SelectField label={label} layout="row" density="compact" value={value} placeholder="Select…" options={options} onChange={onChange} />; }
function ProfileRow({ label, value, technical = false }: { label: string; value: string; technical?: boolean }) {
  return <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">{label}</dt>
    <dd className={`min-w-0 truncate${technical ? " font-mono" : ""}`} title={value}>{value}</dd></div>;
}
const providerName = (provider: LocalProviderStatus): string =>
  `${provider.provider === "codex" ? "Codex CLI" : "GitHub Copilot CLI"} — ${provider.health}`;
