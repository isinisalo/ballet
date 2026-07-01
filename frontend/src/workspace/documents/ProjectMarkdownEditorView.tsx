import { useEffect, useId, useMemo, useState } from "react";
import { Eye, FileKey2, Plus, Save } from "lucide-react";
import type { MarkdownDocument } from "../../../../shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { EmptyState, Panel, TextAreaField } from "@/components/shared/workspace-ui";
import { frontmatterToYaml, parseFrontmatterYaml } from "./frontmatter";
import { MarkdownDocumentView } from "./MarkdownDocumentView";
import { markdownPreviewDocument, type MarkdownEntity } from "./markdownDocument";
import { createKindForProjectDocument, projectDocumentCreateConfig } from "./projectDocuments";
import type { ProjectDocumentCreateKind } from "../types";

export function ProjectMarkdownEditorView({
  document,
  emptyTitle,
  saveProjectDocument,
  onCreateDocument
}: {
  document?: MarkdownEntity;
  emptyTitle: string;
  saveProjectDocument: (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
  onCreateDocument?: (kind: ProjectDocumentCreateKind) => void;
}) {
  const formId = useId();
  const [frontmatterText, setFrontmatterText] = useState(frontmatterToYaml(document?.frontmatter));
  const [bodyText, setBodyText] = useState(document?.body ?? "");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setFrontmatterText(frontmatterToYaml(document?.frontmatter));
    setBodyText(document?.body ?? "");
    setValidationError("");
  }, [document]);

  const handleSave = async () => {
    if (!document?.relativePath) return;

    try {
      const frontmatter = parseFrontmatterYaml(frontmatterText);
      setValidationError("");
      await saveProjectDocument({
        relativePath: document.relativePath,
        frontmatter,
        body: bodyText
      });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Invalid project document.");
    }
  };

  const previewDocument = useMemo(
    () => document ? markdownPreviewDocument(document, frontmatterText, bodyText, parseFrontmatterYaml) : undefined,
    [bodyText, document, frontmatterText]
  );

  if (!document) return <EmptyState title={emptyTitle} />;
  const createKind = createKindForProjectDocument(document.relativePath);
  const createConfig = createKind ? projectDocumentCreateConfig[createKind] : undefined;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel
        title="Edit Markdown"
        icon={<FileKey2 data-icon="inline-start" />}
        compact
        action={(
          <div className="flex items-center justify-end gap-2">
            {createKind && createConfig && onCreateDocument ? (
              <Button type="button" size="icon-sm" variant="outline" aria-label={createConfig.label} title={createConfig.label} onClick={() => onCreateDocument(createKind)}>
                <Plus data-icon="inline-start" />
              </Button>
            ) : null}
            <Button type="submit" size="icon-sm" form={formId} aria-label="Save Markdown" title="Save Markdown">
              <Save data-icon="inline-start" />
            </Button>
          </div>
        )}
      >
        <form id={formId} className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          {validationError ? <Alert variant="destructive"><AlertDescription>{validationError}</AlertDescription></Alert> : null}
          <FieldGroup>
            <TextAreaField label="Frontmatter" rows={10} value={frontmatterText} onChange={setFrontmatterText} className="font-mono text-xs leading-relaxed" />
            <TextAreaField label="Markdown" rows={18} value={bodyText} onChange={setBodyText} className="font-mono text-xs leading-relaxed" />
          </FieldGroup>
        </form>
      </Panel>
      <Panel title="Preview" icon={<Eye data-icon="inline-start" />} compact>
        <MarkdownDocumentView document={previewDocument} emptyTitle={emptyTitle} compact embedded />
      </Panel>
    </div>
  );
}
