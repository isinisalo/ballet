import type { UserStoryDocument } from "../../../shared/orchestration/userStories.js";
import { readdirSync } from "node:fs";
import path from "node:path";
import { stormContextQuerySchema, stormProcessStoryIds, stormStoryLinks, type StormContext, type StormContextQuery, type StormSourceEvidence } from "../../../shared/orchestration/eventStormingContext.js";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import { NotFoundError } from "../persistence/PersistenceErrors.js";
import { ProjectDocumentRepository } from "./ProjectDocumentRepository.js";
import { EventStormingService } from "./EventStormingService.js";
import { readProjectSource } from "./EventStormingRepository.js";
import { UserStoryService } from "./UserStoryService.js";

export class EventStormingContextService {
  constructor(private readonly root: string) {}
  read(input: StormContextQuery = {}): StormContext {
    const target = stormContextQuerySchema.parse(input);
    const documents = new ProjectDocumentRepository(path.join(this.root, ".ballet"));
    const document = new EventStormingService(documents, () => {}).read();
    const model = document.value;
    const stories = new UserStoryService(documents, () => {});
    const base = { version: 1 as const, semanticHash: document.semanticHash, modelHash: document.contentHash };
    if (!target.process && !target.story) {
      const collection = stories.list();
      const ids = [...new Set([...collection.stories.map((s) => s.value.id), ...collection.issues.map((s) => s.id), ...model.processes.flatMap(stormProcessStoryIds)])].sort();
      return { ...base, kind: "index", processes: [...model.processes].sort(byId).map((p) => ({ id: p.id, title: p.title, storyIds: stormProcessStoryIds(p), stepCount: p.steps.length })),
        stories: ids.map((id) => ({ id, status: collection.stories.find((s) => s.value.id === id)?.value.status,
          links: stormStoryLinks(model, id), issue: collection.issues.find((s) => s.id === id)?.message ?? (collection.stories.some((s) => s.value.id === id) ? undefined : "Story source is missing.") })) };
    }
    if (target.process && !model.processes.some((p) => p.id === target.process)) throw new NotFoundError(`Unknown Event Storming process ${target.process}.`);
    let requestedStory: UserStoryDocument | undefined;
    if (target.story) {
      try { requestedStory = stories.require(target.story); }
      catch (error) { if (!stormStoryLinks(model, target.story).length) throw error; }
    }
    const selected = new Set(target.process ? [target.process] : stormStoryLinks(model, target.story!).map((p) => p.processId));
    const processes = model.processes.filter((p) => selected.has(p.id)).sort(byId);
    const stepIds = new Set(processes.flatMap((p) => p.steps.map((s) => s.id)));
    const connections = model.processes.flatMap((p) => p.connections).filter((c) => stepIds.has(c.source) || stepIds.has(c.target));
    const externalIds = new Set(connections.flatMap((c) => [c.source, c.target]).filter((id) => !stepIds.has(id)));
    const externalSteps = model.processes.flatMap((p) => p.steps.filter((s) => externalIds.has(s.id)).map((s) => ({
      processId: p.id, processTitle: p.title, stepId: s.id, concept: model.concepts.find((c) => c.id === s.conceptId)!
    })));
    // Incoming external connections are retained alongside the selected process, with bounded endpoints.
    const projected = processes.map((p) => ({ ...p, connections: connections.filter((c) => p.steps.some((s) => s.id === c.source || s.id === c.target)).sort(byId) }));
    const sharedConceptIds = processes.length ? model.sharedConceptIds : [];
    const conceptIds = new Set([...sharedConceptIds, ...processes.flatMap((p) => p.steps.map((s) => s.conceptId))]);
    const concepts = model.concepts.filter((c) => conceptIds.has(c.id)).sort(byId);
    const issues: Array<{ id: string; message: string }> = [];
    const linkedStories = [...new Set([...processes.flatMap(stormProcessStoryIds), ...(target.story ? [target.story] : [])])].sort().flatMap((id) => {
      try { return [requestedStory?.value.id === id ? requestedStory : stories.require(id)]; }
      catch (error) { issues.push({ id, message: error instanceof Error ? error.message : String(error) }); return []; }
    });
    const sourceRefs = new Set([...concepts.flatMap((c) => c.sources), ...externalSteps.flatMap((s) => s.concept.sources),
      ...processes.flatMap((p) => [...p.sources, ...p.steps.flatMap((s) => s.sources), ...p.boundaries.flatMap((b) => b.sources)]),
      ...linkedStories.flatMap((s) => [`.ballet/user-stories/${s.value.id}.md`, ...s.value.adrIds.map((id) => {
        try { const filename = readdirSync(path.join(this.root, ".ballet/adr")).find((name) => name === `${id}.md` || name.startsWith(`${id}-`)); return `.ballet/adr/${filename ?? `${id}.md`}`; }
        catch { return `.ballet/adr/${id}.md`; }
      })])]);
    const sources = [...sourceRefs].sort().map((source) => this.source(source));
    return { ...base, kind: "detail", target, processes: projected, concepts, sharedConceptIds, externalSteps, stories: linkedStories, sources, issues };
  }
  private source(source: string): StormSourceEvidence {
    if (/^https?:/.test(source)) return { source, status: "not-read" };
    try {
      const content = readProjectSource(this.root, source);
      return content === undefined ? { source, status: "missing" } : { source, status: "read", contentHash: sha256(content) };
    } catch (error) { return { source, status: "unavailable", message: error instanceof Error ? error.message : String(error) }; }
  }
}
const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
