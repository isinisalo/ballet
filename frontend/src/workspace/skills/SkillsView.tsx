import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Skill } from "@shared/api/workspace-contracts";
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
  const [serverError, setServerError] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const frontmatterError = useMemo(() => skillFrontmatterError(frontmatterText), [frontmatterText]);
  const valid = !frontmatterError;

  useEffect(() => {
    setServerError("");
  }, [skill?.id]);
  useWorkspaceNavigationBlocker(setNavigationBlocker, dirty, "Discard unsaved skill changes?");

  const previewDocument = useMemo(() => ({
    id: form.id ?? "new-skill",
    name: undefined,
    frontmatter: form.frontmatter,
    body: form.body,
    relativePath: form.relativePath,
    errors: form.errors
  }), [form]);

  const handleSave = async () => {
    if (!valid || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setServerError("");
    try {
      const frontmatter = parseFrontmatterYaml(frontmatterText);
      const name = stringFrontmatterValue(frontmatter, "name").trim();

      const saved = await save("skills", {
        ...form,
        name,
        description: stringFrontmatterValue(frontmatter, "description"),
        frontmatter,
        body: bodyText
      });
      accept(skillEditorDraft(saved));
      if (saved.relativePath) navigate(skillDocumentPath(saved.relativePath), { bypassBlocker: true });
    } catch (err) {
      setServerError(toErrorMessage(err, "Could not save skill document."));
    } finally {
      pendingRef.current = false;
      setPending(false);
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
      dirty={dirty}
      valid={valid}
      pending={pending}
      fieldErrors={{ frontmatter: frontmatterError }}
      serverError={serverError}
      deleteLabel="Delete skill"
      deleteType="skill"
      resourceName={form.name}
      onDelete={form.id ? handleDelete : undefined}
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

const skillFrontmatterError = (value: string): string | undefined => {
  try {
    const name = stringFrontmatterValue(parseFrontmatterYaml(value), "name").trim();
    return name ? undefined : "Skill frontmatter name is required.";
  } catch (error) {
    return toErrorMessage(error, "Invalid YAML frontmatter.");
  }
};
