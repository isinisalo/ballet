import { parseDocument, stringify } from "yaml";
import { USER_STORY_LIMITS, userStorySchema, type UserStoryV2 } from "../../../shared/orchestration/userStories.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";
import { invalidateStoryApproval } from "./userStoryApproval.js";

export function parseUserStoryMarkdown(content: string, id: string): UserStoryV2 {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new ConflictError(`User Story ${id} requires YAML frontmatter.`);
  try {
    const document = parseDocument(match[1], { prettyErrors: false });
    if (document.errors.length) throw document.errors[0];
    const metadata: unknown = document.toJS({ maxAliasCount: 0 });
    if (!metadata || typeof metadata !== "object" || "details" in metadata) throw new Error("Details belong only in the Markdown body.");
    const value = userStorySchema.parse({ ...metadata, details: content.slice(match[0].length) });
    if (value.id !== id) throw new Error("Frontmatter ID must match the filename.");
    return invalidateStoryApproval(value);
  } catch (error) {
    throw new ConflictError(`Invalid User Story ${id}: ${error instanceof Error ? error.message : "invalid frontmatter"}`);
  }
}

export function serializeUserStoryMarkdown(value: UserStoryV2): string {
  const { details, ...metadata } = userStorySchema.parse(value);
  const source = `---\n${stringify(metadata, { lineWidth: 0 })}---\n${details}`;
  if (Buffer.byteLength(source, "utf8") > USER_STORY_LIMITS.documentBytes) throw new ConflictError("User Story exceeds the document size limit.");
  return source;
}
