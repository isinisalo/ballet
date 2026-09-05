import { useId, useRef, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { EditorActions, EmptyState } from "@/components/shared/workspace-ui";
import { countEditorWords, estimateEditorTokens, formatEditorMetric } from "./editorMetrics";
import { type MarkdownEntity } from "./markdownDocument";

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
    <Field className="min-w-0 gap-2" data-invalid={Boolean(error)}>
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
        className="min-w-0 resize-y border-border/80 bg-panel-section/80 font-mono text-base leading-relaxed text-foreground shadow-inner focus-visible:border-primary focus-visible:ring-primary/25 md:text-xs"
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
  showActions?: boolean;
  onFrontmatterChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
}

export function MarkdownWorkbench(props: MarkdownWorkbenchProps) {
  const {
    document, emptyTitle, formId, saveLabel, frontmatterText, bodyText, dirty, valid, pending,
    fieldErrors, serverError, deleteLabel, deleteType, resourceName, onDelete, showActions = true,
    onFrontmatterChange, onBodyChange, onSubmit
  } = props;
  const submittingRef = useRef(false);
  if (!document) return <EmptyState title={emptyTitle} />;
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
    <form id={formId} className="grid min-w-0 grid-cols-1 gap-3" onSubmit={(event) => { void handleSubmit(event); }}>
      {serverError ? <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert> : null}
      <WorkbenchTextArea label="YAML Frontmatter" rows={9} value={frontmatterText} error={fieldErrors?.frontmatter} disabled={pending} onChange={onFrontmatterChange} />
      <WorkbenchTextArea label="Markdown Body" rows={18} value={bodyText} error={fieldErrors?.body} disabled={pending} onChange={onBodyChange} />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <EditorMetric label="Words" value={countEditorWords(bodyText)} />
        <EditorMetric label="Tokens" value={formatEditorMetric(estimateEditorTokens(`${frontmatterText}\n${bodyText}`))} />
        {showActions ? <EditorActions saveLabel={saveLabel} formId={formId} dirty={dirty} valid={valid} pending={pending} canDelete={Boolean(onDelete)} deleteLabel={deleteLabel} deleteType={deleteType} resourceName={resourceName} onDelete={onDelete} /> : null}
      </div>
    </form>
  );
}
