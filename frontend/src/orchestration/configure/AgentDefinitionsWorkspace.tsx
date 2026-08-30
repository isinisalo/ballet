import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { AgentDefinition } from "@shared/orchestration/environment";
import { Button } from "@/components/ui/button";
import { EditorActions } from "@/components/shared/editor-actions";
import { MarkdownWorkbench } from "@/workspace/documents/MarkdownWorkbench";
import { orchestrationEntityPath } from "@/workspace/routing";
import type { ReferenceEntry, ResourceDocument } from "../types";
import { AgentExecutionBinding } from "./AgentExecutionBinding";
import { ConfigureToolbar } from "./ConfigureToolbar";
import { agentValueFromMarkdown, createAgentMarkdownDocument, markdownEntity, splitMarkdownSource } from "./markdownAuthoring";
import { useAgentExecutionBinding } from "./useAgentExecutionBinding";

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
  return document ? <AgentEditor key={`${document.id}:${creating}`} document={document} current={selected} creating={creating} locked={locked} status={status} onCreate={() => choose(undefined)} navigate={navigate} onSave={onSave} onDelete={onDelete} /> : <><ConfigureToolbar status={status}><Button size="sm" disabled={locked} onClick={() => choose(undefined)}><Plus />New Agent</Button></ConfigureToolbar><section className="grid min-h-64 place-items-center border-b border-dashed text-center text-muted-foreground"><div><h1 className="font-semibold text-foreground">Select an Agent</h1><p>The profile, Markdown and execution binding open here.</p></div></section></>;
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
  const execution = useAgentExecutionBinding(current?.id);
  const dirty = original.frontmatterText !== frontmatterText || original.bodyText !== bodyText;
  let validation = ""; try { agentValueFromMarkdown({ frontmatterText, bodyText }); } catch (reason) { validation = message(reason); }
  const entity = markdownEntity(document, { frontmatterText, bodyText });
  const save = async () => { setPending(true); setError(""); try { const parsed = agentValueFromMarkdown({ frontmatterText, bodyText }); const saved = await onSave(parsed.value, parsed.source, creating, document.contentHash as string | "absent"); if (saved) navigate(orchestrationEntityPath("/agents", parsed.value.id)); } catch (reason) { setError(message(reason)); } finally { setPending(false); } };
  const formId = `agent-${document.id}`; const valid = !validation && !locked; const deleteAgent = current ? async () => { if (await onDelete(current, document.contentHash)) navigate("/agents"); } : undefined;
  const toolbarActions = <><Button size="sm" variant="outline" disabled={locked} onClick={onCreate}><Plus />New Agent</Button><EditorActions saveLabel="Save Agent Markdown" formId={formId} dirty={dirty} valid={valid} pending={pending} canDelete={Boolean(deleteAgent)} deleteLabel="Delete Agent" deleteType="agent" resourceName={current?.name} onDelete={deleteAgent} />{current ? <Button size="sm" disabled={execution.pending || !execution.canSave} onClick={() => void execution.save()}>{execution.pending ? "Saving execution…" : execution.binding ? "Update execution" : "Save execution"}</Button> : null}</>;
  const editor = <MarkdownWorkbench document={entity} emptyTitle="Select an Agent" formId={formId} saveLabel="Save Agent Markdown" frontmatterText={frontmatterText} bodyText={bodyText} dirty={dirty} valid={valid} pending={pending} fieldErrors={validation ? { frontmatter: validation } : undefined} serverError={error} showActions={false} onFrontmatterChange={setFrontmatterText} onBodyChange={setBodyText} onSubmit={save} />;
  if (!current) return <div className="min-w-0"><ConfigureToolbar status={status} label="New Agent">{toolbarActions}</ConfigureToolbar><div className="p-3 md:p-4">{editor}</div></div>;
  return <div className="min-w-0"><ConfigureToolbar status={status} label={current.id}>{toolbarActions}</ConfigureToolbar><section className="@container/agent-detail grid min-h-[42rem] min-w-0 border-b border-divider-strong bg-card lg:grid-cols-[18rem_minmax(0,1fr)]"><AgentExecutionBinding agent={current} execution={execution} /><div className="min-w-0">{editor}</div></section></div>;
}

const message = (reason: unknown): string => reason instanceof Error ? reason.message : "Agent operation failed.";
