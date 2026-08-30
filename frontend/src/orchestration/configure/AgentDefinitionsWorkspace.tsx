import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { SelectField } from "@/components/shared/workspace-ui";
import type { GovernanceAgentId } from "@shared/orchestration/environment";
import type { LocalDaemonStatus } from "@shared/domain/runtime";
import type { GovernanceAgentsResponse, GovernanceAgentSlot, ResourceDocument } from "../types";
import { orchestrationApi } from "../orchestrationApi";
import { ConfigureToolbar } from "./ConfigureToolbar";

type SaveInput = { developerInstructions: string; model: string; reasoningEffort: string; skillResources: string[];
  expectedConfigHash: string; expectedDocumentHash: string };

export function AgentDefinitionsWorkspace({ response, skills, selectedId, locked, onSave }: {
  response: GovernanceAgentsResponse; skills: ResourceDocument[]; selectedId?: string; locked: boolean;
  onSave(id: GovernanceAgentId, input: SaveInput): Promise<boolean>;
}) {
  const selected = response.agents.find(({ id }) => id === selectedId);
  if (!selected) return <><ConfigureToolbar status="2 fixed Agents" /><section className="grid min-h-64 place-items-center border-b border-dashed p-6 text-center"><div><h1 className="font-semibold">Select a governance Agent</h1><p className="text-sm text-muted-foreground">Critic and Refinement are the only configurable Agent roles.</p></div></section></>;
  return <AgentEditor key={`${selected.id}:${selected.contentHash ?? selected.status}`} slot={selected} skills={skills}
    configHash={response.configHash} locked={locked} onSave={onSave} />;
}

