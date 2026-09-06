import type { TrustedHumanActor } from "../../../shared/orchestration/persistence.js";
import { userStoryApprovalHash, invalidateStoryApproval } from "./userStoryApproval.js";
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
        const value = parseUserStoryMarkdown(document.content, document.id);
        result.stories.push({ value, contentHash: document.contentHash, semanticHash: userStoryApprovalHash(value) });
      } catch (error) {
        result.issues.push({ id: document.id, message: error instanceof Error ? error.message : "Invalid User Story file." });
      }
    }
    return result;
  }

  require(id: string): UserStoryDocument {
    const document = this.documents.require("user-story", id);
    const value = parseUserStoryMarkdown(document.content, id);
    return { value, contentHash: document.contentHash, semanticHash: userStoryApprovalHash(value) };
  }

  create(input: UserStoryInput): UserStoryDocument {
    this.assertUnlocked();
    const value = { ...userStoryInputSchema.parse(input), version: 2 as const, id: randomUUID(), status: "draft" as const, approvalRevision: 0 };
    this.assertReferences(value.adrIds);
    if (this.documents.list("user-story").length >= USER_STORY_LIMITS.stories) throw new ConflictError(`At most ${USER_STORY_LIMITS.stories} User Stories can be stored.`);
    const saved = this.documents.put("user-story", value.id, serializeUserStoryMarkdown(value), "absent");
    return { value, contentHash: saved.contentHash, semanticHash: userStoryApprovalHash(value) };
  }

  update(id: string, input: UserStoryInput, expectedHash: string): UserStoryDocument {
    this.assertUnlocked();
    const current = this.documents.require("user-story", id);
    const previous = parseUserStoryMarkdown(current.content, id);
    const value = invalidateStoryApproval({ ...previous, ...userStoryInputSchema.parse(input) });
    this.assertReferences(value.adrIds);
    const saved = this.documents.put("user-story", id, serializeUserStoryMarkdown(value), expectedHash);
    return { value, contentHash: saved.contentHash, semanticHash: userStoryApprovalHash(value) };
  }

  approve(id: string, expectedHash: string, expectedContentHash: string, actor: TrustedHumanActor, at: string): UserStoryDocument {
    this.assertUnlocked();
    if (!["request_context", "local_operator"].includes(actor.source) || !actor.id.trim()) throw new ConflictError("Story approval requires a trusted human actor.");
    const current = this.require(id);
    if (current.contentHash !== expectedHash) throw new ConflictError("User Story optimistic hash is stale.");
    if (current.semanticHash !== expectedContentHash) throw new ConflictError("User Story approval content is stale.");
    if (current.value.status === "approved") throw new ConflictError("User Story is already approved.");
    this.assertReferences(current.value.adrIds);
    const revision = current.value.approvalRevision + 1;
    const value = { ...current.value, status: "approved" as const, approvalRevision: revision,
      approval: { approvedBy: actor.id, approvedAt: at, revision, contentHash: current.semanticHash } };
    this.documents.put("user-story", id, serializeUserStoryMarkdown(value), expectedHash);
    return this.require(id);
  }

  returnToDraft(id: string, expectedHash: string): UserStoryDocument {
    this.assertUnlocked();
    const current = this.require(id);
    if (current.contentHash !== expectedHash) throw new ConflictError("User Story optimistic hash is stale.");
    const { approval, ...value } = current.value; void approval;
    this.documents.put("user-story", id, serializeUserStoryMarkdown({ ...value, status: "draft" }), expectedHash);
    return this.require(id);
  }

  private assertReferences(ids: string[]): void {
    for (const id of ids) this.documents.require("adr", id);
  }

  remove(id: string, expectedHash: string): void {
    this.assertUnlocked();
    this.documents.remove("user-story", id, expectedHash, []);
  }
}
