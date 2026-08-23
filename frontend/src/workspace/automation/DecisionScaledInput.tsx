import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export function DecisionScaledInput({ label, value, disabled, format, parse, onChange, suffix, help }: {
  label: string;
  value: number;
  disabled: boolean;
  format: (value: number) => string;
  parse: (value: string) => number | undefined;
  onChange: (value: number) => void;
  suffix?: string;
  help?: string;
}) {
  const [text, setText] = useState(() => format(value));
  useEffect(() => setText(format(value)), [format, value]);
  const parsed = parse(text);
  const invalid = parsed === undefined;
  return <label className="grid gap-1 font-mono text-[0.625rem] uppercase text-muted-foreground">
    {label}
    <div className="relative"><Input aria-label={label} inputMode="decimal" disabled={disabled} aria-invalid={invalid} value={text} className={suffix ? "pr-12 font-sans text-xs normal-case" : "font-sans text-xs normal-case"} onChange={(event) => {
      const next = event.target.value;
      setText(next);
      const nextParsed = parse(next);
      if (nextParsed !== undefined) onChange(nextParsed);
    }} onBlur={() => { if (invalid) setText(format(value)); }} />{suffix ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-sans text-xs normal-case text-muted-foreground">{suffix}</span> : null}</div>
    {invalid ? <span className="font-sans text-[0.6875rem] normal-case text-destructive">Enter an exact valid value.</span> : help ? <span className="font-sans text-[0.6875rem] normal-case text-muted-foreground">{help}</span> : null}
  </label>;
}
