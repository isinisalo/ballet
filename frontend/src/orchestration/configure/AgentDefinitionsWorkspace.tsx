import { useEffect, useMemo, useState } from "react";
import { Cpu, Plus } from "lucide-react";
import type { AgentExecutionBinding, RuntimeBackend, RuntimeDevice } from "@shared/domain/runtime";
import type { AgentDefinition } from "@shared/orchestration/environment";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownWorkbench } from "@/workspace/documents/MarkdownWorkbench";
import { orchestrationEntityPath } from "@/workspace/routing";
import { orchestrationApi } from "../orchestrationApi";
import type { ReferenceEntry, ResourceDocument } from "../types";
import { ConfigureHeader } from "./ConfigureHeader";
import { agentValueFromMarkdown, createAgentMarkdownDocument, markdownEntity, splitMarkdownSource } from "./markdownAuthoring";

export function AgentDefinitionsWorkspace({ profiles, documents, references, selectedId, locked, navigate, onSave, onDelete }: {
  profiles: AgentDefinition[]; documents: ResourceDocument[]; references: ReferenceEntry[]; selectedId?: string; locked: boolean;
  navigate(path: string): void;
  onSave(value: AgentDefinition, source: string, creating: boolean, expectedHash: string | "absent"): Promise<boolean>;
  onDelete(value: AgentDefinition, expectedHash: string): Promise<boolean>;
}) {
  const [creating, setCreating] = useState(false);
  const selected = profiles.find(({ id }) => id === selectedId);
  const document = creating ? createAgentMarkdownDocument() : documents.find(({ id }) => id === selected?.id);
  const choose = (id?: string) => { setCreating(!id); navigate(id ? orchestrationEntityPath("/agents", id) : "/agents"); };
  return <><ConfigureHeader title="Agents" description="Agent identity is canonical Markdown. Execution binds the selected Agent to one paired computer and an exact Codex CLI or Copilot CLI backend." status={locked ? "Locked by active Run" : `${profiles.length} agents`} actions={<Button size="sm" disabled={locked} onClick={() => choose(undefined)}><Plus />New Agent</Button>} />
    <div className="grid min-w-0 gap-4 p-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:p-6"><section aria-label="Agent list"><ul className="space-y-2">{profiles.map((agent) => { const usage = references.find((entry) => entry.kind === "agent" && entry.id === agent.id)?.references.length ?? 0; return <li key={agent.id}><button className="w-full border bg-card p-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-current={agent.id === selectedId ? "page" : undefined} onClick={() => choose(agent.id)}><code className="text-xs text-tertiary">{agent.id}</code><strong className="mt-1 block">{agent.name}</strong><span className="text-xs text-muted-foreground">{agent.enabled ? "Enabled" : "Disabled"} · {usage} role uses</span></button></li>; })}</ul></section>
      {document ? <AgentEditor key={`${document.id}:${creating}`} document={document} current={selected} creating={creating} locked={locked} navigate={navigate} onSave={onSave} onDelete={onDelete} /> : <section className="grid min-h-64 place-items-center border border-dashed text-center text-muted-foreground"><div><h2 className="font-semibold text-foreground">Select an Agent</h2><p>The Markdown editor and daemon binding open here.</p></div></section>}
    </div></>;
}

function AgentEditor({ document, current, creating, locked, navigate, onSave, onDelete }: {
  document: ResourceDocument; current?: AgentDefinition; creating: boolean; locked: boolean; navigate(path: string): void;
  onSave(value: AgentDefinition, source: string, creating: boolean, expectedHash: string | "absent"): Promise<boolean>;
  onDelete(value: AgentDefinition, expectedHash: string): Promise<boolean>;
}) {
  const original = useMemo(() => splitMarkdownSource(document.content), [document.content]);
  const [frontmatterText, setFrontmatterText] = useState(original.frontmatterText); const [bodyText, setBodyText] = useState(original.bodyText);
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const dirty = original.frontmatterText !== frontmatterText || original.bodyText !== bodyText;
  let validation = ""; try { agentValueFromMarkdown({ frontmatterText, bodyText }); } catch (reason) { validation = message(reason); }
  const entity = markdownEntity(document, { frontmatterText, bodyText });
  const save = async () => { setPending(true); setError(""); try { const parsed = agentValueFromMarkdown({ frontmatterText, bodyText }); const saved = await onSave(parsed.value, parsed.source, creating, document.contentHash as string | "absent"); if (saved) navigate(orchestrationEntityPath("/agents", parsed.value.id)); } catch (reason) { setError(message(reason)); } finally { setPending(false); } };
  return <div className="min-w-0 space-y-3"><MarkdownWorkbench document={entity} emptyTitle="Select an Agent" formId={`agent-${document.id}`} saveLabel="Save Agent Markdown" frontmatterText={frontmatterText} bodyText={bodyText} dirty={dirty} valid={!validation && !locked} pending={pending} fieldErrors={validation ? { frontmatter: validation } : undefined} serverError={error} deleteLabel="Delete Agent" deleteType="agent" resourceName={current?.name} onDelete={current ? async () => { if (await onDelete(current, document.contentHash)) navigate("/agents"); } : undefined} onFrontmatterChange={setFrontmatterText} onBodyChange={setBodyText} onSubmit={save} />
    {current ? <AgentExecutionForm agentId={current.id} /> : null}</div>;
}

function AgentExecutionForm({ agentId }: { agentId: string }) {
  const [devices, setDevices] = useState<RuntimeDevice[]>([]); const [binding, setBinding] = useState<AgentExecutionBinding | null>(null);
  const [deviceId, setDeviceId] = useState(""); const [backendId, setBackendId] = useState(""); const [model, setModel] = useState(""); const [reasoning, setReasoning] = useState("");
  const [network, setNetwork] = useState(false); const [readOnlyRoots, setReadOnlyRoots] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  useEffect(() => { void Promise.all([orchestrationApi.runtimeDevices(), orchestrationApi.agentBinding(agentId)]).then(([nextDevices, nextBinding]) => {
    setDevices(nextDevices); setBinding(nextBinding); setDeviceId(nextBinding?.deviceId ?? ""); setBackendId(nextBinding?.runtimeBackendId ?? ""); setModel(nextBinding?.model ?? ""); setReasoning(nextBinding?.reasoning ?? ""); setNetwork(nextBinding?.policy.network ?? false); setReadOnlyRoots(nextBinding?.policy.readOnlyRoots.join("\n") ?? "");
  }).catch((reason) => setError(message(reason))); }, [agentId]);
  const device = devices.find(({ id }) => id === deviceId); const backends = device?.backends ?? []; const backend = backends.find(({ id }) => id === backendId);
  const models = backend?.capabilities.models ?? []; const modelCapability = models.find(({ id }) => id === model); const reasoningOptions = modelCapability?.reasoningOptions ?? [];
  const selectDevice = (id: string) => { setDeviceId(id); setBackendId(""); setModel(""); setReasoning(""); };
  const selectBackend = (id: string) => { const next = backends.find((item) => item.id === id); const first = next?.capabilities.models[0]; setBackendId(id); setModel(first?.id ?? ""); setReasoning(first?.defaultReasoning ?? first?.reasoningOptions[0] ?? "default"); };
  const save = async () => { if (!backendId || !model || !reasoning) return; setPending(true); setError(""); try { const saved = await orchestrationApi.saveAgentBinding(agentId, { runtimeBackendId: backendId, model, reasoning, policy: { network, readOnlyRoots: readOnlyRoots.split("\n").map((value) => value.trim()).filter(Boolean) } }); setBinding(saved); } catch (reason) { setError(message(reason)); } finally { setPending(false); } };
  return <section className="border bg-card" aria-label="Agent execution settings"><header className="border-b bg-panel-header p-4"><h2 className="flex items-center gap-2 font-semibold"><Cpu className="size-4" />Execution</h2><p className="text-xs text-muted-foreground">Select an explicit paired computer, CLI provider, model and policy for this Agent.</p></header>{error ? <Alert variant="destructive" className="m-3"><AlertDescription>{error}</AlertDescription></Alert> : null}<div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4"><NativeSelect label="Computer" value={deviceId} onChange={selectDevice} options={devices.map((item) => ({ value: item.id, label: `${item.displayName} · ${item.status}` }))} /><NativeSelect label="CLI provider" value={backendId} onChange={selectBackend} options={backends.map((item) => ({ value: item.id, label: providerName(item) }))} /><NativeSelect label="Model" value={model} onChange={(value) => { setModel(value); const next = models.find((item) => item.id === value); setReasoning(next?.defaultReasoning ?? next?.reasoningOptions[0] ?? "default"); }} options={models.map((item) => ({ value: item.id, label: item.label }))} /><NativeSelect label="Reasoning" value={reasoning} onChange={setReasoning} options={reasoningOptions.map((value) => ({ value, label: value }))} /></div><div className="grid gap-3 border-t p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]"><Label className="flex items-center gap-2">Network <Switch checked={network} disabled={!backend?.capabilities.policy.networkControl} onCheckedChange={setNetwork} /></Label><Label>Additional read-only roots<Textarea className="mt-1 min-h-16 font-mono text-xs" value={readOnlyRoots} disabled={!backend?.capabilities.policy.readOnlyRoots} onChange={(event) => setReadOnlyRoots(event.target.value)} placeholder="One absolute path per line" /></Label><Button className="self-end" disabled={pending || !backendId || !model || !reasoning} onClick={() => void save()}>{pending ? "Saving…" : binding ? "Update execution" : "Save execution"}</Button></div></section>;
}

function NativeSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange(value: string): void }) {
  return <Label>{label}<select className="mt-1 h-9 w-full border bg-background px-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Label>;
}
const providerName = (backend: RuntimeBackend): string => backend.provider === "codex" ? "Codex CLI" : "GitHub Copilot CLI";
const message = (reason: unknown): string => reason instanceof Error ? reason.message : "Agent operation failed.";
