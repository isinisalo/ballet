import { emptyEventStormingModel, type EventStormingDocument, type EventStormingModelV1 } from "../../../shared/orchestration/eventStorming.js";
import { NotFoundError } from "../persistence/PersistenceErrors.js";
import { ProjectDocumentRepository } from "./ProjectDocumentRepository.js";
import { parseEventStormingMarkdown, serializeEventStormingMarkdown } from "./eventStormingMarkdown.js";

export class EventStormingService {
  constructor(private readonly documents: ProjectDocumentRepository, private readonly assertUnlocked: () => void) {}
  read(): EventStormingDocument {
    try {
      const document = this.documents.require("event-storming", "model");
      return { ...parseEventStormingMarkdown(document.content), contentHash: document.contentHash };
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
      return { value: emptyEventStormingModel(), contentHash: "absent", body: "\n" };
    }
  }
  save(value: EventStormingModelV1, expectedHash: string): EventStormingDocument {
    this.assertUnlocked();
    const current = this.read(); // Invalid source files are never overwritten, even with their current hash.
    const saved = this.documents.put("event-storming", "model", serializeEventStormingMarkdown(value, current.body), expectedHash);
    return { ...parseEventStormingMarkdown(saved.content), contentHash: saved.contentHash };
  }
}
