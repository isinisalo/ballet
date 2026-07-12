import { useId } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ThemeColorField({
  label,
  value,
  previewValue,
  error,
  onChange
}: {
  label: string;
  value: string;
  previewValue: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  return (
    <Field className="gap-1.5" data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      <div className="flex min-w-0 gap-2">
        <Input
          type="color"
          aria-label={`${label} picker`}
          className="size-9 shrink-0 cursor-pointer p-1"
          value={previewValue}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          id={fieldId}
          className="min-w-0 font-mono"
          value={value}
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
