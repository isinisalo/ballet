import { useEffect, useId, useMemo, useState } from "react";
import type { MarkdownDocument } from "../../../../shared/api/workspace-contracts";
import { EmptyState } from "@/components/shared/workspace-ui";
import { toErrorMessage } from "@/lib/errors";
import { frontmatterToYaml, parseFrontmatterYaml } from "./frontmatter";
import { MarkdownWorkbench } from "./MarkdownWorkbench";
import { type MarkdownEntity } from "./markdownDocument";
import type { ProjectDocumentCreateKind } from "../types";

export function ProjectMarkdownEditorView({
  document,
  emptyTitle,
  saveProjectDocument,
  createProjectDocument,
  createKind
}: {
  document?: MarkdownEntity;
  emptyTitle: string;
  saveProjectDocument: (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
  createProjectDocument?: (kind: ProjectDocumentCreateKind, title: string) => Promise<MarkdownDocument>;
  createKind?: ProjectDocumentCreateKind;
}) {
  const formId = useId();
  const creating = !document && Boolean(createKind && createProjectDocument);
  const createDocument = useMemo<MarkdownEntity | undefined>(() => creating ? {
    id: `new-${createKind}`,
    frontmatter: { title: "" },
    body: "",
    relativePath: "",
    errors: []
  } : undefined, [createKind, creating]);
  const activeDocument = document ?? createDocument;
  const [frontmatterText, setFrontmatterText] = useState(frontmatterToYaml(activeDocument?.frontmatter));
  const [bodyText, setBodyText] = useState(document?.body ?? "");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setFrontmatterText(frontmatterToYaml(activeDocument?.frontmatter));
    setBodyText(activeDocument?.body ?? "");
    setValidationError("");
  }, [activeDocument]);

  const handleSave = async () => {
    try {
      const frontmatter = parseFrontmatterYaml(frontmatterText);
      if (creating) {
        if (!createKind || !createProjectDocument) return;
        const title = titleFromFrontmatter(frontmatter);
        if (!title) throw new Error("Document frontmatter title or name is required.");
        const created = await createProjectDocument(createKind, title);
        await saveProjectDocument({
          relativePath: created.relativePath,
          frontmatter,
          body: bodyText
        });
        setValidationError("");
        return;
      }
      if (!document?.relativePath) return;
      setValidationError("");
      await saveProjectDocument({
        relativePath: document.relativePath,
        frontmatter,
        body: bodyText
      });
    } catch (err) {
      setValidationError(toErrorMessage(err, "Invalid project document."));
    }
  };

  if (!activeDocument) return <EmptyState title={emptyTitle} />;

  return (
    <MarkdownWorkbench
      document={activeDocument}
      emptyTitle={emptyTitle}
      formId={formId}
      saveLabel="Save Markdown"
      frontmatterText={frontmatterText}
      bodyText={bodyText}
      validationError={validationError}
      onFrontmatterChange={setFrontmatterText}
      onBodyChange={setBodyText}
      onSubmit={handleSave}
    />
  );
}

const titleFromFrontmatter = (frontmatter: Record<string, unknown>) => {
  const title = frontmatter.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const name = frontmatter.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return "";
};
