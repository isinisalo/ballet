import { useId, useMemo, useRef, type FormEvent } from "react";
import { Braces, Eye, FileKey2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { EditorActions, EmptyState, Panel, WorkbenchLayout } from "@/components/shared/workspace-ui";
import { countEditorWords, estimateEditorTokens, formatEditorMetric } from "./editorMetrics";
import { parseFrontmatterYaml } from "./frontmatter";
import { MarkdownDocumentView } from "./MarkdownDocumentView";
import { documentTitle, markdownPreviewDocument, type MarkdownEntity } from "./markdownDocument";

function EditorMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="font-mono text-[0.65rem] leading-none text-muted-foreground">
      {label}: <span className="text-foreground">{value}</span>
    </span>
  );
}

function WorkbenchTextArea({
  label,
  value,
  error,
  disabled,
  onChange,
  rows
}: {
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  rows: number;
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  return (
    <Field className="gap-2" data-invalid={Boolean(error)}>
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
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="resize-y border-border/80 bg-panel-section/80 font-mono text-base leading-relaxed text-foreground shadow-inner focus-visible:border-primary focus-visible:ring-primary/25 md:text-xs"
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError id={errorId} className="font-mono text-xs">{error}</FieldError>
    </Field>
  );
}

export interface MarkdownWorkbenchFieldErrors {
  frontmatter?: string;
  body?: string;
}

export interface MarkdownWorkbenchProps {
  document?: MarkdownEntity;
  emptyTitle: string;
  formId: string;
  saveLabel: string;
  frontmatterText: string;
  bodyText: string;
  dirty: boolean;
  valid: boolean;
  pending: boolean;
  fieldErrors?: MarkdownWorkbenchFieldErrors;
  serverError?: string;
  deleteLabel?: string;
  deleteType?: string;
  resourceName?: string;
  onDelete?: () => unknown | Promise<unknown>;
  onFrontmatterChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
}

export function MarkdownWorkbench(props: MarkdownWorkbenchProps) {
  const {
    document, emptyTitle, formId, saveLabel, frontmatterText, bodyText, dirty, valid, pending,
    fieldErrors, serverError, deleteLabel, deleteType, resourceName, onDelete,
    onFrontmatterChange, onBodyChange, onSubmit
  } = props;
  const submittingRef = useRef(false);
  const previewDocument = useMemo(
    () => document ? markdownPreviewDocument(document, frontmatterText, bodyText, parseFrontmatterYaml) : undefined,
    [bodyText, document, frontmatterText]
  );

  if (!document) return <EmptyState title={emptyTitle} />;
  const title = documentTitle(previewDocument ?? document);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dirty || !valid || pending || submittingRef.current) return;
    submittingRef.current = true;
    try {
      await onSubmit();
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <WorkbenchLayout
      preview={(
        <Panel title="Preview" icon={<Eye data-icon="inline-start" />} compact>
          <MarkdownDocumentView document={previewDocument} emptyTitle={emptyTitle} compact embedded />
        </Panel>
      )}
      editor={(
        <Panel
          title="Markdown Workbench"
          icon={<FileKey2 data-icon="inline-start" />}
          compact
          contentClassName="p-0"
          action={(
            <EditorActions
              saveLabel={saveLabel}
              formId={formId}
              dirty={dirty}
              valid={valid}
              pending={pending}
              canDelete={Boolean(onDelete)}
              deleteLabel={deleteLabel}
              deleteType={deleteType}
              resourceName={resourceName}
              onDelete={onDelete}
            />
          )}
        >
          <form id={formId} className="flex flex-col" onSubmit={(event) => { void handleSubmit(event); }}>
            {serverError ? (
              <div className="px-4 py-3">
                <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert>
              </div>
            ) : null}
            <div className="flex min-h-10 flex-wrap items-center justify-end gap-3 bg-panel-header px-4 py-2">
              <div className="flex items-center gap-3">
                <EditorMetric label="Words" value={countEditorWords(bodyText)} />
                <EditorMetric label="Tokens" value={formatEditorMetric(estimateEditorTokens(`${frontmatterText}\n${bodyText}`))} />
                <span className="rounded bg-muted px-2 py-1 font-mono text-[0.62rem] font-semibold uppercase leading-none text-muted-foreground">
                  MARKDOWN_MODE
                </span>
              </div>
            </div>
            <div className="grid gap-3 px-4 py-3">
              <div className="flex items-start gap-2 pb-1">
                <Braces className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate font-mono text-[0.65rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Editing source
                  </p>
                  <p className="truncate text-sm font-medium text-foreground">{title}</p>
                </div>
              </div>
              <WorkbenchTextArea label="YAML Frontmatter" rows={9} value={frontmatterText} error={fieldErrors?.frontmatter} disabled={pending} onChange={onFrontmatterChange} />
              <WorkbenchTextArea label="Markdown Body" rows={18} value={bodyText} error={fieldErrors?.body} disabled={pending} onChange={onBodyChange} />
            </div>
          </form>
        </Panel>
      )}
    />
  );
}
