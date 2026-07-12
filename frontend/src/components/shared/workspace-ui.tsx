import { useId, useState, type ReactNode } from "react";
import { Archive, Save, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

export { DeleteConfirmDialog } from "./DeleteConfirmDialog";

export const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (["unassigned", "at-risk", "rejected"].includes(status)) return "destructive";
  if (["routed", "done", "accepted", "handled"].includes(status)) return "default";
  if (["in-progress", "proposed", "received", "active"].includes(status)) return "secondary";
  return "outline";
};

export function ErrorPreview({ errors }: { errors?: string[] }) {
  return errors?.length ? <span className="text-destructive">{errors.join("; ")}</span> : <span className="text-muted-foreground">None</span>;
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  compact = false,
  minLength,
  maxLength,
  error,
  disabled = false
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  compact?: boolean;
  minLength?: number;
  maxLength?: number;
  error?: string;
  disabled?: boolean;
}) {
  const fieldId = useId();

  return (
    <Field className="gap-1.5" data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={fieldId} className={compact ? "text-muted-foreground" : undefined}>{label}</FieldLabel>
      <Input
        id={fieldId}
        className={compact ? "min-w-0" : undefined}
        value={value}
        type={type}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  required = false,
  className,
  compact = false,
  minLength,
  maxLength,
  error,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
  className?: string;
  compact?: boolean;
  minLength?: number;
  maxLength?: number;
  error?: string;
  disabled?: boolean;
}) {
  const fieldId = useId();

  return (
    <Field className="gap-1.5" data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={fieldId} className={compact ? "text-muted-foreground" : undefined}>{label}</FieldLabel>
      <Textarea
        id={fieldId}
        className={className}
        value={value}
        rows={rows}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
      aria-invalid={Boolean(error)}
      disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  compact = false,
  disabled = false
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const fieldId = useId();

  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={fieldId} className={compact ? "text-muted-foreground" : undefined}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={fieldId} className="min-w-0 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

export function EmptyState({ title, action }: { title: string; action?: string }) {
  return (
    <Alert>
      <Archive data-icon="inline-start" />
      <AlertDescription>
        <span className="font-medium text-foreground">{title}</span>
        {action ? <span className="ml-2 text-muted-foreground">{action}</span> : null}
      </AlertDescription>
    </Alert>
  );
}

export function Panel({
  title,
  titleExtra,
  description,
  icon,
  children,
  action,
  compact = false,
  contentClassName
}: {
  title: string;
  titleExtra?: ReactNode;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  contentClassName?: string;
}) {
  return (
    <Card className="rounded-none ring-0">
      <CardHeader
          className={cn(
            "min-h-12 items-center gap-1.5 bg-card px-4 py-2.5 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]",
            description && "items-start",
            compact && "min-h-12 py-2.5"
          )}
        >
          <CardTitle className="flex min-w-0 items-center gap-2 font-mono text-xs font-medium leading-none text-foreground [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
            {icon}
            <span className="truncate">{title}</span>
            {titleExtra}
          </CardTitle>
          {description ? <CardDescription className={cn(compact && "text-xs")}>{description}</CardDescription> : null}
          {action ? (
            <CardAction
              className={cn(
                "col-start-2 row-span-1 row-start-1 justify-self-end self-center",
                description && "row-span-2 self-start"
              )}
            >
              {action}
            </CardAction>
          ) : null}
      </CardHeader>
      <CardContent className={cn("px-4 py-4", compact && "py-3", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function HeaderCrudActions({
  saveAction,
  deleteLabel,
  deleteType,
  resourceName,
  canDelete,
  onDelete
}: {
  saveAction: ReactNode;
  deleteLabel: string;
  deleteType: string;
  resourceName?: string;
  canDelete: boolean;
  onDelete: () => unknown | Promise<unknown>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex items-center justify-end gap-2">
      {saveAction}
      {canDelete ? (
        <>
          <Button
            type="button"
            size="icon-sm"
            variant="destructive"
            className="cursor-pointer"
            aria-label={deleteLabel}
            title={deleteLabel}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setConfirmOpen(true);
            }}
          >
            <Trash2 data-icon="inline-start" />
          </Button>
          <DeleteConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            deleteType={deleteType}
            resourceName={resourceName}
            onConfirm={onDelete}
          />
        </>
      ) : null}
    </div>
  );
}

export function CrudActions({
  saveLabel,
  deleteLabel = "Delete",
  formId,
  id,
  disabled = false,
  deleteType = "item",
  resourceName,
  onDelete
}: {
  saveLabel: string;
  deleteLabel?: string;
  formId: string;
  id?: string;
  disabled?: boolean;
  deleteType?: string;
  resourceName?: string;
  onDelete: () => unknown | Promise<unknown>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
      <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
        <Button type="submit" size="icon-sm" form={formId} disabled={disabled} aria-label={saveLabel} title={saveLabel}>
          <Save data-icon="inline-start" />
        </Button>
        {id ? (
          <>
            <Button type="button" size="icon-sm" variant="destructive" aria-label={deleteLabel} title={deleteLabel} onClick={() => setConfirmOpen(true)}>
              <Trash2 data-icon="inline-start" />
            </Button>
            <DeleteConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              deleteType={deleteType}
              resourceName={resourceName}
              onConfirm={onDelete}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
