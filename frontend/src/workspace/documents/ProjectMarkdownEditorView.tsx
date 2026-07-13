import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  const [serverError, setServerError] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const frontmatterError = useMemo(() => projectFrontmatterError(frontmatterText, creating), [creating, frontmatterText]);
  const valid = !frontmatterError;

  useEffect(() => {
    setServerError("");
  }, [activeDocument?.id, activeDocument?.relativePath]);
  useWorkspaceNavigationBlocker(setNavigationBlocker, dirty, "Discard unsaved Markdown changes?");

  const handleSave = async () => {
    if (!valid || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setServerError("");
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
        return;
      }
      if (!document?.relativePath) return;
      const saved = await saveProjectDocument({
        relativePath: document.relativePath,
        frontmatter,
        body: bodyText
      });
      accept(markdownEditorDraft(saved));
    } catch (err) {
      setServerError(toErrorMessage(err, "Could not save project document."));
    } finally {
      pendingRef.current = false;
      setPending(false);
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
      dirty={dirty}
      valid={valid}
      pending={pending}
      fieldErrors={{ frontmatter: frontmatterError }}
      serverError={serverError}
      onFrontmatterChange={(frontmatterText) => {
        setServerError("");
        setDraft((current) => ({ ...current, frontmatterText }));
      }}
      onBodyChange={(bodyText) => {
        setServerError("");
        setDraft((current) => ({ ...current, bodyText }));
      }}
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

const projectFrontmatterError = (value: string, titleRequired: boolean): string | undefined => {
  try {
    const frontmatter = parseFrontmatterYaml(value);
    if (titleRequired && !titleFromFrontmatter(frontmatter)) return "Document frontmatter title or name is required.";
    return undefined;
  } catch (error) {
    return toErrorMessage(error, "Invalid YAML frontmatter.");
  }
};
