import type { ActionAgentDefinition, ActionDefinition } from "@shared/orchestration/environment";
import type { ResourceDocument } from "../types";
import { ActionAgentControls, type ActionModelOption } from "./ActionAgentControls";
import { SkillBadgePicker } from "./SkillBadgePicker";

export type EditableActionAgent = Omit<ActionAgentDefinition, "id" | "name">;

export function ActionAgentEditor({ role, agent, composition, models, skills, disabled, onAgentChange, onCompositionChange }: {
  role: "validation" | "work";
  agent: EditableActionAgent;
  composition: ActionDefinition["validation"];
  models: ActionModelOption[];
  skills: ResourceDocument[];
  disabled: boolean;
  onAgentChange(value: EditableActionAgent): void;
  onCompositionChange(value: ActionDefinition["validation"]): void;
}) {
  const title = role === "validation" ? "Validation Agent" : "Work Agent";
  return <fieldset className="space-y-3 rounded-sm border p-3" disabled={disabled}>
    <legend className="font-semibold">{title}</legend>
    <ActionAgentControls role={role} model={agent.model} reasoningEffort={agent.reasoningEffort} models={models} disabled={disabled}
      onChange={({ model, reasoningEffort }) => onAgentChange({ ...agent, model, reasoningEffort })} />
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground">Developer instructions</span>
      <textarea aria-label={`${role} developer instructions`} value={agent.developerInstructions} disabled={disabled}
        onChange={(event) => onAgentChange({ ...agent, developerInstructions: event.target.value })}
        className="min-h-64 min-w-0 resize-y rounded-sm border bg-background p-3 font-mono text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        spellCheck={false} />
    </label>
    <SkillBadgePicker role={role} values={composition.skillResources} options={skills.map(({ id }) => id)} disabled={disabled}
      onValuesChange={(skillResources) => onCompositionChange({ ...composition, skillResources })} />
  </fieldset>;
}
