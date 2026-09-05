import { parseDocument, stringify } from "yaml";
import { USER_STORY_LIMITS, userStorySchema, type UserStoryV1 } from "../../../shared/orchestration/userStories.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";

export function parseUserStoryMarkdown(content: string, id: string): { value: UserStoryV1; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new ConflictError(`User Story ${id} requires YAML frontmatter.`);
  try {
    const document = parseDocument(match[1], { prettyErrors: false });
    if (document.errors.length) throw document.errors[0];
    const value = userStorySchema.parse(document.toJS({ maxAliasCount: 0 }));
    if (value.id !== id) throw new Error("Frontmatter ID must match the filename.");
    return { value, body: content.slice(match[0].length) };
  } catch (error) {
    throw new ConflictError(`Invalid User Story ${id}: ${error instanceof Error ? error.message : "invalid frontmatter"}`);
  }
}

export function serializeUserStoryMarkdown(value: UserStoryV1, body = "\n"): string {
  const source = `---\n${stringify(userStorySchema.parse(value), { lineWidth: 0 })}---\n${body}`;
  if (Buffer.byteLength(source, "utf8") > USER_STORY_LIMITS.documentBytes) throw new ConflictError("User Story exceeds the document size limit.");
  return source;
}
