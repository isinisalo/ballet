import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OperationalStatus } from "@/components/shared/workspace-ui";
import type { UseCase } from "@shared/orchestration/direction";
import { useCaseApprovalHash } from "@shared/orchestration/direction";
import { MarkdownWorkbench } from "@/workspace/documents/MarkdownWorkbench";
import { orchestrationEntityPath } from "@/workspace/routing";
import type { ResourceDocument } from "../types";
import { ConfigureHeader } from "./ConfigureHeader";
import {
  createMarkdownDocument, directionValueFromMarkdown, markdownEntity, splitMarkdownSource,
  type MarkdownDirectionKind, type MarkdownDirectionValue
} from "./markdownAuthoring";

const basePath = (kind: MarkdownDirectionKind) => kind === "use-cases" ? "/project/use-cases" : `/project/${kind}`;
const title = (kind: MarkdownDirectionKind) => kind === "use-cases" ? "Use Cases" : kind === "adrs" ? "ADRs" : `${kind[0]?.toUpperCase()}${kind.slice(1)}`;

export function MarkdownDirectionWorkspace({ kind, values, documents, selectedId, locked, navigate, onSave, onDelete, onApprove, onDraft }: {
  kind: MarkdownDirectionKind; values: MarkdownDirectionValue[]; documents: ResourceDocument[]; selectedId?: string; locked: boolean;
  navigate(path: string): void;
  onSave(value: MarkdownDirectionValue, markdown: string, creating: boolean): Promise<void>;
  onDelete?(value: MarkdownDirectionValue): Promise<void>;
  onApprove?(value: UseCase): Promise<void>; onDraft?(value: UseCase): Promise<void>;
}) {
  const [creating, setCreating] = useState(false); const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState<"all" | "draft" | "approved">("all");
  const selected = values.find(({ id }) => id === selectedId);
  const document = creating ? createMarkdownDocument(kind) : documents.find(({ id }) => id === selected?.id);
  const visible = useMemo(() => kind !== "use-cases" || filter === "all" ? values : values.filter((value) => "examples" in value && value.status === filter), [filter, kind, values]);
  useEffect(() => { if (selectedId) setCreating(false); }, [selectedId]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const choose = (id?: string) => {
    if (dirty && !window.confirm("Discard unsaved Markdown changes?")) return;
    setCreating(!id); setDirty(false); navigate(id ? orchestrationEntityPath(basePath(kind), id) : basePath(kind));
  };
  const approvedCount = values.filter((value) => "examples" in value && value.status === "approved").length;
  return <><ConfigureHeader title={title(kind)} description={kind === "use-cases" ? "Keep the compact Use Case list; edit the selected canonical document as YAML frontmatter and Markdown." : `Edit canonical ${title(kind)} as version-controlled Markdown.`} status={locked ? "Locked by active Run" : kind === "use-cases" ? `${approvedCount} approved` : `${values.length} documents`} actions={<Button size="sm" disabled={locked} onClick={() => choose(undefined)}>Create</Button>} />
    <div className="grid min-w-0 gap-4 p-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:p-6">
      <section aria-label={`${title(kind)} list`} className="min-w-0">{kind === "use-cases" ? <label className="mb-3 grid gap-1 text-sm">Filter by status<select className="h-10 rounded-sm border bg-background px-2" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All</option><option value="draft">Draft</option><option value="approved">Approved</option></select></label> : null}
        <ul className="space-y-2">{visible.map((value) => <li key={value.id}><button className="min-h-14 w-full rounded-md border bg-card p-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-current={value.id === selectedId ? "page" : undefined} onClick={() => choose(value.id)}><span className="flex items-center justify-between gap-2"><code className="truncate text-tertiary">{value.id}</code><OperationalStatus compact label={value.status} tone={value.status === "approved" || value.status === "accepted" ? "healthy" : "attention"} /></span><strong className="mt-1 block truncate">{value.name}</strong>{"examples" in value ? <span className="text-xs text-muted-foreground">{value.examples.length} GWT example{value.examples.length === 1 ? "" : "s"}</span> : null}</button></li>)}</ul>
      </section>
      {document ? <MarkdownEditor key={`${kind}:${document.id}`} kind={kind} document={document} current={selected} creating={creating} locked={locked} onDirty={setDirty} onSave={onSave} onDelete={onDelete} onApprove={onApprove} onDraft={onDraft} /> : <section className="rounded-md border border-dashed p-6 text-muted-foreground">Select a document from the list. Its complete Markdown source opens here.</section>}
    </div></>;
}

function MarkdownEditor({ kind, document, current, creating, locked, onDirty, onSave, onDelete, onApprove, onDraft }: {
  kind: MarkdownDirectionKind; document: ResourceDocument; current?: MarkdownDirectionValue; creating: boolean; locked: boolean;
  onDirty(value: boolean): void; onSave(value: MarkdownDirectionValue, markdown: string, creating: boolean): Promise<void>;
  onDelete?(value: MarkdownDirectionValue): Promise<void>; onApprove?(value: UseCase): Promise<void>; onDraft?(value: UseCase): Promise<void>;
}) {
  const original = useMemo(() => splitMarkdownSource(document.content), [document.content]);
  const [frontmatterText, setFrontmatterText] = useState(original.frontmatterText); const [bodyText, setBodyText] = useState(original.bodyText);
  const [pending, setPending] = useState(false); const [serverError, setServerError] = useState(""); const [confirming, setConfirming] = useState(false);
  const dirty = frontmatterText !== original.frontmatterText || bodyText !== original.bodyText;
  let validation = ""; try { directionValueFromMarkdown(kind, { frontmatterText, bodyText }, current); } catch (error) { validation = error instanceof Error ? error.message : "Invalid Markdown document."; }
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const entity = markdownEntity(document, { frontmatterText, bodyText });
  const save = async () => { setPending(true); setServerError(""); try { const parsed = directionValueFromMarkdown(kind, { frontmatterText, bodyText }, current); await onSave(parsed.value, parsed.source, creating); onDirty(false); } catch (error) { setServerError(error instanceof Error ? error.message : "Unable to save Markdown."); } finally { setPending(false); } };
  const useCase = current && "examples" in current ? current : undefined;
  return <div className="min-w-0 space-y-3">{useCase ? <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3"><span className="mr-auto text-xs text-muted-foreground">Approval hash <code className="break-all">{useCaseApprovalHash(useCase)}</code></span>{useCase.status === "draft" ? <Button size="sm" disabled={locked || dirty} onClick={() => setConfirming(true)}>Approve exact content…</Button> : <Button size="sm" variant="outline" disabled={locked} onClick={() => void onDraft?.(useCase)}>Return to draft</Button>}</div> : null}
    <MarkdownWorkbench document={entity} emptyTitle="Select a Markdown document" formId={`markdown-${kind}-${document.id}`} saveLabel="Save Markdown" frontmatterText={frontmatterText} bodyText={bodyText} dirty={dirty} valid={!validation && !locked} pending={pending} fieldErrors={validation ? { frontmatter: validation } : undefined} serverError={serverError} deleteLabel="Delete document" deleteType="document" resourceName={current?.name} onDelete={current && onDelete ? () => onDelete(current) : undefined} onFrontmatterChange={setFrontmatterText} onBodyChange={setBodyText} onSubmit={save} />
    <Dialog open={confirming} onOpenChange={setConfirming}><DialogContent><DialogHeader><DialogTitle>Approve {useCase?.id}?</DialogTitle><DialogDescription>This approves the exact persisted semantic content with hash <code className="break-all">{useCase ? useCaseApprovalHash(useCase) : ""}</code>. Saving Markdown never approves it.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button><Button onClick={() => { setConfirming(false); if (useCase) void onApprove?.(useCase); }}>Approve exact content</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
