import { z } from "zod";
import { sha256Schema } from "./schemas/common.js";
import { canonicalJson, sha256, type JsonValue } from "./primitives.js";

export const EVENT_STORMING_LIMITS = { documentBytes: 786_432, notes: 2000, processes: 64, placements: 2000, connections: 4000, frames: 100 } as const;
export const eventStormingId = z.string().uuid();
export const stormNoteKindSchema = z.enum(["event", "command", "actor", "policy", "system", "read-model", "aggregate", "hotspot", "opportunity", "value", "definition", "note"]);
const text = z.string().max(20_000);
const title = z.string().max(500);
const ids = z.array(eventStormingId).max(2000).refine((v) => new Set(v).size === v.length, "Duplicate reference.");
export const stormSourceSchema = z.string().max(2048).refine((value) => /^(https?:\/\/|\.ballet\/)/.test(value)
  && !value.split(/[\\/#?]/).includes("..") && ![...value].some((char) => char.charCodeAt(0) <= 32 || char === "\\"), "Use an https/http URL or a .ballet/ relative document path.");
const sources = z.array(stormSourceSchema).max(50);
export const stormConceptSchema = z.object({ id: eventStormingId, kind: stormNoteKindSchema, title, details: text, sources }).strict();
export const stormStepSchema = z.object({ id: eventStormingId, conceptId: eventStormingId, storyIds: ids, sources }).strict();
export const stormConnectionSchema = z.object({
  id: eventStormingId, source: eventStormingId, target: eventStormingId,
  kind: z.enum(["flow", "support", "responsibility"]), label: title, condition: text
}).strict();
export const stormBoundarySchema = z.object({
  id: eventStormingId, title, details: text, kind: z.enum(["responsibility", "bounded-context"]), stepIds: ids, sources
}).strict();
export const stormProcessSchema = z.object({
  id: eventStormingId, title, description: text, storyIds: ids, sources,
  steps: z.array(stormStepSchema).max(2000), connections: z.array(stormConnectionSchema).max(4000),
  boundaries: z.array(stormBoundarySchema).max(100)
}).strict();
export const eventStormingModelSchema = z.object({
  version: z.literal(2), description: text, documentation: z.string().max(200_000),
  concepts: z.array(stormConceptSchema).max(2000), processes: z.array(stormProcessSchema).max(64), sharedConceptIds: ids
}).strict().superRefine((model, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  const allIds = [...model.concepts, ...model.processes, ...model.processes.flatMap((p) => [...p.steps, ...p.connections, ...p.boundaries])].map((v) => v.id);
  if (new Set(allIds).size !== allIds.length) issue("Duplicate semantic ID.");
  const concepts = new Set(model.concepts.map((v) => v.id));
  for (const id of model.sharedConceptIds) if (!concepts.has(id)) issue("Shared context refers to a missing concept.");
  const steps = new Set(model.processes.flatMap((p) => p.steps.map((s) => s.id)));
  for (const process of model.processes) {
    for (const step of process.steps) if (!concepts.has(step.conceptId)) issue("Step refers to a missing concept.");
    const owned = new Set(process.steps.map((s) => s.id));
    for (const edge of process.connections) {
      if (!steps.has(edge.source) || !steps.has(edge.target)) issue("Connection refers to a missing step.");
      if (!owned.has(edge.source)) issue("Connection must belong to its source process.");
    }
    for (const boundary of process.boundaries) if (boundary.stepIds.some((id) => !owned.has(id))) issue("Boundary refers to a missing process step.");
  }
});
export type StormNoteKind = z.infer<typeof stormNoteKindSchema>;
export type StormConcept = z.infer<typeof stormConceptSchema>;
export type StormStep = z.infer<typeof stormStepSchema>;
export type StormConnection = z.infer<typeof stormConnectionSchema>;
export type StormProcess = z.infer<typeof stormProcessSchema>;
export type EventStormingModelV2 = z.infer<typeof eventStormingModelSchema>;
export interface EventStormingDocument { value: EventStormingModelV2; contentHash: string | "absent"; semanticHash: string }
export const expectedStormHash = z.union([sha256Schema, z.literal("absent")]);
export const putEventStormingSchema = z.object({ value: eventStormingModelSchema, expectedHash: expectedStormHash }).strict();
export const emptyEventStormingModel = (): EventStormingModelV2 => ({ version: 2, description: "", documentation: "", concepts: [], processes: [], sharedConceptIds: [] });

/** Model arrays are sets; story criteria are never stored here. */
export function normalizeStormJson(value: unknown): JsonValue {
  if (Array.isArray(value)) return value.map(normalizeStormJson).sort((a, b) => {
    const key = (v: JsonValue) => v && typeof v === "object" && !Array.isArray(v) && typeof v.id === "string" ? v.id : canonicalJson(v);
    return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  });
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, normalizeStormJson(v)]));
  return value as JsonValue;
}
export const serializeStormJson = (value: unknown): string => `${JSON.stringify(normalizeStormJson(value), null, 2)}\n`;
export const eventStormingSemanticHash = (model: EventStormingModelV2): string => sha256(canonicalJson(normalizeStormJson(eventStormingModelSchema.parse(model))));
