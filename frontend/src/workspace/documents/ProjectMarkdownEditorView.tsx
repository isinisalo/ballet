import { useEffect, useId, useState } from "react";
import { Plus } from "lucide-react";
import type { MarkdownDocument } from "../../../../shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/workspace-ui";
import { frontmatterToYaml, parseFrontmatterYaml } from "./frontmatter";
import { MarkdownWorkbench } from "./MarkdownWorkbench";
import { type MarkdownEntity } from "./markdownDocument";
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

  if (!document) return <EmptyState title={emptyTitle} />;
  const createKind = createKindForProjectDocument(document.relativePath);
  const createConfig = createKind ? projectDocumentCreateConfig[createKind] : undefined;

  return (
    <MarkdownWorkbench
      document={document}
      emptyTitle={emptyTitle}
      formId={formId}
      saveLabel="Save Markdown"
      frontmatterText={frontmatterText}
      bodyText={bodyText}
      validationError={validationError}
      headerActions={createKind && createConfig && onCreateDocument ? (
        <Button type="button" size="icon-sm" variant="outline" aria-label={createConfig.label} title={createConfig.label} onClick={() => onCreateDocument(createKind)}>
          <Plus data-icon="inline-start" />
        </Button>
      ) : null}
      onFrontmatterChange={setFrontmatterText}
      onBodyChange={setBodyText}
      onSubmit={handleSave}
    />
  );
}
