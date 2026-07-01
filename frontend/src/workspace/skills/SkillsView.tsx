import { useEffect, useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Skill } from "../../../../shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/shared/workspace-ui";
import { frontmatterToYaml, parseFrontmatterYaml } from "../documents/frontmatter";
import { MarkdownWorkbench } from "../documents/MarkdownWorkbench";
import { skillDocumentPath } from "../routing";

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

const stringFrontmatterValue = (frontmatter: Record<string, unknown>, key: string) => {
  const value = frontmatter[key];
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : String(value);
};

export function SkillsView({
  skill,
  save,
  remove,
  navigate
}: {
  skill?: Skill;
  save: (collection: "skills", item: Partial<Skill>) => Promise<Skill>;
  remove: (collection: "skills", id: string) => Promise<void>;
  navigate: (path: string) => void;
}) {
  const formId = useId();
  const [form, setForm] = useState<Partial<Skill>>(skill ?? skillTemplate());
  const [frontmatterText, setFrontmatterText] = useState(frontmatterToYaml((skill ?? skillTemplate()).frontmatter));
  const [bodyText, setBodyText] = useState(skill?.body ?? "");
  const [validationError, setValidationError] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    const next = skill ?? skillTemplate();
    setForm(next);
    setFrontmatterText(frontmatterToYaml(next.frontmatter));
    setBodyText(next.body ?? "");
    setValidationError("");
    setConfirmDeleteOpen(false);
  }, [skill]);

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
      setValidationError("");
      if (saved.relativePath) navigate(skillDocumentPath(saved.relativePath));
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Invalid skill document.");
    }
  };

  const handleDelete = async () => {
    if (!form.id) return;
    await remove("skills", form.id);
    navigate("/skills");
  };

  const handleNew = () => {
    const next = skillTemplate();
    setForm(next);
    setFrontmatterText(frontmatterToYaml(next.frontmatter));
    setBodyText("");
    setValidationError("");
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
          <Button type="button" size="icon-sm" variant="outline" aria-label="New" title="New" onClick={handleNew}>
            <Plus data-icon="inline-start" />
          </Button>
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
      onFrontmatterChange={setFrontmatterText}
      onBodyChange={setBodyText}
      onSubmit={handleSave}
    />
  );
}
