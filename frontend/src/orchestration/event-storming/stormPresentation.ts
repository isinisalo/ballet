import type { StormNoteKind } from "@shared/orchestration/eventStorming";

export const STORM_PATH = "/project/event-storming";
export const stormPath = (process?: string, step?: string, view?: string, story?: string) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ process, step, view, story })) if (value) query.set(key, value);
  return `${STORM_PATH}${query.size ? `?${query}` : ""}`;
};
export const NOTE_KINDS: Record<StormNoteKind, { label: string; icon: string; hint: string }> = {
  event: { label: "Event", icon: "◆", hint: "Something happened…" },
  command: { label: "Command", icon: "→", hint: "Do something…" },
  actor: { label: "Actor", icon: "♙", hint: "Who?" },
  policy: { label: "Policy", icon: "↪", hint: "Whenever… then…" },
  system: { label: "External System", icon: "▣", hint: "System name…" },
  "read-model": { label: "Read Model", icon: "≡", hint: "Information needed…" },
  aggregate: { label: "Aggregate", icon: "⬡", hint: "Owns the decision…" },
  hotspot: { label: "Open question", icon: "?", hint: "An open question…" },
  opportunity: { label: "Opportunity", icon: "+", hint: "What could improve?" },
  value: { label: "Value", icon: "↗", hint: "Value created or lost…" },
  definition: { label: "Definition", icon: "≔", hint: "What does it mean?" },
  note: { label: "Note", icon: "·", hint: "A workshop note…" }
};
export const BASIC_KINDS: StormNoteKind[] = ["event", "command", "actor", "read-model", "policy", "system", "hotspot"];
export const ADVANCED_KINDS: StormNoteKind[] = ["aggregate", "opportunity", "value", "definition", "note"];
export const noteSize = (kind: StormNoteKind) => kind === "actor" ? { width: 136, height: 112 } : kind === "system" ? { width: 224, height: 144 } : { width: 184, height: 168 };
