import type { StormLevel, StormNoteKind } from "@shared/orchestration/eventStorming";

export const STORM_PATH = "/project/event-storming";
export const stormPath = (boardId?: string, itemId?: string) => `${STORM_PATH}${boardId ? `?id=${boardId}${itemId ? `&item=${itemId}` : ""}` : ""}`;
export const LEVELS: Record<StormLevel, { label: string; hint: string }> = {
  "big-picture": { label: "Big Picture", hint: "What happened? Discover the story, one event at a time." },
  "process-modelling": { label: "Process Modelling", hint: "Who acts, what happens, and what happens next?" },
  "software-design": { label: "Software Design", hint: "Explore ownership, invariants and boundaries." }
};
export const NOTE_KINDS: Record<StormNoteKind, { label: string; icon: string; hint: string }> = {
  event: { label: "Domain Event", icon: "◆", hint: "Something happened…" },
  command: { label: "Command", icon: "→", hint: "Do something…" },
  actor: { label: "Actor", icon: "♙", hint: "Who?" },
  policy: { label: "Policy", icon: "↪", hint: "Whenever… then…" },
  system: { label: "External System", icon: "▣", hint: "System name…" },
  "read-model": { label: "Read Model", icon: "≡", hint: "Information needed…" },
  aggregate: { label: "Aggregate", icon: "⬡", hint: "Owns the decision…" },
  hotspot: { label: "Hotspot", icon: "?", hint: "An open question…" },
  opportunity: { label: "Opportunity", icon: "+", hint: "What could improve?" },
  value: { label: "Value", icon: "↗", hint: "Value created or lost…" },
  definition: { label: "Definition", icon: "≔", hint: "What does it mean?" },
  note: { label: "Note", icon: "·", hint: "A workshop note…" }
};
export function palette(level: StormLevel): StormNoteKind[] {
  const basic: StormNoteKind[] = ["event", "actor", "system", "hotspot", "opportunity", "value", "definition", "note"];
  return level === "big-picture" ? basic : ["event", "command", "actor", "policy", "read-model", ...(level === "software-design" ? ["aggregate" as const] : []), "system", "hotspot", "note"];
}
export const noteSize = (kind: StormNoteKind) => kind === "actor" ? { width: 136, height: 112 } : kind === "system" ? { width: 224, height: 144 } : { width: 184, height: 168 };
