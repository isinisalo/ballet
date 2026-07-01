import { useEffect, useId, useState } from "react";
import { Eye, FileKey2 } from "lucide-react";
import type { Skill } from "../../../../shared/domain";
import { CrudActions, Panel, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { FieldGroup } from "@/components/ui/field";
import { MarkdownDocumentView } from "../documents/MarkdownDocumentView";
import { skillDocumentPath } from "../routing";

const skillTemplate = (): Partial<Skill> => ({
  name: "",
  description: "",
  metadata: {},
  body: ""
});

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

  useEffect(() => {
    setForm(skill ?? skillTemplate());
  }, [skill]);

  const handleSave = async () => {
    const saved = await save("skills", form);
    if (saved.relativePath) navigate(skillDocumentPath(saved.relativePath));
  };

  const handleDelete = async () => {
    if (!form.id) return;
    await remove("skills", form.id);
    navigate("/skills");
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel
        title={form.id ? "Update skill" : "Create skill"}
        icon={<FileKey2 data-icon="inline-start" />}
        action={(
          <CrudActions
            formId={formId}
            newLabel="New"
            saveLabel="Save skill"
            id={form.id}
            deleteType="skill"
            resourceName={form.name}
            onNew={() => setForm(skillTemplate())}
            onDelete={handleDelete}
          />
        )}
      >
        <form id={formId} className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          <FieldGroup>
            <TextField label="Name" required value={form.name ?? ""} onChange={(name) => setForm({ ...form, name })} />
            <TextAreaField label="Description" required value={form.description ?? ""} onChange={(description) => setForm({ ...form, description })} />
            <TextAreaField label="Markdown" rows={14} value={form.body ?? ""} onChange={(body) => setForm({ ...form, body })} />
          </FieldGroup>
        </form>
      </Panel>
      <Panel title="Preview" icon={<Eye data-icon="inline-start" />} compact>
        <MarkdownDocumentView document={skill} emptyTitle="No skill selected." embedded />
      </Panel>
    </div>
  );
}

