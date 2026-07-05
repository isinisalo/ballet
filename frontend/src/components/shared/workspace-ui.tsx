import { useId, useState, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Archive, Plus, Save, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (["unassigned", "at-risk", "rejected"].includes(status)) return "destructive";
  if (["routed", "done", "accepted", "handled"].includes(status)) return "default";
  if (["in-progress", "proposed", "received", "active"].includes(status)) return "secondary";
  return "outline";
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{status}</Badge>;
}

export function ErrorPreview({ errors }: { errors?: string[] }) {
  if (!errors?.length) return <span className="text-muted-foreground">None</span>;
  return <span className="text-destructive">{errors.join("; ")}</span>;
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  compact = false
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  const fieldId = useId();

  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={fieldId} className={compact ? "text-muted-foreground" : undefined}>{label}</FieldLabel>
      <Input id={fieldId} className={compact ? "min-w-0" : undefined} value={value} type={type} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
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
  compact = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const fieldId = useId();

  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={fieldId} className={compact ? "text-muted-foreground" : undefined}>{label}</FieldLabel>
      <Textarea id={fieldId} className={className} value={value} rows={rows} required={required} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  compact = false
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const fieldId = useId();

  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={fieldId} className={compact ? "text-muted-foreground" : undefined}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
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

export function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <Switch
      size="default"
      checked={checked}
      aria-label={label}
      title={label}
      className="data-checked:bg-secondary data-unchecked:bg-muted-foreground/40 dark:data-unchecked:bg-muted-foreground/45"
      onCheckedChange={onChange}
    />
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

export function DataTable({
  columns,
  rows,
  empty
}: {
  columns: string[];
  rows: Array<{ id: string; cells: ReactNode[]; onClick?: () => void; action?: ReactNode }>;
  empty: string;
}) {
  if (rows.length === 0) return <EmptyState title={empty} />;

  const hasActions = rows.some((row) => row.action);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
          {hasActions ? <TableHead /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} onClick={row.onClick} className={cn(row.onClick && "cursor-pointer")}>
            {row.cells.map((cell, index) => (
              <TableCell key={`${row.id}-${index}`} className="max-w-[28rem] whitespace-normal">
                {cell}
              </TableCell>
            ))}
            {hasActions ? <TableCell className="w-10">{row.action}</TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function SaveAction({ formId, label, disabled = false }: { formId: string; label: string; disabled?: boolean }) {
  return (
    <Button
      type="submit"
      size="icon-sm"
      className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary-container focus-visible:border-primary/60 focus-visible:ring-primary/30"
      form={formId}
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={(event) => event.stopPropagation()}
    >
      <Save data-icon="inline-start" />
    </Button>
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
  onDelete: () => void | Promise<void>;
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

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  deleteType,
  resourceName,
  onConfirm
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleteType: string;
  resourceName?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const trimmedResourceName = resourceName?.trim();
  const fallbackName = `this ${deleteType}`;
  const displayedName = trimmedResourceName || fallbackName;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          className="fixed left-1/2 top-1/2 z-50 grid w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-divider-strong bg-card p-4 text-card-foreground shadow-lg outline-none transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid gap-1.5">
            <DialogPrimitive.Title className="text-sm font-semibold text-foreground">
              Delete {deleteType}?
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm leading-relaxed text-muted-foreground">
              Delete <span className="font-medium text-foreground">{displayedName}</span>? This action cannot be undone.
            </DialogPrimitive.Description>
          </div>
          <div className="flex items-center justify-end gap-2">
            <DialogPrimitive.Close
              render={
                <Button type="button" variant="outline" className="cursor-pointer">
                  Cancel
                </Button>
              }
            />
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenChange(false);
                void Promise.resolve(onConfirm()).catch(() => undefined);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function CrudActions({
  newLabel,
  saveLabel,
  deleteLabel = "Delete",
  formId,
  id,
  disabled = false,
  leading,
  deleteType = "item",
  resourceName,
  onNew,
  onDelete
}: {
  newLabel: string;
  saveLabel: string;
  deleteLabel?: string;
  formId: string;
  id?: string;
  disabled?: boolean;
  leading?: ReactNode;
  deleteType?: string;
  resourceName?: string;
  onNew: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
      {leading}
      <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
        <Button type="button" size="icon-sm" variant="outline" aria-label={newLabel} title={newLabel} onClick={onNew}>
          <Plus data-icon="inline-start" />
        </Button>
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
