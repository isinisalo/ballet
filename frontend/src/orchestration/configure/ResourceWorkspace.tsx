import { useMarkdownDraft } from "./useMarkdownDraft";
import { MarkdownConflict } from "./MarkdownConflict";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EditorActions } from "@/components/shared/editor-actions";
import { Input } from "@/components/ui/input";
import { MarkdownWorkbench } from "@/workspace/documents/MarkdownWorkbench";
import { frontmatterToYaml } from "@/workspace/documents/frontmatter";
import { orchestrationEntityPath } from "@/workspace/routing";
import { validateActionInstruction } from "@shared/orchestration/instructionContract";
import type { ReferenceEntry, ResourceDocument } from "../types";
import { skillImpactWarning } from "../authoringModels";
import { ConfigureToolbar } from "./ConfigureToolbar";
import { joinMarkdownSource, markdownEntity } from "./markdownAuthoring";

export function ResourceWorkspace({ kind, resources, references, locked, selectedId, navigate, onSave, onDirty }: {
  kind: "instructions" | "skills"; resources: ResourceDocument[]; references: ReferenceEntry[]; locked: boolean; selectedId?: string;
  onDirty?(dirty: boolean): void;
  navigate(path: string): void; onSave(id: string, content: string, expectedHash: string | "absent", creating: boolean): Promise<ResourceDocument>;
}) {
  const [creating, setCreating] = useState(false); const [dirty, setDirty] = useState(false);
  useEffect(() => { onDirty?.(dirty); return () => onDirty?.(false); }, [dirty, onDirty]);
  const selected = resources.find((resource) => resource.id === selectedId);
  useEffect(() => { if (selectedId) setCreating(false); }, [selectedId]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  const choose = (id?: string) => { if (dirty && !window.confirm("Discard unsaved Markdown changes?")) return; setDirty(false); setCreating(!id); navigate(id ? orchestrationEntityPath(kind === "skills" ? "/skills" : "/project/instructions", id) : kind === "skills" ? "/skills" : "/project/instructions"); };
  const created = creating ? newResource(kind) : undefined;
  const status = locked ? "Referenced resource locked" : `${resources.length} resources`;
  return <><h1 className="sr-only">{kind === "skills" ? "Skills" : "Instructions"}</h1>
    {selected || created ? <ResourceMarkdownEditor key={selected?.id ?? "new"} kind={kind} resource={selected ?? created!} references={references} locked={locked} creating={creating} status={status} onCreate={() => choose(undefined)} onDirty={setDirty} onSave={onSave} /> : <><ConfigureToolbar title={kind === "skills" ? "Skills" : "Instructions"} status={status}><Button size="sm" disabled={locked} onClick={() => choose(undefined)}>Create</Button></ConfigureToolbar><section className="m-4 rounded-md border border-dashed p-6 text-muted-foreground md:m-6">Select a resource from the sidebar to edit its complete Markdown source.</section></>}
  </>;
}

function ResourceMarkdownEditor({ kind, resource, references, locked, creating, status, onCreate, onDirty, onSave }: {
  kind: "instructions" | "skills"; resource: ResourceDocument; references: ReferenceEntry[]; locked: boolean; creating: boolean;
  status: string; onCreate(): void;
  onDirty(value: boolean): void; onSave(id: string, content: string, expectedHash: string | "absent", creating: boolean): Promise<ResourceDocument>;
}) {
  const [id, setId] = useState(creating ? "" : resource.id);
  const editor = useMarkdownDraft(resource, onDirty, creating && Boolean(id));
  const { frontmatterText, bodyText, setFrontmatterText, setBodyText, dirty, pending, error } = editor;
  const source = frontmatterText.trim() ? joinMarkdownSource({ frontmatterText, bodyText }) : `${bodyText.trimEnd()}\n`;
  const issues = kind === "instructions" ? validateActionInstruction(source) : source.trim() ? [] : [{ path: "content", message: "Skill content is required" }];
  const save = () => editor.save((hash) => onSave(id, source, hash, creating));
  const impact = kind === "skills" ? skillImpactWarning(id, references) : `${references.find((entry) => entry.kind === "instruction" && entry.id === id)?.references.length ?? 0} referencing Action/role usages.`;
  const formId = `resource-${kind}-${resource.id}`; const valid = !locked && !editor.stale && Boolean(id) && issues.length === 0;
  return <div className="min-w-0"><ConfigureToolbar title={kind === "skills" ? "Skills" : "Instructions"} status={status} label={creating ? "New resource" : id}><Button size="sm" variant="outline" disabled={locked} onClick={onCreate}>Create</Button><EditorActions saveLabel="Save Markdown" formId={formId} dirty={dirty} valid={valid} pending={pending} locked={locked} /></ConfigureToolbar><MarkdownConflict stale={editor.stale} hash={resource.contentHash} onReload={editor.reload} /><div className="space-y-3 px-4 py-3 md:px-6">{creating ? <label className="grid gap-1 text-sm">Exact resource ID<Input value={id} onChange={(event) => setId(event.target.value)} /></label> : null}<p role={kind === "skills" ? "alert" : undefined} className="text-sm text-muted-foreground">{impact}</p><MarkdownWorkbench document={markdownEntity(resource, { frontmatterText, bodyText })} emptyTitle="Select a Markdown resource" formId={formId} saveLabel="Save Markdown" frontmatterText={frontmatterText} bodyText={bodyText} dirty={dirty} valid={valid} pending={pending} fieldErrors={issues[0] ? { body: `${issues[0].path}: ${issues[0].message}` } : undefined} serverError={error} showActions={false} onFrontmatterChange={setFrontmatterText} onBodyChange={setBodyText} onSubmit={save} /></div></div>;
}

const newResource = (kind: "instructions" | "skills"): ResourceDocument => {
  const skill = kind === "skills";
  const frontmatter = skill ? frontmatterToYaml({ name: "new-skill", description: "Describe the bounded Skill." }) : "";
  const body = skill ? "# New Skill\n\nDescribe the procedure." : "## Task\n\n## Role\n\n## Goals\n\n## Priorities\n\n## Method\n\n## Output contract\n\n## Tool policy\n\n## Acceptance evidence\n";
  return { kind: skill ? "skill" : "instruction", id: "new", content: frontmatter ? joinMarkdownSource({ frontmatterText: frontmatter, bodyText: body }) : body, contentHash: "absent" };
};
