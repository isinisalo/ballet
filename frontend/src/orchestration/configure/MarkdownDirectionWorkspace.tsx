import { useMarkdownDraft } from "./useMarkdownDraft";
import { MarkdownConflict } from "./MarkdownConflict";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditorActions } from "@/components/shared/editor-actions";
import type { UseCase } from "@shared/orchestration/direction";
import { useCaseApprovalHash } from "@shared/orchestration/direction";
import { MarkdownWorkbench } from "@/workspace/documents/MarkdownWorkbench";
import { orchestrationEntityPath } from "@/workspace/routing";
import type { ResourceDocument } from "../types";
import { ConfigureHeader } from "./ConfigureHeader";
import { ConfigureToolbar } from "./ConfigureToolbar";
import {
  createMarkdownDocument, directionValueFromMarkdown, markdownEntity,
  type MarkdownDirectionKind, type MarkdownDirectionValue
} from "./markdownAuthoring";

const basePath = (kind: MarkdownDirectionKind) => kind === "use-cases" ? "/project/use-cases" : `/project/${kind}`;
const title = (kind: MarkdownDirectionKind) => kind === "use-cases" ? "Use Cases" : kind === "adrs" ? "ADRs" : `${kind[0]?.toUpperCase()}${kind.slice(1)}`;

export function MarkdownDirectionWorkspace({ kind, values, documents, selectedId, locked, navigate, onSave, onDelete, onApprove, onDraft }: {
  kind: MarkdownDirectionKind; values: MarkdownDirectionValue[]; documents: ResourceDocument[]; selectedId?: string; locked: boolean;
  navigate(path: string): void;
  onSave(value: MarkdownDirectionValue, markdown: string, creating: boolean, expectedDocumentHash: string): Promise<ResourceDocument>;
  onDelete?(value: MarkdownDirectionValue): Promise<void>;
  onApprove?(value: UseCase): Promise<void>; onDraft?(value: UseCase): Promise<void>;
}) {
  const [creating, setCreating] = useState(false); const [dirty, setDirty] = useState(false);
  const selected = values.find(({ id }) => id === selectedId);
  const document = creating ? createMarkdownDocument(kind) : documents.find(({ id }) => id === selected?.id);
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
  const status = locked ? "Locked by active Run" : kind === "use-cases" ? `${approvedCount} approved` : `${values.length} documents`;
  return <><ConfigureHeader title={title(kind)} description={kind === "use-cases" ? "Select a compact Use Case from the sidebar; edit its canonical YAML frontmatter and Markdown here." : `Select canonical ${title(kind)} from the sidebar and edit the version-controlled Markdown.`} />
    {document ? <MarkdownEditor key={`${kind}:${document.id}`} kind={kind} document={document} current={selected} creating={creating} locked={locked} status={status} onCreate={() => choose(undefined)} onDirty={setDirty} onSave={onSave} onDelete={onDelete} onApprove={onApprove} onDraft={onDraft} /> : <><ConfigureToolbar status={status}><Button size="sm" disabled={locked} onClick={() => choose(undefined)}>Create</Button></ConfigureToolbar><section className="m-4 rounded-md border border-dashed p-6 text-muted-foreground md:m-6">Select a document from the sidebar. Its complete Markdown source opens here.</section></>}
  </>;
}

function MarkdownEditor({ kind, document, current, creating, locked, status, onCreate, onDirty, onSave, onDelete, onApprove, onDraft }: {
  kind: MarkdownDirectionKind; document: ResourceDocument; current?: MarkdownDirectionValue; creating: boolean; locked: boolean;
  status: string; onCreate(): void;
  onDirty(value: boolean): void; onSave(value: MarkdownDirectionValue, markdown: string, creating: boolean, expectedDocumentHash: string): Promise<ResourceDocument>;
  onDelete?(value: MarkdownDirectionValue): Promise<void>; onApprove?(value: UseCase): Promise<void>; onDraft?(value: UseCase): Promise<void>;
}) {
  const editor = useMarkdownDraft(document, onDirty);
  const { frontmatterText, bodyText, setFrontmatterText, setBodyText, dirty, pending, error: serverError } = editor;
  const [confirming, setConfirming] = useState(false);
  let validation = ""; try { directionValueFromMarkdown(kind, { frontmatterText, bodyText }, current); } catch (error) { validation = error instanceof Error ? error.message : "Invalid Markdown document."; }
  const entity = markdownEntity(document, { frontmatterText, bodyText });
  const save = () => editor.save((hash) => {
    const parsed = directionValueFromMarkdown(kind, { frontmatterText, bodyText }, current);
    return onSave(parsed.value, parsed.source, creating, hash);
  });
  const useCase = current && "examples" in current ? current : undefined;
  const formId = `markdown-${kind}-${document.id}`;
  return <div className="min-w-0"><ConfigureToolbar status={status} label={current?.id ?? "New document"}><Button size="sm" variant="outline" disabled={locked} onClick={onCreate}>Create</Button>{useCase ? useCase.status === "draft" ? <Button size="sm" disabled={locked || dirty || editor.stale} onClick={() => setConfirming(true)}>Approve exact content…</Button> : <Button size="sm" variant="outline" disabled={locked} onClick={() => void onDraft?.(useCase)}>Return to draft</Button> : null}<EditorActions saveLabel="Save Markdown" formId={formId} dirty={dirty} valid={!validation && !locked && !editor.stale} pending={pending} canDelete={Boolean(current && onDelete) && !editor.stale} deleteLabel="Delete document" deleteType="document" resourceName={current?.name} onDelete={current && onDelete ? () => onDelete(current) : undefined} /></ConfigureToolbar>
    <MarkdownConflict stale={editor.stale} hash={document.contentHash} onReload={editor.reload} />
    {useCase ? <p className="mx-4 mt-3 break-all text-xs text-muted-foreground md:mx-6">Approval hash <code>{useCaseApprovalHash(useCase)}</code></p> : null}<div className="p-4 md:p-6"><MarkdownWorkbench document={entity} emptyTitle="Select a Markdown document" formId={formId} saveLabel="Save Markdown" frontmatterText={frontmatterText} bodyText={bodyText} dirty={dirty} valid={!validation && !locked && !editor.stale} pending={pending} fieldErrors={validation ? { frontmatter: validation } : undefined} serverError={serverError} showActions={false} onFrontmatterChange={setFrontmatterText} onBodyChange={setBodyText} onSubmit={save} /></div>
    <Dialog open={confirming} onOpenChange={setConfirming}><DialogContent><DialogHeader><DialogTitle>Approve {useCase?.id}?</DialogTitle><DialogDescription>This approves the exact persisted semantic content with hash <code className="break-all">{useCase ? useCaseApprovalHash(useCase) : ""}</code>. Saving Markdown never approves it.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button><Button onClick={() => { setConfirming(false); if (useCase) void onApprove?.(useCase); }}>Approve exact content</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
