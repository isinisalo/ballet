import { z } from "zod";
import { sha256Schema } from "./schemas/common.js";

export const EVENT_STORMING_LIMITS = { documentBytes: 786_432, notes: 2000, boards: 64, placements: 2000, connections: 4000, frames: 100 } as const;
export const eventStormingId = z.string().uuid();
export const stormLevelSchema = z.enum(["big-picture", "process-modelling", "software-design"]);
export const stormNoteKindSchema = z.enum(["event", "command", "actor", "policy", "system", "read-model", "aggregate", "hotspot", "opportunity", "value", "definition", "note"]);
const text = z.string().max(20_000);
const title = z.string().max(500);
const coordinate = z.number().finite().min(-100_000).max(100_000);
const dimension = z.number().finite().min(40).max(20_000);
const source = z.string().max(2048).refine((value) => /^(https?:\/\/|\.ballet\/)/.test(value)
  && !value.split(/[\\/#?]/).includes("..") && ![...value].some((char) => char.charCodeAt(0) <= 32 || char === "\\"), "Use an https/http URL or a .ballet/ relative document path.");
export const stormNoteSchema = z.object({
  id: eventStormingId, kind: stormNoteKindSchema, title, details: text, sources: z.array(source).max(50)
}).strict();
export const stormPlacementSchema = z.object({
  id: eventStormingId, noteId: eventStormingId, x: coordinate, y: coordinate, width: dimension, height: dimension,
  frameId: eventStormingId.optional(), pivotal: z.boolean()
}).strict();
export const stormConnectionSchema = z.object({ id: eventStormingId, source: eventStormingId, target: eventStormingId, label: title }).strict();
export const stormFrameSchema = z.object({
  id: eventStormingId, title, kind: z.enum(["process", "bounded-context"]), x: coordinate, y: coordinate, width: dimension, height: dimension
}).strict();
export const stormBoardSchema = z.object({
  id: eventStormingId, title, level: stormLevelSchema, description: text, sourceBoardId: eventStormingId.optional(),
  placements: z.array(stormPlacementSchema).max(EVENT_STORMING_LIMITS.placements),
  connections: z.array(stormConnectionSchema).max(EVENT_STORMING_LIMITS.connections),
  frames: z.array(stormFrameSchema).max(EVENT_STORMING_LIMITS.frames)
}).strict();
export const eventStormingModelSchema = z.object({
  version: z.literal(1), notes: z.array(stormNoteSchema).max(EVENT_STORMING_LIMITS.notes), boards: z.array(stormBoardSchema).max(EVENT_STORMING_LIMITS.boards)
}).strict().superRefine((model, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  const unique = (items: Array<{ id: string }>, label: string) => {
    if (new Set(items.map(({ id }) => id)).size !== items.length) issue(`Duplicate ${label} ID.`);
  };
  unique(model.notes, "note"); unique(model.boards, "board");
  const notes = new Set(model.notes.map(({ id }) => id));
  for (const board of model.boards) {
    unique([...board.placements, ...board.frames, ...board.connections], "board item");
    const placements = new Set(board.placements.map(({ id }) => id));
    const frames = new Set(board.frames.map(({ id }) => id));
    if (board.sourceBoardId) {
      const parent = model.boards.find(({ id }) => id === board.sourceBoardId);
      if (!parent || stormLevelSchema.options.indexOf(parent.level) >= stormLevelSchema.options.indexOf(board.level)) issue("Source board must exist at an earlier level.");
    }
    for (const placement of board.placements) {
      if (!notes.has(placement.noteId)) issue("Placement refers to a missing note.");
      if (placement.frameId && !frames.has(placement.frameId)) issue("Placement refers to a missing frame.");
    }
    for (const connection of board.connections) {
      if (!placements.has(connection.source) || !placements.has(connection.target)) issue("Connection refers to a missing placement.");
    }
  }
});
export type StormLevel = z.infer<typeof stormLevelSchema>;
export type StormNoteKind = z.infer<typeof stormNoteKindSchema>;
export type StormNote = z.infer<typeof stormNoteSchema>;
export type StormBoard = z.infer<typeof stormBoardSchema>;
export type StormPlacement = z.infer<typeof stormPlacementSchema>;
export type StormFrame = z.infer<typeof stormFrameSchema>;
export type EventStormingModelV1 = z.infer<typeof eventStormingModelSchema>;
export interface EventStormingDocument { value: EventStormingModelV1; contentHash: string | "absent"; body: string }
export const putEventStormingSchema = z.object({ value: eventStormingModelSchema, expectedHash: z.union([sha256Schema, z.literal("absent")]) }).strict();
export const emptyEventStormingModel = (): EventStormingModelV1 => ({ version: 1, notes: [], boards: [] });
