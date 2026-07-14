import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

export const compactLoopControl = "h-[22px] min-h-[22px] w-full rounded-md border-divider-strong bg-card px-1.5 py-0 font-mono text-[0.66rem] leading-4 shadow-none";
export const compactLoopFormControl = "h-10 min-h-10 w-full rounded border-divider-strong bg-card px-2 py-0 font-mono text-base leading-5 shadow-none md:h-7 md:min-h-7 md:text-xs md:leading-4";

export type LoopEditorSelectOption = { value: string; label: string; group?: string };

export function LoopEditorSelect({ id, ariaLabel, describedBy, density = "canvas", value, options, disabled, invalid, onChange }: {
  id?: string;
  ariaLabel: string;
  describedBy?: string;
  density?: "canvas" | "form";
  value: string;
  options: LoopEditorSelectOption[];
  disabled: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const groups = groupedOptions(options);
  return (
    <Select value={value || null} disabled={disabled} items={options} onValueChange={(next) => { if (next !== null) onChange(next); }}>
      <SelectTrigger
        id={id}
        size="sm"
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={density === "form" ? compactLoopFormControl : compactLoopControl}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => (
          <SelectGroup key={group.label ?? "options"}>
            {group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
            {group.options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

function groupedOptions(options: LoopEditorSelectOption[]) {
  const groups = new Map<string | undefined, LoopEditorSelectOption[]>();
  options.forEach((option) => groups.set(option.group, [...(groups.get(option.group) ?? []), option]));
  return [...groups].map(([label, grouped]) => ({ label, options: grouped }));
}
