import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownWorkbench } from "@/workspace/documents/MarkdownWorkbench";
import { frontmatterToYaml } from "@/workspace/documents/frontmatter";
import { orchestrationEntityPath } from "@/workspace/routing";
import { validateActionInstruction } from "@shared/orchestration/instructionContract";
import type { ReferenceEntry, ResourceDocument } from "../types";
import { skillImpactWarning } from "../authoringModels";
import { ConfigureHeader } from "./ConfigureHeader";
import { joinMarkdownSource, markdownEntity, splitMarkdownSource } from "./markdownAuthoring";

export function ResourceWorkspace({ kind, resources, references, locked, selectedId, navigate, onSave }: {
  kind: "instructions" | "skills"; resources: ResourceDocument[]; references: ReferenceEntry[]; locked: boolean; selectedId?: string;
  navigate(path: string): void; onSave(id: string, content: string, expectedHash: string | "absent", creating: boolean): Promise<void>;
}) {
  const [creating, setCreating] = useState(false); const [dirty, setDirty] = useState(false);
  const selected = resources.find((resource) => resource.id === selectedId);
  useEffect(() => { if (selectedId) setCreating(false); }, [selectedId]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  const choose = (id?: string) => { if (dirty && !window.confirm("Discard unsaved Markdown changes?")) return; setDirty(false); setCreating(!id); navigate(id ? orchestrationEntityPath(kind === "skills" ? "/skills" : "/project/instructions", id) : kind === "skills" ? "/skills" : "/project/instructions"); };
  const created = creating ? newResource(kind) : undefined;
  return <><ConfigureHeader title={kind === "skills" ? "Skills" : "Instructions"} description="Edit the complete canonical Markdown source with the restored workbench and preview." status={locked ? "Referenced resource locked" : `${resources.length} resources`} actions={<Button size="sm" disabled={locked} onClick={() => choose(undefined)}>Create</Button>} />
    <div className="grid min-w-0 gap-4 p-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:p-6"><ul className="space-y-2">{resources.map((resource) => <li key={resource.id}><button aria-current={resource.id === selectedId ? "page" : undefined} className="min-h-10 w-full rounded-sm border bg-card px-3 text-left font-mono text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" onClick={() => choose(resource.id)}>{resource.id}</button></li>)}</ul>{selected || created ? <ResourceMarkdownEditor key={selected?.id ?? "new"} kind={kind} resource={selected ?? created!} references={references} locked={locked} creating={creating} onDirty={setDirty} onSave={onSave} /> : <section className="rounded-md border border-dashed p-6 text-muted-foreground">Select a resource to edit its complete Markdown source.</section>}</div>
  </>;
}

function ResourceMarkdownEditor({ kind, resource, references, locked, creating, onDirty, onSave }: {
  kind: "instructions" | "skills"; resource: ResourceDocument; references: ReferenceEntry[]; locked: boolean; creating: boolean;
  onDirty(value: boolean): void; onSave(id: string, content: string, expectedHash: string | "absent", creating: boolean): Promise<void>;
}) {
  const original = useMemo(() => splitMarkdownSource(resource.content), [resource.content]);
  const [id, setId] = useState(creating ? "" : resource.id); const [frontmatterText, setFrontmatterText] = useState(original.frontmatterText); const [bodyText, setBodyText] = useState(original.bodyText);
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const dirty = id !== (creating ? "" : resource.id) || frontmatterText !== original.frontmatterText || bodyText !== original.bodyText;
  const source = original.frontmatterText || frontmatterText.trim() ? joinMarkdownSource({ frontmatterText, bodyText }) : `${bodyText.trimEnd()}\n`;
  const issues = kind === "instructions" ? validateActionInstruction(source) : source.trim() ? [] : [{ path: "content", message: "Skill content is required" }];
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const save = async () => { setPending(true); setError(""); try { await onSave(id, source, resource.contentHash, creating); onDirty(false); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save Markdown."); } finally { setPending(false); } };
  const impact = kind === "skills" ? skillImpactWarning(id, references) : `${references.find((entry) => entry.kind === "instruction" && entry.id === id)?.references.length ?? 0} referencing Action/role usages.`;
  return <div className="min-w-0 space-y-3">{creating ? <label className="grid gap-1 text-sm">Exact resource ID<Input value={id} onChange={(event) => setId(event.target.value)} /></label> : null}<p role={kind === "skills" ? "alert" : undefined} className="text-sm text-muted-foreground">{impact}</p><MarkdownWorkbench document={markdownEntity(resource, { frontmatterText, bodyText })} emptyTitle="Select a Markdown resource" formId={`resource-${kind}-${resource.id}`} saveLabel="Save Markdown" frontmatterText={frontmatterText} bodyText={bodyText} dirty={dirty} valid={!locked && Boolean(id) && issues.length === 0} pending={pending} fieldErrors={issues[0] ? { body: `${issues[0].path}: ${issues[0].message}` } : undefined} serverError={error} onFrontmatterChange={setFrontmatterText} onBodyChange={setBodyText} onSubmit={save} /></div>;
}

const newResource = (kind: "instructions" | "skills"): ResourceDocument => {
  const skill = kind === "skills";
  const frontmatter = skill ? frontmatterToYaml({ name: "new-skill", description: "Describe the bounded Skill." }) : "";
  const body = skill ? "# New Skill\n\nDescribe the procedure." : "## Task\n\n## Role\n\n## Goals\n\n## Priorities\n\n## Method\n\n## Output contract\n\n## Tool policy\n\n## Acceptance evidence\n";
  return { kind: skill ? "skill" : "instruction", id: "new", content: frontmatter ? joinMarkdownSource({ frontmatterText: frontmatter, bodyText: body }) : body, contentHash: "absent" };
};
