import { useId, type CSSProperties, type KeyboardEvent } from "react";
import { ActionPlanetArtwork } from "./LoopEngineeringArtwork";
import { authoringModelMeta } from "./agentModelPolicy";
import "./LoopEngineeringCanvas.css";
import "./ActionAgentControls.css";

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
  const selectedMeta = authoringModelMeta(model);
  const currentIndex = models.findIndex((candidate) => candidate.id === model);
  const next = models[currentIndex < 0 ? 0 : (currentIndex + 1) % models.length];
  const nextMeta = next ? authoringModelMeta(next.id) : undefined;
  const cycleLabel = selectedMeta
    ? `Change ${role} model, currently ${selectedMeta.name}. Next ${nextMeta?.name ?? selectedMeta.name}.`
    : `Choose ${nextMeta?.name ?? "an available model"} for ${role}.`;
  const options = selected?.reasoningOptions ?? [];
  const index = Math.max(0, options.indexOf(reasoningEffort));
  const progress = options.length > 1 ? index / (options.length - 1) * 100 : 0;
  const style = {
    "--reasoning-progress": `${progress}%`,
    "--reasoning-left": `calc(${progress}% - ${progress * 0.32}px)`,
  } as CSSProperties;

  return <section aria-label={`${role} model and reasoning`} data-model-theme={selectedMeta?.artwork ?? "legacy"} className="action-agent-model-card">
    <button type="button" className="action-agent-model-cycle border-0 bg-transparent disabled:cursor-not-allowed disabled:opacity-50" aria-label={cycleLabel}
      disabled={disabled || !next} onClick={() => next && onChange({ model: next.id, reasoningEffort: next.defaultReasoning ?? next.reasoningOptions[0] ?? "" })}>
      <code className="block whitespace-nowrap text-sm font-semibold text-[var(--agent-model-tone)]">{model || "No model"}</code>
    </button>
    <ReasoningControl role={role} value={reasoningEffort} options={options} index={index} style={style} artwork={selectedMeta?.artwork} disabled={disabled} onChange={(value) => onChange({ model, reasoningEffort: value })} />
  </section>;
}

function ReasoningControl({ role, value, options, index, style, artwork, disabled, onChange }: {
  role: "validation" | "work"; value: string; options: string[]; index: number; style: CSSProperties;
  artwork?: "sol" | "terra" | "luna"; disabled: boolean; onChange(value: string): void;
}) {
  const id = useId();
  return <>
    <div className="action-agent-reasoning-control min-w-0" style={style}>
      <input id={id} aria-label={`${role} Reasoning`} aria-valuetext={formatReasoning(value)} type="range" min={0} max={Math.max(0, options.length - 1)} step={1} value={index}
        disabled={disabled || options.length <= 1} onKeyDown={(event) => changeWithKeyboard(event, index, options, onChange)}
        onChange={(event) => onChange(options[Number(event.target.value)] ?? value)} className="action-agent-reasoning-input disabled:opacity-50" />
      <span aria-hidden="true" className="action-agent-reasoning-rail"><span className="action-agent-reasoning-fill" /></span>
      {artwork ? <span data-testid={`${role}-reasoning-planet`} data-step={index} className="action-agent-reasoning-planet"><ActionPlanetArtwork artwork={artwork} size={32} /></span> : null}
    </div>
    <output htmlFor={id} className="action-agent-reasoning-value text-xs font-semibold text-[var(--agent-model-tone)]">{formatReasoning(value || "Unavailable")}</output>
  </>;
}

const formatReasoning = (value: string): string => value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
const changeWithKeyboard = (event: KeyboardEvent<HTMLInputElement>, index: number, options: string[], onChange: (value: string) => void) => {
  const target = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
    : ["ArrowRight", "ArrowUp"].includes(event.key) ? Math.min(options.length - 1, index + 1)
      : ["ArrowLeft", "ArrowDown"].includes(event.key) ? Math.max(0, index - 1) : undefined;
  if (target === undefined || target === index) return;
  event.preventDefault(); onChange(options[target]!);
};
