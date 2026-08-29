import { useEffect, useMemo, useState } from "react";
import { Cpu, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentExecutionBinding, RuntimeBackend, RuntimeDevice } from "@shared/domain/runtime";
import type { AgentDefinition } from "@shared/orchestration/environment";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EditorActions } from "@/components/shared/editor-actions";
import { Switch } from "@/components/ui/switch";
import { SelectField, TextAreaField } from "@/components/shared/workspace-ui";
import { MarkdownWorkbench } from "@/workspace/documents/MarkdownWorkbench";
import { orchestrationEntityPath } from "@/workspace/routing";
import { orchestrationApi } from "../orchestrationApi";
import type { ReferenceEntry, ResourceDocument } from "../types";
import { ConfigureHeader } from "./ConfigureHeader";
import { ConfigureToolbar } from "./ConfigureToolbar";
import { agentValueFromMarkdown, createAgentMarkdownDocument, markdownEntity, splitMarkdownSource } from "./markdownAuthoring";

export function AgentDefinitionsWorkspace({ profiles, documents, selectedId, locked, navigate, onSave, onDelete }: {
  profiles: AgentDefinition[]; documents: ResourceDocument[]; references: ReferenceEntry[]; selectedId?: string; locked: boolean;
  navigate(path: string): void;
  onSave(value: AgentDefinition, source: string, creating: boolean, expectedHash: string | "absent"): Promise<boolean>;
  onDelete(value: AgentDefinition, expectedHash: string): Promise<boolean>;
}) {
  const [creating, setCreating] = useState(false);
  const selected = profiles.find(({ id }) => id === selectedId);
  const document = creating ? createAgentMarkdownDocument() : documents.find(({ id }) => id === selected?.id);
  const choose = (id?: string) => { setCreating(!id); navigate(id ? orchestrationEntityPath("/agents", id) : "/agents"); };
  const status = locked ? "Locked by active Run" : `${profiles.length} agents`;
  return <><ConfigureHeader title="Agents" description="Select an Agent from the sidebar; edit its canonical Markdown and machine-local execution binding here." />
    {document ? <AgentEditor key={`${document.id}:${creating}`} document={document} current={selected} creating={creating} locked={locked} status={status} onCreate={() => choose(undefined)} navigate={navigate} onSave={onSave} onDelete={onDelete} /> : <><ConfigureToolbar status={status}><Button size="sm" disabled={locked} onClick={() => choose(undefined)}><Plus />New Agent</Button></ConfigureToolbar><section className="m-4 grid min-h-64 place-items-center border border-dashed text-center text-muted-foreground md:m-6"><div><h2 className="font-semibold text-foreground">Select an Agent</h2><p>The Markdown editor and daemon binding open here.</p></div></section></>}
  </>;
}

function AgentEditor({ document, current, creating, locked, status, onCreate, navigate, onSave, onDelete }: {
  document: ResourceDocument; current?: AgentDefinition; creating: boolean; locked: boolean; navigate(path: string): void;
  status: string; onCreate(): void;
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
  const formId = `agent-${document.id}`; const valid = !validation && !locked; const deleteAgent = current ? async () => { if (await onDelete(current, document.contentHash)) navigate("/agents"); } : undefined;
  const markdownActions = <><Button size="sm" variant="outline" disabled={locked} onClick={onCreate}><Plus />New Agent</Button><EditorActions saveLabel="Save Agent Markdown" formId={formId} dirty={dirty} valid={valid} pending={pending} canDelete={Boolean(deleteAgent)} deleteLabel="Delete Agent" deleteType="agent" resourceName={current?.name} onDelete={deleteAgent} /></>;
  const editor = <MarkdownWorkbench document={entity} emptyTitle="Select an Agent" formId={formId} saveLabel="Save Agent Markdown" frontmatterText={frontmatterText} bodyText={bodyText} dirty={dirty} valid={valid} pending={pending} fieldErrors={validation ? { frontmatter: validation } : undefined} serverError={error} showActions={false} onFrontmatterChange={setFrontmatterText} onBodyChange={setBodyText} onSubmit={save} />;
  return current ? <AgentExecutionForm agentId={current.id} status={status} label={current.id} toolbarActions={markdownActions}>{editor}</AgentExecutionForm> : <div className="min-w-0"><ConfigureToolbar status={status} label="New Agent">{markdownActions}</ConfigureToolbar><div className="p-4 md:p-6">{editor}</div></div>;
}

function AgentExecutionForm({ agentId, status, label, toolbarActions, children }: { agentId: string; status: string; label: string; toolbarActions: ReactNode; children: ReactNode }) {
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
  return <div className="min-w-0"><ConfigureToolbar status={status} label={label}>{toolbarActions}<Button size="sm" disabled={pending || !backendId || !model || !reasoning} onClick={() => void save()}>{pending ? "Saving execution…" : binding ? "Update execution" : "Save execution"}</Button></ConfigureToolbar><div className="space-y-3 p-4 md:p-6">{children}<section className="border bg-card" aria-label="Agent execution settings"><header className="border-b bg-panel-header p-4"><h2 className="flex items-center gap-2 font-semibold"><Cpu className="size-4" />Execution</h2><p className="text-xs text-muted-foreground">Select an explicit paired computer, CLI provider, model and policy for this Agent.</p></header>{error ? <Alert variant="destructive" className="m-3"><AlertDescription>{error}</AlertDescription></Alert> : null}<div className="grid max-w-2xl gap-3 p-4"><NativeSelect label="Computer" value={deviceId} onChange={selectDevice} options={devices.map((item) => ({ value: item.id, label: `${item.displayName} · ${item.status}` }))} /><NativeSelect label="CLI provider" value={backendId} onChange={selectBackend} options={backends.map((item) => ({ value: item.id, label: providerName(item) }))} /><NativeSelect label="Model" value={model} onChange={(value) => { setModel(value); const next = models.find((item) => item.id === value); setReasoning(next?.defaultReasoning ?? next?.reasoningOptions[0] ?? "default"); }} options={models.map((item) => ({ value: item.id, label: item.label }))} /><NativeSelect label="Reasoning" value={reasoning} onChange={setReasoning} options={reasoningOptions.map((value) => ({ value, label: value }))} /><div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 text-xs"><span className="text-muted-foreground">Network</span><Switch checked={network} disabled={!backend?.capabilities.policy.networkControl} aria-label="Network" onCheckedChange={setNetwork} /></div><TextAreaField label="Read-only roots" layout="row" density="compact" value={readOnlyRoots} disabled={!backend?.capabilities.policy.readOnlyRoots} placeholder="One absolute path per line" onChange={setReadOnlyRoots} /></div></section></div></div>;
}

function NativeSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange(value: string): void }) {
  return <SelectField label={label} layout="row" density="compact" value={value} placeholder="Select…" options={options} onChange={onChange} />;
}
const providerName = (backend: RuntimeBackend): string => backend.provider === "codex" ? "Codex CLI" : "GitHub Copilot CLI";
const message = (reason: unknown): string => reason instanceof Error ? reason.message : "Agent operation failed.";
