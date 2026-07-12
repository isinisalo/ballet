import { useEffect, useId, useMemo, useState } from "react";
import type { MarkdownDocument } from "@shared/api/workspace-contracts";
import { EmptyState } from "@/components/shared/workspace-ui";
import { toErrorMessage } from "@/lib/errors";
import { frontmatterToYaml, parseFrontmatterYaml } from "./frontmatter";
import { MarkdownWorkbench } from "./MarkdownWorkbench";
import { type MarkdownEntity } from "./markdownDocument";
import type { ProjectDocumentCreateKind } from "../types";
import { useRefreshSafeDraft } from "../useRefreshSafeDraft";
import { useWorkspaceNavigationBlocker, type WorkspaceNavigation } from "../useWorkspaceNavigation";

type MarkdownEditorDraft = { frontmatterText: string; bodyText: string };

const markdownEditorDraft = (document?: MarkdownEntity): MarkdownEditorDraft => ({
  frontmatterText: frontmatterToYaml(document?.frontmatter),
  bodyText: document?.body ?? ""
});

export function ProjectMarkdownEditorView({
  document,
  emptyTitle,
  saveProjectDocument,
  createProjectDocument,
  createKind,
  setNavigationBlocker
}: {
  document?: MarkdownEntity;
  emptyTitle: string;
  saveProjectDocument: (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
  createProjectDocument?: (kind: ProjectDocumentCreateKind, title: string) => Promise<MarkdownDocument>;
  createKind?: ProjectDocumentCreateKind;
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
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
  const { draft, setDraft, accept, dirty } = useRefreshSafeDraft(
    markdownEditorDraft(activeDocument),
    activeDocument?.relativePath || activeDocument?.id || "empty-document"
  );
  const { frontmatterText, bodyText } = draft;
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setValidationError("");
  }, [activeDocument?.id, activeDocument?.relativePath]);
  useWorkspaceNavigationBlocker(setNavigationBlocker, dirty, "Discard unsaved Markdown changes?");

  const handleSave = async () => {
    try {
      const frontmatter = parseFrontmatterYaml(frontmatterText);
      if (creating) {
        if (!createKind || !createProjectDocument) return;
        const title = titleFromFrontmatter(frontmatter);
        if (!title) throw new Error("Document frontmatter title or name is required.");
        const created = await createProjectDocument(createKind, title);
        const saved = await saveProjectDocument({
          relativePath: created.relativePath,
          frontmatter,
          body: bodyText
        });
        accept(markdownEditorDraft(saved));
        setValidationError("");
        return;
      }
      if (!document?.relativePath) return;
      setValidationError("");
      const saved = await saveProjectDocument({
        relativePath: document.relativePath,
        frontmatter,
        body: bodyText
      });
      accept(markdownEditorDraft(saved));
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
      onFrontmatterChange={(frontmatterText) => setDraft((current) => ({ ...current, frontmatterText }))}
      onBodyChange={(bodyText) => setDraft((current) => ({ ...current, bodyText }))}
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
