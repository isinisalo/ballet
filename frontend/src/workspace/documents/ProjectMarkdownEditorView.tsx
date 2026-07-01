import { useEffect, useId, useMemo, useState } from "react";
import { Bold, Braces, Code2, Eye, FileKey2, Italic, Link2, List, Plus, Save } from "lucide-react";
import type { MarkdownDocument } from "../../../../shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, Panel } from "@/components/shared/workspace-ui";
import { cn } from "@/lib/utils";
import { frontmatterToYaml, parseFrontmatterYaml } from "./frontmatter";
import { MarkdownDocumentView } from "./MarkdownDocumentView";
import { documentTitle, markdownPreviewDocument, type MarkdownEntity } from "./markdownDocument";
import { createKindForProjectDocument, projectDocumentCreateConfig } from "./projectDocuments";
import type { ProjectDocumentCreateKind } from "../types";

const countWords = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

const tokenEstimate = (value: string) => {
  const estimate = Math.max(0, Math.ceil(value.length / 4));
  if (estimate >= 1000) return `${(estimate / 1000).toFixed(estimate >= 10000 ? 0 : 1)}k`;
  return String(estimate);
};

function EditorMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="font-mono text-[0.65rem] leading-none text-muted-foreground">
      {label}: <span className="text-foreground">{value}</span>
    </span>
  );
}

function EditorToolbar() {
  const items = [
    { label: "Bold", icon: Bold },
    { label: "Italic", icon: Italic },
    { label: "List", icon: List },
    { label: "Code", icon: Code2 },
    { label: "Link", icon: Link2 }
  ];

  return (
    <div className="flex items-center gap-1 text-muted-foreground" aria-label="Markdown formatting tools">
      {items.map(({ label, icon: Icon }) => (
        <span
          key={label}
          className="grid size-7 place-items-center rounded border border-transparent text-muted-foreground"
          title={label}
          aria-label={label}
        >
          <Icon className="size-3.5" />
        </span>
      ))}
    </div>
  );
}

function WorkbenchTextArea({
  label,
  value,
  onChange,
  rows,
  className
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  className?: string;
}) {
  const fieldId = useId();

  return (
    <Field className="gap-2">
      <div className="flex items-center gap-3 pt-1">
        <FieldLabel htmlFor={fieldId} className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {label}
        </FieldLabel>
        <span className="h-px min-w-4 flex-1 bg-border/70" aria-hidden="true" />
        <span className="font-mono text-[0.62rem] uppercase text-muted-foreground">{value.length} chars</span>
      </div>
      <Textarea
        id={fieldId}
        value={value}
        rows={rows}
        spellCheck={false}
        className={cn(
          "resize-y border-border/80 bg-panel-section/80 font-mono text-xs leading-relaxed text-foreground shadow-inner focus-visible:border-primary focus-visible:ring-primary/25",
          className
        )}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function ProjectMarkdownEditorView({
  document,
  emptyTitle,
  saveProjectDocument,
  onCreateDocument
}: {
  document?: MarkdownEntity;
  emptyTitle: string;
  saveProjectDocument: (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
  onCreateDocument?: (kind: ProjectDocumentCreateKind) => void;
}) {
  const formId = useId();
  const [frontmatterText, setFrontmatterText] = useState(frontmatterToYaml(document?.frontmatter));
  const [bodyText, setBodyText] = useState(document?.body ?? "");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setFrontmatterText(frontmatterToYaml(document?.frontmatter));
    setBodyText(document?.body ?? "");
    setValidationError("");
  }, [document]);

  const handleSave = async () => {
    if (!document?.relativePath) return;

    try {
      const frontmatter = parseFrontmatterYaml(frontmatterText);
      setValidationError("");
      await saveProjectDocument({
        relativePath: document.relativePath,
        frontmatter,
        body: bodyText
      });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Invalid project document.");
    }
  };

  const previewDocument = useMemo(
    () => document ? markdownPreviewDocument(document, frontmatterText, bodyText, parseFrontmatterYaml) : undefined,
    [bodyText, document, frontmatterText]
  );

  if (!document) return <EmptyState title={emptyTitle} />;
  const title = documentTitle(previewDocument ?? document);
  const wordCount = countWords(bodyText);
  const tokens = tokenEstimate(`${frontmatterText}\n${bodyText}`);
  const createKind = createKindForProjectDocument(document.relativePath);
  const createConfig = createKind ? projectDocumentCreateConfig[createKind] : undefined;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]">
      <Panel
        title="Preview"
        icon={<Eye data-icon="inline-start" />}
        compact
      >
        <MarkdownDocumentView document={previewDocument} emptyTitle={emptyTitle} compact embedded />
      </Panel>
      <Panel
        title="Markdown Workbench"
        icon={<FileKey2 data-icon="inline-start" />}
        compact
        action={(
          <div className="flex items-center justify-end gap-2">
            {createKind && createConfig && onCreateDocument ? (
              <Button type="button" size="icon-sm" variant="outline" aria-label={createConfig.label} title={createConfig.label} onClick={() => onCreateDocument(createKind)}>
                <Plus data-icon="inline-start" />
              </Button>
            ) : null}
            <Button type="submit" size="icon-sm" form={formId} aria-label="Save Markdown" title="Save Markdown">
              <Save data-icon="inline-start" />
            </Button>
          </div>
        )}
      >
        <form id={formId} className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          {validationError ? <Alert variant="destructive"><AlertDescription>{validationError}</AlertDescription></Alert> : null}
          <div className="rounded-lg border border-border/80 bg-panel-section">
            <div className="flex min-h-10 flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-panel-header px-3 py-2">
              <EditorToolbar />
              <div className="flex items-center gap-3">
                <EditorMetric label="Words" value={wordCount} />
                <EditorMetric label="Tokens" value={tokens} />
                <span className="rounded bg-muted px-2 py-1 font-mono text-[0.62rem] font-semibold uppercase leading-none text-muted-foreground">
                  MARKDOWN_MODE
                </span>
              </div>
            </div>
            <div className="grid gap-3 p-3">
              <div className="flex items-start gap-2 border-b border-border/70 pb-3">
                <Braces className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate font-mono text-[0.65rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Editing source
                  </p>
                  <p className="truncate text-sm font-medium text-foreground">{title}</p>
                </div>
              </div>
              <WorkbenchTextArea label="YAML Frontmatter" rows={9} value={frontmatterText} onChange={setFrontmatterText} />
              <WorkbenchTextArea label="Markdown Body" rows={18} value={bodyText} onChange={setBodyText} />
            </div>
          </div>
        </form>
      </Panel>
    </div>
  );
}
