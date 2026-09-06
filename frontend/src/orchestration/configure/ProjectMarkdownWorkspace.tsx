import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EditorActions } from "@/components/shared/editor-actions";
import { MarkdownWorkbench } from "@/workspace/documents/MarkdownWorkbench";
import type { ResourceDocument } from "../types";
import { ConfigureToolbar } from "./ConfigureToolbar";
import { MarkdownConflict } from "./MarkdownConflict";
import { useMarkdownDraft } from "./useMarkdownDraft";
import { joinMarkdownSource, markdownEntity, projectMarkdownValidation } from "./markdownAuthoring";

type Props = {
  kind: "overview" | "adrs"; documents: ResourceDocument[]; selectedId?: string;
  navigate(path: string): void; onDirty?(dirty: boolean): void;
  onSave(id: string, source: string, hash: string, creating: boolean): Promise<ResourceDocument>;
  onDelete?(id: string, hash: string): Promise<void>;
};
const newAdr: ResourceDocument = { kind: "adr", id: "new", contentHash: "absent",
  content: "---\nid: \ntitle: New ADR\nstatus: draft\n---\n\n# New ADR\n\n## Context\n\n## Decision\n\n## Consequences\n" };

export function ProjectMarkdownWorkspace(props: Props) {
  const [creating, setCreating] = useState(false); const [dirty, setDirty] = useState(false);
  useEffect(() => { props.onDirty?.(dirty); return () => props.onDirty?.(false); }, [dirty, props.onDirty]);
  useEffect(() => { if (props.selectedId) setCreating(false); }, [props.selectedId]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const document = creating ? newAdr : props.documents.find(({ id }) => id === props.selectedId);
  const create = () => {
    if (dirty && !window.confirm("Discard unsaved Markdown changes?")) return;
    setDirty(false); setCreating(true); props.navigate("/project/adrs");
  };
  const title = props.kind === "overview" ? "Overview" : "ADRs";
  return <><h1 className="sr-only">{title}</h1>{document
    ? <ProjectMarkdownEditor key={document.id} {...props} document={document} title={title} creating={creating} onDirty={setDirty} onCreate={create} />
    : <><ConfigureToolbar title={title} status={`${props.documents.length} documents`}><Button size="sm" onClick={create}>Create</Button></ConfigureToolbar>
      <p className="p-6 text-muted-foreground">{props.selectedId ? "This document is unavailable. Your selection may have been deleted." : "Select a document from the sidebar."}</p></>}
  </>;
}

function ProjectMarkdownEditor({ document, title, creating, onCreate, onDirty, ...props }: Props & {
  document: ResourceDocument; title: string; creating: boolean; onCreate(): void; onDirty(dirty: boolean): void;
}) {
  const editor = useMarkdownDraft(document, onDirty);
  const { frontmatterText, bodyText, dirty, pending } = editor;
  const { validation, id } = projectMarkdownValidation(props.kind, { frontmatterText, bodyText }, document.id, creating);
  const source = frontmatterText.trim() ? joinMarkdownSource({ frontmatterText, bodyText }) : `${bodyText.trimEnd()}\n`;
  const valid = !validation && !editor.stale;
  const status = editor.stale ? "File changed" : pending ? "Saving…" : dirty ? "Unsaved" : document.contentHash === "absent" ? "New" : "Saved";
  return <div className="min-w-0"><ConfigureToolbar title={title} label={document.id} status={status}>
    {props.kind === "adrs" ? <Button size="sm" variant="outline" disabled={pending} onClick={onCreate}>Create</Button> : null}
    <EditorActions saveLabel="Save Markdown" formId="project-markdown-form" dirty={dirty} valid={valid} pending={pending}
      canDelete={Boolean(props.onDelete) && !creating && !editor.stale} deleteLabel="Delete document" deleteType="document" resourceName={id}
      onDelete={props.onDelete ? () => props.onDelete!(id, editor.baseline.contentHash) : undefined} />
  </ConfigureToolbar>
    <MarkdownConflict stale={editor.stale} hash={document.contentHash} onReload={editor.reload} />
    <div className="px-4 py-3 md:px-6"><MarkdownWorkbench document={markdownEntity(document, { frontmatterText, bodyText })}
      emptyTitle="Select a document" formId="project-markdown-form" saveLabel="Save Markdown" frontmatterText={frontmatterText} bodyText={bodyText}
      dirty={dirty} valid={valid} pending={pending} fieldErrors={validation ? { frontmatter: validation } : undefined} serverError={editor.error} showActions={false}
      onFrontmatterChange={editor.setFrontmatterText} onBodyChange={editor.setBodyText}
      onSubmit={() => editor.save((hash) => props.onSave(id, source, hash, creating))} /></div>
  </div>;
}
