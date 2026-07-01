import type { Agent } from "../../../../shared/domain";

export const codexModelOptions = [
  { value: "gpt-5.5", label: "GPT-5.5" },
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { value: "gpt-5.3-codex-spark", label: "GPT-5.3 Codex Spark" }
];

export const reasoningEffortOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra High" }
];

const reasoningEffortOrder = reasoningEffortOptions.map((option) => option.value);

export const reasoningEffortTone = (value: string) => {
  if (value === "low") return "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15";
  if (value === "medium") return "border-tertiary/30 bg-tertiary/10 text-tertiary hover:bg-tertiary/15";
  if (value === "high") return "border-tertiary-container/40 bg-tertiary-container/20 text-tertiary hover:bg-tertiary-container/25";
  return "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15";
};

export const nextReasoningEffort = (value: string) => {
  const currentIndex = reasoningEffortOrder.indexOf(value);
  return reasoningEffortOrder[(currentIndex + 1) % reasoningEffortOrder.length] ?? reasoningEffortOptions[0].value;
};

export const agentTemplate = (): Partial<Agent> => ({
  name: "",
  description: "",
  instructions: "",
  skills: [],
  enabled: true,
  status: "offline",
  model: codexModelOptions[0]?.value ?? "gpt-5.5",
  modelReasoningEffort: "medium"
});
