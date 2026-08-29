import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateActionInstruction } from "@shared/orchestration/instructionContract";
import type { ReferenceEntry, ResourceDocument } from "../types";
import { skillImpactWarning } from "../authoringModels";
import { ConfigureHeader, IssueList } from "./ConfigureHeader";

export function ResourceWorkspace({ kind, resources, references, locked, selectedId: initialSelectedId, onSave }: { kind: "instructions" | "skills"; resources: ResourceDocument[]; references: ReferenceEntry[]; locked: boolean; selectedId?: string; onSave(id: string, content: string, expectedHash: string | "absent", creating: boolean): Promise<void> }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(initialSelectedId); const [creating, setCreating] = useState(false);
  const selected = resources.find((resource) => resource.id === selectedId);
  return <><ConfigureHeader title={kind === "skills" ? "Skills" : "Instructions"} description={kind === "skills" ? "Shared Skill changes expose the complete reverse-reference impact before save or refinement." : "Safe Markdown resources are validated against the Action instruction contract."} status={locked ? "Referenced resource locked" : `${resources.length} resources`} actions={<Button size="sm" disabled={locked} onClick={() => { setCreating(true); setSelectedId(undefined); }}>Create</Button>} /><div className="grid gap-4 p-4 md:grid-cols-[18rem_minmax(0,1fr)] md:p-6"><ul className="space-y-2">{resources.map((resource) => <li key={resource.id}><button className="min-h-10 w-full rounded-sm border bg-card px-3 text-left font-mono text-sm hover:bg-accent" onClick={() => { setCreating(false); setSelectedId(resource.id); }}>{resource.id}</button></li>)}</ul>{selected || creating ? <ResourceEditor key={selected?.id ?? "new"} kind={kind} resource={selected} references={references} locked={locked} onSave={onSave} /> : <section className="rounded-md border border-dashed p-6 text-muted-foreground">Select a resource to inspect content, usage, validation, and active Run lock.</section>}</div></>;
}

function ResourceEditor({ kind, resource, references, locked, onSave }: { kind: "instructions" | "skills"; resource?: ResourceDocument; references: ReferenceEntry[]; locked: boolean; onSave(id: string, content: string, expectedHash: string | "absent", creating: boolean): Promise<void> }) {
  const [id, setId] = useState(resource?.id ?? ""); const [content, setContent] = useState(resource?.content ?? "# Resource\n");
  const issues = kind === "instructions" ? validateActionInstruction(content) : content.trim() ? [] : [{ path: "content", message: "Skill content is required" }];
  const impact = kind === "skills" ? skillImpactWarning(id, references) : `${references.find((entry) => entry.kind === "instruction" && entry.id === id)?.references.length ?? 0} referencing Action/role usages.`;
  return <form className="min-w-0 space-y-4 rounded-md border bg-card p-4" onSubmit={(event) => { event.preventDefault(); void onSave(id, content, resource?.contentHash ?? "absent", !resource); }}><div><Label htmlFor="resource-id">Exact resource ID</Label><Input id="resource-id" disabled={Boolean(resource)} value={id} onChange={(event) => setId(event.target.value)} /></div><div><Label htmlFor="resource-content">Safe Markdown content</Label><textarea id="resource-content" className="min-h-[26rem] w-full resize-y rounded-sm border bg-background p-3 font-mono text-sm" value={content} onChange={(event) => setContent(event.target.value)} /></div><p role={kind === "skills" ? "alert" : undefined} className="text-sm text-muted-foreground">{impact}</p><IssueList issues={issues} /><Button disabled={locked || issues.length > 0 || !id}>Save {kind === "skills" ? "Skill" : "instruction"}</Button></form>;
}
