import { emptyEventStormingModel, eventStormingModelSchema, eventStormingSemanticHash, type EventStormingDocument, type EventStormingModelV2 } from "../../../shared/orchestration/eventStorming.js";
import { emptyEventStormingLayout, eventStormingLayoutSchema, type EventStormingLayoutDocument, type EventStormingLayoutV1 } from "../../../shared/orchestration/eventStormingLayout.js";
import { stormStoryLinks } from "../../../shared/orchestration/eventStormingContext.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";
import type { ProjectDocumentRepository } from "./ProjectDocumentRepository.js";
import { EventStormingRepository } from "./EventStormingRepository.js";
import { UserStoryService } from "./UserStoryService.js";

export class EventStormingService {
  readonly repository: EventStormingRepository;
  constructor(private readonly documents: ProjectDocumentRepository, private readonly assertUnlocked: () => void) {
    this.repository = new EventStormingRepository(documents.dataRoot);
  }
  read(): EventStormingDocument {
    const file = this.repository.read("model");
    const value = file ? parse("model", () => eventStormingModelSchema.parse(JSON.parse(file.content))) : emptyEventStormingModel();
    return { value, contentHash: file?.contentHash ?? "absent", semanticHash: eventStormingSemanticHash(value) };
  }
  readLayout(): EventStormingLayoutDocument {
    const file = this.repository.read("layout");
    return { value: file ? parse("layout", () => eventStormingLayoutSchema.parse(JSON.parse(file.content))) : emptyEventStormingLayout(), contentHash: file?.contentHash ?? "absent" };
  }
  save(input: EventStormingModelV2, expectedHash: string): EventStormingDocument {
    this.assertUnlocked();
    const current = this.read(); // Invalid files cannot be replaced through ordinary authoring.
    const value = eventStormingModelSchema.parse(input);
    const previous = new Set(storyReferences(current.value).map((r) => r.key));
    const stories = new UserStoryService(this.documents, () => {});
    for (const ref of storyReferences(value)) if (!previous.has(ref.key)) stories.require(ref.id);
    this.repository.put("model", value, expectedHash);
    return this.read();
  }
  saveLayout(value: EventStormingLayoutV1, expectedHash: string): EventStormingLayoutDocument {
    this.assertUnlocked(); this.readLayout();
    this.repository.put("layout", eventStormingLayoutSchema.parse(value), expectedHash);
    return this.readLayout();
  }
  storyReferences(id: string): string[] {
    return stormStoryLinks(this.read().value, id).map((p) => `${p.title || p.processId} (${p.processId})`);
  }
}
const parse = <T>(name: string, read: () => T): T => {
  try { return read(); }
  catch (error) { throw new ConflictError(`Invalid Event Storming ${name}.json: ${error instanceof Error ? error.message : "invalid JSON"}. Repair the repository file; it has not been overwritten.`); }
};

const storyReferences = (model: EventStormingModelV2) => model.processes.flatMap((p) => [
  ...p.storyIds.map((id) => ({ id, key: `${p.id}:${id}` })),
  ...p.steps.flatMap((s) => s.storyIds.map((id) => ({ id, key: `${p.id}:${s.id}:${id}` })))
]);
