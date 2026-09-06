import { z } from "zod";
import { eventStormingId, type EventStormingModelV2, type StormConcept, type StormProcess } from "./eventStorming.js";
import type { UserStoryDocument } from "./userStories.js";

export const stormContextQuerySchema = z.object({ process: eventStormingId.optional(), story: eventStormingId.optional() }).strict()
  .refine((q) => !(q.process && q.story), "Choose either process or story.");
export type StormContextQuery = z.infer<typeof stormContextQuerySchema>;
export interface StoryProcessLink { processId: string; title: string; stepIds: string[]; direct: boolean }
export function stormStoryLinks(model: EventStormingModelV2, storyId: string): StoryProcessLink[] {
  return model.processes.flatMap((p) => {
    const stepIds = p.steps.filter((s) => s.storyIds.includes(storyId)).map((s) => s.id).sort();
    return p.storyIds.includes(storyId) || stepIds.length ? [{ processId: p.id, title: p.title, stepIds, direct: p.storyIds.includes(storyId) }] : [];
  }).sort((a, b) => a.processId.localeCompare(b.processId));
}
export const stormProcessStoryIds = (p: StormProcess): string[] => [...new Set([...p.storyIds, ...p.steps.flatMap((s) => s.storyIds)])].sort();
export interface StormSourceEvidence { source: string; contentHash?: string; status: "read" | "missing" | "unavailable" | "not-read"; message?: string }
export interface StormContextIndex {
  kind: "index"; version: 1; semanticHash: string; modelHash: string;
  processes: Array<{ id: string; title: string; storyIds: string[]; stepCount: number }>;
  stories: Array<{ id: string; status?: "draft" | "approved"; links: StoryProcessLink[]; issue?: string }>;
}
export interface StormContextDetail {
  kind: "detail"; version: 1; semanticHash: string; modelHash: string; target: StormContextQuery;
  processes: StormProcess[]; concepts: StormConcept[]; sharedConceptIds: string[];
  externalSteps: Array<{ processId: string; processTitle: string; stepId: string; concept: StormConcept }>;
  stories: UserStoryDocument[]; sources: StormSourceEvidence[]; issues: Array<{ id: string; message: string }>;
}
export type StormContext = StormContextIndex | StormContextDetail;
