import { useEffect, useState } from "react";
import { EditorActions } from "@/components/shared/editor-actions";
import { MarkdownWorkbench } from "@/workspace/documents/MarkdownWorkbench";
import type { ResourceDocument } from "../types";
import { ConfigureToolbar } from "./ConfigureToolbar";
import { MarkdownConflict } from "./MarkdownConflict";
import { useMarkdownDraft } from "./useMarkdownDraft";
import { joinMarkdownSource, markdownEntity, projectMarkdownValidation } from "./markdownAuthoring";

type Props = {
  documents: ResourceDocument[]; onDirty?(dirty: boolean): void;
  onSave(id: string, source: string, hash: string, creating: boolean): Promise<ResourceDocument>;
};
export function ProjectMarkdownWorkspace(props: Props) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => { props.onDirty?.(dirty); return () => props.onDirty?.(false); }, [dirty, props.onDirty]);
  const document = props.documents.find(({ id }) => id === "overview");
  return <><h1 className="sr-only">Overview</h1>{document ? <OverviewEditor {...props} document={document} onDirty={setDirty} /> : <p>Overview unavailable.</p>}</>;
}
function OverviewEditor({ document, onDirty, onSave }: Props & { document: ResourceDocument; onDirty(dirty: boolean): void }) {
  const editor = useMarkdownDraft(document, onDirty);
  const { frontmatterText, bodyText, dirty, pending } = editor;
  const { validation } = projectMarkdownValidation({ frontmatterText, bodyText });
  const source = frontmatterText.trim() ? joinMarkdownSource({ frontmatterText, bodyText }) : `${bodyText.trimEnd()}\n`;
  const valid = !validation && !editor.stale;
  const status = editor.stale ? "File changed" : pending ? "Saving…" : dirty ? "Unsaved" : document.contentHash === "absent" ? "New" : "Saved";
  return <div className="min-w-0"><ConfigureToolbar title="Overview" label={document.id} status={status}>
    <EditorActions saveLabel="Save Markdown" formId="project-markdown-form" dirty={dirty} valid={valid} pending={pending} />
  </ConfigureToolbar><MarkdownConflict stale={editor.stale} hash={document.contentHash} onReload={editor.reload} />
    <div className="px-4 py-3 md:px-6"><MarkdownWorkbench document={markdownEntity(document, { frontmatterText, bodyText })}
      emptyTitle="Select a document" formId="project-markdown-form" saveLabel="Save Markdown" frontmatterText={frontmatterText} bodyText={bodyText}
      dirty={dirty} valid={valid} pending={pending} fieldErrors={validation ? { frontmatter: validation } : undefined} serverError={editor.error} showActions={false}
      onFrontmatterChange={editor.setFrontmatterText} onBodyChange={editor.setBodyText}
      onSubmit={() => editor.save((hash) => onSave(document.id, source, hash, false))} /></div>
  </div>;
}
