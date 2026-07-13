import { useId } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ThemeColorField({
  label,
  value,
  previewValue,
  error,
  disabled = false,
  onChange
}: {
  label: string;
  value: string;
  previewValue: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  return (
    <Field className="gap-1.5" data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={fieldId} className="font-mono text-[0.68rem] font-medium text-muted-foreground">{label}</FieldLabel>
      <div className="flex min-w-0 gap-2">
        <Input
          type="color"
          aria-label={`${label} picker`}
          className="size-10 shrink-0 cursor-pointer p-1 md:size-7"
          value={previewValue}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          id={fieldId}
          className="h-10 min-w-0 font-mono text-base md:h-7 md:text-xs"
          value={value}
          disabled={disabled}
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}
