import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const compactLoopControl = "h-[22px] min-h-[22px] w-full rounded-md border-divider-strong bg-card px-1.5 py-0 font-mono text-[0.66rem] leading-4 shadow-none";

export function LoopEditorSelect({ ariaLabel, value, options, disabled, invalid, onChange }: {
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value || undefined} disabled={disabled} items={options} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={ariaLabel} aria-invalid={invalid} className={compactLoopControl}><SelectValue /></SelectTrigger>
      <SelectContent><SelectGroup>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
    </Select>
  );
}
