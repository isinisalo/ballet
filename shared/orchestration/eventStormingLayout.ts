import { z } from "zod";
import { eventStormingId, expectedStormHash } from "./eventStorming.js";

const coordinate = z.number().finite().min(-100_000).max(100_000);
const dimension = z.number().finite().min(40).max(20_000);
const shape = { x: coordinate, y: coordinate, width: dimension, height: dimension };
export const stormPlacementSchema = z.object({
  id: eventStormingId, stepId: eventStormingId.optional(), conceptId: eventStormingId.optional(),
  ...shape, pivotal: z.boolean(), frameId: eventStormingId.optional()
}).strict().refine((p) => Boolean(p.stepId) !== Boolean(p.conceptId), "Placement needs exactly one semantic target.");
export const stormFrameSchema = z.object({
  id: eventStormingId, title: z.string().max(500), kind: z.enum(["process", "bounded-context"]), processId: eventStormingId.optional(), ...shape
}).strict();
export const stormViewSchema = z.object({
  id: eventStormingId, title: z.string().max(500), description: z.string().max(20_000),
  kind: z.enum(["overview", "process", "responsibilities"]), processId: eventStormingId.optional(),
  placements: z.array(stormPlacementSchema).max(2000), frames: z.array(stormFrameSchema).max(100),
  connections: z.array(z.object({ id: eventStormingId, connectionId: eventStormingId, source: eventStormingId, target: eventStormingId }).strict()).max(4000)
}).strict();
export const eventStormingLayoutSchema = z.object({ version: z.literal(1), views: z.array(stormViewSchema).max(64) }).strict().superRefine((layout, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (new Set(layout.views.map((v) => v.id)).size !== layout.views.length) issue("Duplicate view ID.");
  for (const view of layout.views) {
    const all = [...view.placements, ...view.connections, ...view.frames].map((v) => v.id);
    if (new Set(all).size !== all.length) issue("Duplicate view item ID.");
    const placements = new Set(view.placements.map((p) => p.id));
    const frames = new Set(view.frames.map((f) => f.id));
    for (const p of view.placements) if (p.frameId && !frames.has(p.frameId)) issue("Missing layout frame.");
    for (const c of view.connections) if (!placements.has(c.source) || !placements.has(c.target)) issue("Missing layout endpoint.");
    if ((view.kind === "overview") === Boolean(view.processId)) issue("Only process views have a process ID.");
  }
});
export type StormPlacement = z.infer<typeof stormPlacementSchema>;
export type StormFrame = z.infer<typeof stormFrameSchema>;
export type StormView = z.infer<typeof stormViewSchema>;
export type EventStormingLayoutV1 = z.infer<typeof eventStormingLayoutSchema>;
export interface EventStormingLayoutDocument { value: EventStormingLayoutV1; contentHash: string | "absent" }
export const emptyEventStormingLayout = (): EventStormingLayoutV1 => ({ version: 1, views: [] });
export const putEventStormingLayoutSchema = z.object({ value: eventStormingLayoutSchema, expectedHash: expectedStormHash }).strict();
