import { useMemo, useState } from "react";
import type { AppData, MarkdownDocument } from "backend/shared/domain";
import { PageHeader, Section } from "@/components/forms/FormControls";
import { DocumentReader } from "@/features/project-knowledge/DocumentReader";
import { DocumentTree } from "@/features/project-knowledge/DocumentTree";

type KnowledgeTab = "ADRs" | "Goals" | "Project" | "Skills docs";

const docsForTab = (data: AppData, tab: KnowledgeTab): MarkdownDocument[] => {
  if (tab === "ADRs") return data.documents?.adr ?? data.adrs.map((adr) => entityToDocument("adr", adr.id, adr.title, adr.body, adr.relativePath, adr.frontmatter));
  if (tab === "Goals") return data.documents?.goals ?? data.goals.map((goal) => entityToDocument("goals", goal.id, goal.title, goal.body, goal.relativePath, goal.frontmatter));
  if (tab === "Skills docs") return data.documents?.skills ?? data.skills.map((skill) => entityToDocument("skills", skill.id, skill.name, skill.body, skill.relativePath, skill.frontmatter));
  return data.documents?.project ?? data.projects.map((project) => entityToDocument("project", project.id, project.name, project.body, project.relativePath, project.frontmatter));
};

const entityToDocument = (collection: string, id: string, title: string, body = "", relativePath = `${collection}/${id}.md`, frontmatter: Record<string, unknown> = {}): MarkdownDocument => ({
  id,
  collection,
  title,
  body: body || `# ${title}\n\nNo markdown body has been written yet.`,
  relativePath,
  absolutePath: relativePath,
  slug: id,
  frontmatter
});

export function ProjectKnowledgePage({
  data,
  selectedDocumentId
}: {
  data: AppData;
  selectedDocumentId?: string;
}) {
  const [tab, setTab] = useState<KnowledgeTab>("ADRs");
  const [query, setQuery] = useState("");
  const documents = docsForTab(data, tab);
  const filtered = documents.filter((document) =>
    `${document.title ?? ""} ${document.relativePath} ${document.body}`.toLowerCase().includes(query.toLowerCase())
  );
  const initial = useMemo(() => documents.find((document) => document.id === selectedDocumentId) ?? filtered[0] ?? documents[0], [documents, filtered, selectedDocumentId]);
  const [selected, setSelected] = useState<MarkdownDocument | undefined>(initial);
  const current = selected && filtered.some((document) => document.id === selected.id) ? selected : filtered[0];

  return (
    <div className="grid gap-5">
      <PageHeader title="Project Knowledge" description="Polished reader and split editor for ADRs, goals, project documents, and skill docs." />
      <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.32fr)_minmax(0,1fr)]">
        <Section title="Document Tree" className="border-white/10 bg-card/70">
          <div className="flex flex-wrap gap-2">
            {(["ADRs", "Goals", "Project", "Skills docs"] as KnowledgeTab[]).map((item) => (
              <button key={item} type="button" className={`rounded-md border px-3 py-1.5 text-sm ${tab === item ? "border-primary/60 bg-primary/20" : "border-white/10 bg-black/15"}`} onClick={() => { setTab(item); setSelected(undefined); }}>
                {item}
              </button>
            ))}
          </div>
          <input
            aria-label="Search documents"
            className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-primary/50"
            placeholder="Search documents..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {data.projectDocumentTree?.length && !query ? (
            <DocumentTree nodes={data.projectDocumentTree} selectedId={current?.id} onSelect={setSelected} />
          ) : (
            <div className="grid gap-1">
              {filtered.map((document) => (
                <button key={document.id} type="button" className={`rounded-md px-2 py-2 text-left text-sm ${current?.id === document.id ? "bg-primary/20" : "hover:bg-white/8"}`} onClick={() => setSelected(document)}>
                  {document.title ?? document.relativePath}
                </button>
              ))}
            </div>
          )}
        </Section>
        <Section title="Document Reader" className="border-white/10 bg-card/70">
          <DocumentReader document={current} />
        </Section>
      </div>
    </div>
  );
}
