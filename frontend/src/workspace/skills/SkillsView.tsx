import { useEffect, useId, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Skill } from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/shared/workspace-ui";
import { toErrorMessage } from "@/lib/errors";
import { frontmatterToYaml, parseFrontmatterYaml } from "../documents/frontmatter";
import { MarkdownWorkbench } from "../documents/MarkdownWorkbench";
import { skillDocumentPath } from "../routing";
import { useRefreshSafeDraft } from "../useRefreshSafeDraft";
import { useWorkspaceNavigationBlocker, type WorkspaceNavigation } from "../useWorkspaceNavigation";

const skillTemplate = (): Partial<Skill> => ({
  name: "",
  description: "",
  metadata: {},
  frontmatter: {
    name: "",
    description: ""
  },
  body: ""
});

type SkillEditorDraft = {
  form: Partial<Skill>;
  frontmatterText: string;
  bodyText: string;
};

const skillEditorDraft = (skill?: Skill): SkillEditorDraft => {
  const form = skill ?? skillTemplate();
  return {
    form,
    frontmatterText: frontmatterToYaml(form.frontmatter),
    bodyText: form.body ?? ""
  };
};

const stringFrontmatterValue = (frontmatter: Record<string, unknown>, key: string) => {
  const value = frontmatter[key];
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : String(value);
};

export function SkillsView({
  skill,
  save,
  remove,
  navigate,
  setNavigationBlocker
}: {
  skill?: Skill;
  save: (collection: "skills", item: Partial<Skill>) => Promise<Skill>;
  remove: (collection: "skills", id: string) => Promise<void>;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  const formId = useId();
  const { draft, setDraft, accept, dirty } = useRefreshSafeDraft(skillEditorDraft(skill), skill?.id ?? "new-skill");
  const { form, frontmatterText, bodyText } = draft;
  const [validationError, setValidationError] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    setValidationError("");
    setConfirmDeleteOpen(false);
  }, [skill?.id]);
  useWorkspaceNavigationBlocker(setNavigationBlocker, dirty, "Discard unsaved skill changes?");

  const previewDocument = useMemo(() => ({
    id: form.id ?? "new-skill",
    name: form.name,
    frontmatter: form.frontmatter,
    body: form.body,
    relativePath: form.relativePath,
    errors: form.errors
  }), [form]);

  const handleSave = async () => {
    try {
      const frontmatter = parseFrontmatterYaml(frontmatterText);
      const name = stringFrontmatterValue(frontmatter, "name").trim();
      if (!name) throw new Error("Skill frontmatter name is required.");

      const saved = await save("skills", {
        ...form,
        name,
        description: stringFrontmatterValue(frontmatter, "description"),
        frontmatter,
        body: bodyText
      });
      accept(skillEditorDraft(saved));
      setValidationError("");
      if (saved.relativePath) navigate(skillDocumentPath(saved.relativePath), { bypassBlocker: true });
    } catch (err) {
      setValidationError(toErrorMessage(err, "Invalid skill document."));
    }
  };

  const handleDelete = async () => {
    if (!form.id) return;
    await remove("skills", form.id);
    accept(skillEditorDraft());
    navigate("/skills", { bypassBlocker: true });
  };

  return (
    <MarkdownWorkbench
      document={previewDocument}
      emptyTitle="No skill selected."
      formId={formId}
      saveLabel="Save skill"
      frontmatterText={frontmatterText}
      bodyText={bodyText}
      validationError={validationError}
      headerActions={(
        <>
          {form.id ? (
            <>
              <Button type="button" size="icon-sm" variant="destructive" aria-label="Delete skill" title="Delete skill" onClick={() => setConfirmDeleteOpen(true)}>
                <Trash2 data-icon="inline-start" />
              </Button>
              <DeleteConfirmDialog
                open={confirmDeleteOpen}
                onOpenChange={setConfirmDeleteOpen}
                deleteType="skill"
                resourceName={form.name}
                onConfirm={handleDelete}
              />
            </>
          ) : null}
        </>
      )}
      onFrontmatterChange={(frontmatterText) => setDraft((current) => ({ ...current, frontmatterText }))}
      onBodyChange={(bodyText) => setDraft((current) => ({ ...current, bodyText }))}
      onSubmit={handleSave}
    />
  );
}
