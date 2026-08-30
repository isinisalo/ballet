import { useId } from "react";
import { cn } from "@/lib/utils";

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
  const reasoningOptions = selected?.reasoningOptions ?? [];
  return <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(12rem,.65fr)]">
    <ModelCards role={role} value={model} models={models} disabled={disabled} onChange={(nextModel) => {
      const next = models.find((candidate) => candidate.id === nextModel);
      onChange({ model: nextModel, reasoningEffort: next?.defaultReasoning ?? next?.reasoningOptions[0] ?? "" });
    }} />
    <ReasoningSlider role={role} value={reasoningEffort} options={reasoningOptions} disabled={disabled} onChange={(nextReasoning) => onChange({ model, reasoningEffort: nextReasoning })} />
  </div>;
}

function ModelCards({ role, value, models, disabled, onChange }: {
  role: "validation" | "work";
  value: string;
  models: ActionModelOption[];
  disabled: boolean;
  onChange(value: string): void;
}) {
  const name = `${role}-model`;
  return <fieldset className="min-w-0">
    <legend className="mb-1 font-mono text-[0.68rem] font-medium text-muted-foreground">Model</legend>
    <div className="flex min-w-0 flex-wrap gap-1.5" role="radiogroup" aria-label={`${role} Model`}>
      {models.map((option) => <label key={option.id} className={cn(
        "flex min-h-10 min-w-0 cursor-pointer items-center rounded-sm border bg-background px-3 py-1.5 text-xs outline-none transition-colors motion-reduce:transition-none md:min-h-8",
        "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
        value === option.id ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30" : "border-border hover:bg-accent",
        disabled && "cursor-not-allowed opacity-50",
      )}>
        <input className="sr-only" type="radio" name={name} value={option.id} checked={value === option.id} disabled={disabled}
          onChange={() => onChange(option.id)} />
        <span className="truncate">{option.label}</span>
      </label>)}
    </div>
  </fieldset>;
}

function ReasoningSlider({ role, value, options, disabled, onChange }: {
  role: "validation" | "work";
  value: string;
  options: string[];
  disabled: boolean;
  onChange(value: string): void;
}) {
  const id = useId();
  const index = Math.max(0, options.indexOf(value));
  const unavailable = options.length === 0;
  return <div className="min-w-0 rounded-sm border bg-background px-3 py-2">
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="font-mono text-[0.68rem] font-medium text-muted-foreground">Reasoning</label>
      <output htmlFor={id} className="text-xs font-semibold text-primary">{formatReasoning(value || "Unavailable")}</output>
    </div>
    <input id={id} aria-label={`${role} Reasoning`} aria-valuetext={value} type="range" min={0} max={Math.max(0, options.length - 1)} step={1}
      value={index} disabled={disabled || options.length <= 1} onChange={(event) => onChange(options[Number(event.target.value)] ?? value)}
      className="mt-2 h-10 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50 md:h-2" />
    <div aria-hidden="true" className="mt-1 grid px-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))` }}>
      {(unavailable ? [""] : options).map((option, optionIndex) => <span key={option || "unavailable"} className={cn(
        "mx-auto size-1.5 rounded-full bg-muted-foreground/45",
        optionIndex <= index && !unavailable && "bg-primary",
      )} />)}
    </div>
  </div>;
}

const formatReasoning = (value: string): string => value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