// eslint-disable-next-line complexity -- One fixed-role form keeps dirty, invalid, locked and save states visibly coherent.
function AgentEditor({ slot, skills, configHash, locked, onSave }: {
  slot: GovernanceAgentSlot; skills: ResourceDocument[]; configHash: string; locked: boolean;
  onSave(id: GovernanceAgentId, input: SaveInput): Promise<boolean>;
}) {
  const [instructions, setInstructions] = useState(slot.agent?.developerInstructions ?? "");
  const [model, setModel] = useState(slot.agent?.model ?? "");
  const [reasoningEffort, setReasoningEffort] = useState(slot.agent?.reasoningEffort ?? "");
  const [skillResources, setSkillResources] = useState(slot.skillResources);
  const [runtime, setRuntime] = useState<LocalDaemonStatus>();
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void orchestrationApi.localRuntime().then(setRuntime).catch(() => undefined); }, []);
  const models = useMemo(() => {
    const values = runtime?.providers[0]?.capabilities.models ?? [];
    return model && !values.some(({ id }) => id === model)
      ? [{ id: model, label: model, reasoningOptions: [reasoningEffort] }, ...values] : values;
  }, [model, reasoningEffort, runtime]);
  const reasoning = models.find(({ id }) => id === model)?.reasoningOptions ?? (reasoningEffort ? [reasoningEffort] : []);
  const dirty = Boolean(slot.agent) && (instructions !== slot.agent!.developerInstructions || model !== slot.agent!.model
    || reasoningEffort !== slot.agent!.reasoningEffort || JSON.stringify(skillResources) !== JSON.stringify(slot.skillResources));
  const ready = slot.status === "ready" && Boolean(slot.agent && slot.contentHash);
  const status = locked ? "Locked by active Run" : ready ? (dirty ? "Unsaved" : "Ready") : `Invalid · ${slot.status}`;
  const save = async () => {
    if (!ready || !dirty || locked || pending) return;
    setPending(true); setError("");
    try { await onSave(slot.id, { developerInstructions: instructions, model, reasoningEffort,
      skillResources: [...skillResources].sort(), expectedConfigHash: configHash, expectedDocumentHash: slot.contentHash! }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Agent save failed."); }
    finally { setPending(false); }
  };
  return <div className="min-w-0 overflow-x-hidden"><ConfigureToolbar status={status} label={slot.id}><Button size="sm" disabled={!ready || !dirty || locked || pending} onClick={() => void save()}><Save />{pending ? "Saving…" : "Save Agent"}</Button></ConfigureToolbar>
    {!ready ? <AgentFileError slot={slot} /> : <form className="grid min-w-0 border-b border-divider-strong bg-card xl:min-h-[calc(100vh-8rem)] xl:grid-cols-[18rem_minmax(0,1fr)_20rem]" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <aside aria-label="Agent profile" className="min-w-0 space-y-4 border-b border-divider-strong p-4 xl:border-b-0 xl:border-r"><section><p className="font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">Identity</p><h1 className="mt-1 break-words text-lg font-semibold">{title(slot.id)}</h1><p className="mt-1 text-sm text-muted-foreground">{slot.agent!.description}</p></section><dl className="grid gap-2 text-xs"><div><dt className="text-muted-foreground">Provider</dt><dd className="font-mono">Codex CLI · fixed</dd></div><div><dt className="text-muted-foreground">Sandbox</dt><dd className="font-mono">read-only · fixed</dd></div></dl>
        <SelectField label="Model" density="compact" value={model} options={models.map(({ id, label }) => ({ value: id, label }))} onChange={(value) => { setModel(value); const selected = models.find(({ id }) => id === value); setReasoningEffort(selected?.defaultReasoning ?? selected?.reasoningOptions[0] ?? ""); }} />
        <SelectField label="Reasoning" density="compact" value={reasoningEffort} options={reasoning.map((value) => ({ value, label: value }))} onChange={setReasoningEffort} />
        <label className="grid gap-1 text-xs"><span className="text-muted-foreground">Skills</span><MultiSelect ariaLabel="Agent Skills" values={skillResources} options={skills.map(({ id }) => ({ value: id, label: id }))} onValuesChange={(values) => setSkillResources([...values].sort())} /></label>
      </aside>
      <main aria-label="Developer instructions editor" className="flex min-h-[32rem] min-w-0 flex-col border-b border-divider-strong p-4 xl:border-b-0 xl:border-r"><label htmlFor={`instructions-${slot.id}`} className="mb-2 font-semibold">Developer instructions</label><p className="mb-3 text-xs text-muted-foreground">Markdown stored in <code>{slot.relativePath}</code>.</p><textarea id={`instructions-${slot.id}`} aria-label="Developer instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} className="min-h-[28rem] min-w-0 flex-1 resize-y rounded-sm border border-divider-strong bg-background p-4 font-mono text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" spellCheck={false} />{error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}</main>
      <PurposeGuide id={slot.id} />
    </form>}
  </div>;
}

function AgentFileError({ slot }: { slot: GovernanceAgentSlot }) {
  return <section role="alert" className="m-4 max-w-3xl border border-destructive bg-card p-5 md:m-6"><h1 className="text-lg font-semibold">Agent TOML is {slot.status}</h1><p className="mt-2 text-sm">{slot.error}</p><p className="mt-3 text-sm text-muted-foreground">Restore the exact file from Git:</p><code className="mt-1 block break-all border bg-background p-3 text-xs">{slot.relativePath}</code><p className="mt-3 text-sm text-muted-foreground">Ballet does not create or repair governance Agent files from the UI.</p></section>;
}

function PurposeGuide({ id }: { id: GovernanceAgentId }) {
  const critic = id === "ballet-critic-agent";
  return <aside aria-label="Agent purpose guide" className="min-w-0 space-y-5 p-4"><section><p className="font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">Purpose</p><h2 className="mt-1 font-semibold">{critic ? "Find evidence-backed quality gaps" : "Propose exact safe refinements"}</h2><p className="mt-2 text-sm text-muted-foreground">{critic ? "Runs manually or on the existing schedule and evaluates immutable Run Evidence read-only." : "Starts from approved Feedback and maps it to exact instruction or Skill changes."}</p></section><section><h3 className="font-semibold">Workflow</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">{critic ? <><li>Inspect Run Evidence and accepted contracts.</li><li>Produce a Critic proposal.</li><li>Human approval alone creates Feedback.</li></> : <><li>Inspect selected Feedback and impact closure.</li><li>Produce an exact hash-bound proposal.</li><li>Human approval permits apply and a new continuation Run.</li></>}</ol></section><section><h3 className="font-semibold">Safety boundary</h3><p className="mt-2 text-sm text-muted-foreground">Read-only sandbox, no network access and no autonomous approval. {critic ? "A proposal is never Feedback by itself." : "The parent Run and its Action status are never reset or mutated."}</p></section></aside>;
}

const title = (id: GovernanceAgentId): string => id === "ballet-critic-agent" ? "Critic Agent" : "Refinement Agent";
