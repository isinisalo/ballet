import { useId, type KeyboardEvent } from "react";
import { SelectField } from "@/components/shared/workspace-ui";

export type ActionModelOption = {
  id: string;
  label: string;
  reasoningOptions: string[];
  defaultReasoning?: string;
};

export function ActionAgentControls({ role, model, reasoningEffort, models, disabled, onChange }: {
  role: "validation" | "work";
  model: string;
  reasoningEffort: string;
  models: ActionModelOption[];
  disabled: boolean;
  onChange(value: { model: string; reasoningEffort: string }): void;
}) {
  const selected = models.find((candidate) => candidate.id === model);
  const options = selected?.reasoningOptions ?? [];
  const index = Math.max(0, options.indexOf(reasoningEffort));
  return <section aria-label={`${role} model and reasoning`} className="space-y-2 rounded-sm border bg-background p-3">
    <SelectField label="Model" layout="row" density="compact" value={model}
      options={models.map(({ id, label }) => ({ value: id, label }))} disabled={disabled}
      onChange={(nextModel) => {
        const next = models.find(({ id }) => id === nextModel);
        if (next) onChange({ model: next.id, reasoningEffort: next.defaultReasoning ?? next.reasoningOptions[0] ?? "" });
      }} />
    <ReasoningControl role={role} value={reasoningEffort} options={options} index={index} disabled={disabled}
      onChange={(value) => onChange({ model, reasoningEffort: value })} />
  </section>;
}

function ReasoningControl({ role, value, options, index, disabled, onChange }: {
  role: "validation" | "work"; value: string; options: string[]; index: number; disabled: boolean; onChange(value: string): void;
}) {
  const id = useId();
  return <div className="grid gap-1.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center">
    <label htmlFor={id} className="font-mono text-[0.68rem] font-medium leading-4 text-muted-foreground">Reasoning</label>
    <div className="flex min-h-10 min-w-0 items-center gap-3 md:min-h-7">
      <input id={id} aria-label={`${role} Reasoning`} aria-valuetext={formatReasoning(value)} type="range"
        min={0} max={Math.max(0, options.length - 1)} step={1} value={index}
        disabled={disabled || options.length <= 1} onKeyDown={(event) => changeWithKeyboard(event, index, options, onChange)}
        onChange={(event) => onChange(options[Number(event.target.value)] ?? value)}
        className="h-10 min-w-0 flex-1 accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-7" />
      <output htmlFor={id} className="min-w-12 text-right text-xs font-semibold text-primary">{formatReasoning(value || "Unavailable")}</output>
    </div>
  </div>;
}

const formatReasoning = (value: string): string => value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
const changeWithKeyboard = (event: KeyboardEvent<HTMLInputElement>, index: number, options: string[], onChange: (value: string) => void) => {
  const target = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
    : ["ArrowRight", "ArrowUp"].includes(event.key) ? Math.min(options.length - 1, index + 1)
      : ["ArrowLeft", "ArrowDown"].includes(event.key) ? Math.max(0, index - 1) : undefined;
  if (target === undefined || target === index) return;
  event.preventDefault(); onChange(options[target]!);
};
