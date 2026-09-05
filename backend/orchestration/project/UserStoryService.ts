import { randomUUID } from "node:crypto";
import { USER_STORY_LIMITS, userStoryInputSchema, type UserStoryCollection, type UserStoryDocument, type UserStoryInput } from "../../../shared/orchestration/userStories.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";
import { ProjectDocumentRepository } from "./ProjectDocumentRepository.js";
import { parseUserStoryMarkdown, serializeUserStoryMarkdown } from "./userStoryMarkdown.js";

/** User Story content exists only in repository-owned Markdown, never in config or SQLite. */
export class UserStoryService {
  constructor(private readonly documents: ProjectDocumentRepository, private readonly assertUnlocked: () => void) {}

  list(): UserStoryCollection {
    const result: UserStoryCollection = { stories: [], issues: [] };
    for (const document of this.documents.list("user-story")) {
      try {
        const { value } = parseUserStoryMarkdown(document.content, document.id);
        result.stories.push({ value, contentHash: document.contentHash });
      } catch (error) {
        result.issues.push({ id: document.id, message: error instanceof Error ? error.message : "Invalid User Story file." });
      }
    }
    return result;
  }

  require(id: string): UserStoryDocument {
    const document = this.documents.require("user-story", id);
    return { value: parseUserStoryMarkdown(document.content, id).value, contentHash: document.contentHash };
  }

  create(input: UserStoryInput): UserStoryDocument {
    this.assertUnlocked();
    const value = { ...userStoryInputSchema.parse(input), version: 1 as const, id: randomUUID() };
    if (this.documents.list("user-story").length >= USER_STORY_LIMITS.stories) throw new ConflictError(`At most ${USER_STORY_LIMITS.stories} User Stories can be stored.`);
    const saved = this.documents.put("user-story", value.id, serializeUserStoryMarkdown(value), "absent");
    return { value, contentHash: saved.contentHash };
  }

  update(id: string, input: UserStoryInput, expectedHash: string): UserStoryDocument {
    this.assertUnlocked();
    const current = this.documents.require("user-story", id);
    const { body } = parseUserStoryMarkdown(current.content, id);
    const value = { ...userStoryInputSchema.parse(input), version: 1 as const, id };
    const saved = this.documents.put("user-story", id, serializeUserStoryMarkdown(value, body), expectedHash);
    return { value, contentHash: saved.contentHash };
  }

  remove(id: string, expectedHash: string): void {
    this.assertUnlocked();
    this.documents.remove("user-story", id, expectedHash, []);
  }
}
