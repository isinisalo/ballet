import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MarkdownDocument } from "backend/shared/domain";
import { Button, TechnicalDetails } from "@/components/forms/FormControls";
import { StatusPill } from "@/design-system/components/StatusPill";

const frontmatterValue = (document: MarkdownDocument, key: string) => {
  const value = document.frontmatter[key];
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : undefined;
};

export function DocumentReader({ document }: { document?: MarkdownDocument }) {
  const [mode, setMode] = useState<"preview" | "split">("preview");
  const [draft, setDraft] = useState(document?.body ?? "");

  useEffect(() => {
    setDraft(document?.body ?? "");
  }, [document?.id, document?.body]);

  if (!document) return <p className="text-sm text-muted-foreground">Select a document.</p>;
  const status = frontmatterValue(document, "status") ?? document.collection;
  const owner = frontmatterValue(document, "owner") ?? "workspace";
  const date = frontmatterValue(document, "date") ?? frontmatterValue(document, "updatedAt") ?? frontmatterValue(document, "createdAt");

  return (
    <article className="grid gap-5">
      <div className="rounded-lg border border-white/10 bg-black/15 p-5">
        <div className="font-mono text-[0.68rem] uppercase text-cyan-200">document / {document.collection}</div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold">{document.title ?? document.slug}</h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{document.relativePath}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="success">{status}</StatusPill>
            <StatusPill tone="accent">{owner}</StatusPill>
            {date ? <StatusPill tone="neutral">{date}</StatusPill> : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant={mode === "preview" ? "default" : "outline"} onClick={() => setMode("preview")}>Preview</Button>
        <Button type="button" variant={mode === "split" ? "default" : "outline"} onClick={() => setMode("split")}>Split edit</Button>
      </div>
      <div className={mode === "split" ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}>
        {mode === "split" ? (
          <textarea
            aria-label="Document editor"
            className="min-h-[32rem] rounded-lg border border-white/10 bg-black/20 p-4 font-mono text-sm leading-6 outline-none focus:border-primary/50"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : null}
        <div className="markdown-body rounded-lg border border-white/10 bg-black/15 p-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft || document.body}</ReactMarkdown>
        </div>
      </div>
      <TechnicalDetails>
        <pre className="max-h-80 overflow-auto rounded-md bg-black/30 p-3 text-xs">{JSON.stringify(document.frontmatter, null, 2)}</pre>
      </TechnicalDetails>
    </article>
  );
}
