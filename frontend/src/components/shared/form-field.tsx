import { useId, type ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type FormFieldDensity = "default" | "compact";
export type FormFieldLayout = "stacked" | "row";

type FormFieldFrameProps = {
  id: string;
  label: string;
  description?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  density: FormFieldDensity;
  layout: FormFieldLayout;
  children: (describedBy: string | undefined) => ReactNode;
};

function FormFieldFrame({ id, label, description, error, required, disabled, density, layout, children }: FormFieldFrameProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <Field
      className={cn(
        "@container/form-field gap-1.5",
        layout === "row" && "grid grid-cols-1 @sm/form-field:grid-cols-[5.5rem_minmax(0,1fr)] @sm/form-field:items-start",
        disabled && "opacity-70"
      )}
      data-density={density}
      data-layout={layout}
      data-disabled={disabled || undefined}
      data-invalid={Boolean(error)}
    >
      <FieldLabel
        htmlFor={id}
        className={cn(
          density === "compact" && "font-mono text-[0.68rem] font-medium leading-4 text-muted-foreground",
          layout === "row" && "@sm/form-field:min-h-7 @sm/form-field:items-center",
          required && "after:text-destructive after:content-['*']"
        )}
      >
        {label}
      </FieldLabel>
      <div className="grid min-w-0 gap-1">
        {children(describedBy)}
        {description ? <FieldDescription id={descriptionId} className={density === "compact" ? "text-xs" : undefined}>{description}</FieldDescription> : null}
        {error ? <FieldError id={errorId} className={density === "compact" ? "text-xs" : undefined}>{error}</FieldError> : null}
      </div>
    </Field>
  );
}

type SharedFieldProps = {
  label: string;
  description?: ReactNode;
  required?: boolean;
  density?: FormFieldDensity;
  layout?: FormFieldLayout;
  error?: string;
  disabled?: boolean;
  className?: string;
};

export function TextField({
  label,
  description,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  density = "default",
  layout = "stacked",
  minLength,
  maxLength,
  error,
  disabled = false,
  className,
  name,
  autoComplete
}: SharedFieldProps & {
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  name?: string;
  autoComplete?: string;
}) {
  const fieldId = useId();

  return (
    <FormFieldFrame id={fieldId} label={label} description={description} error={error} required={required} disabled={disabled} density={density} layout={layout}>
      {(describedBy) => (
        <Input
          id={fieldId}
          name={name}
          className={cn(
            density === "compact" ? "h-10 text-base md:h-7 md:text-xs" : "h-10 text-base md:h-8 md:text-sm",
            className
          )}
          value={value}
          type={type}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormFieldFrame>
  );
}

export function TextAreaField({
  label,
  description,
  value,
  onChange,
  rows = 3,
  required = false,
  className,
  density = "default",
  layout = "stacked",
  minLength,
  maxLength,
  error,
  disabled = false,
  name,
  placeholder
}: SharedFieldProps & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  minLength?: number;
  maxLength?: number;
  name?: string;
  placeholder?: string;
}) {
  const fieldId = useId();

  return (
    <FormFieldFrame id={fieldId} label={label} description={description} error={error} required={required} disabled={disabled} density={density} layout={layout}>
      {(describedBy) => (
        <Textarea
          id={fieldId}
          name={name}
          className={cn(
            density === "compact" ? "min-h-20 text-base md:min-h-14 md:text-xs" : "min-h-20 text-base md:text-sm",
            className
          )}
          value={value}
          rows={rows}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormFieldFrame>
  );
}

export function SelectField({
  label,
  description,
  value,
  options,
  onChange,
  density = "default",
  layout = "stacked",
  disabled = false,
  error,
  required = false,
  placeholder
}: SharedFieldProps & {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const fieldId = useId();

  return (
    <FormFieldFrame id={fieldId} label={label} description={description} error={error} required={required} disabled={disabled} density={density} layout={layout}>
      {(describedBy) => (
        <Select value={value} items={options} onValueChange={(next) => { if (next !== null) onChange(next); }} disabled={disabled} required={required}>
          <SelectTrigger
            id={fieldId}
            size={density === "compact" ? "sm" : "default"}
            className={cn(
              "min-w-0 w-full text-base",
              density === "compact" ? "h-10 md:h-7 md:text-xs" : "h-10 md:h-8 md:text-sm"
            )}
            aria-invalid={Boolean(error)}
            aria-required={required}
            aria-describedby={describedBy}
          >
            <SelectValue placeholder={placeholder} />
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
      )}
    </FormFieldFrame>
  );
}
