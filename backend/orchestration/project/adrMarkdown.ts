import { parseDocument } from "yaml";
import { ConflictError } from "../persistence/PersistenceErrors.js";

export function validateAdrMarkdown(content: string, id: string): void {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new ConflictError("ADR requires YAML frontmatter.");
  const document = parseDocument(match[1], { prettyErrors: false });
  if (document.errors.length) throw new ConflictError("ADR frontmatter is invalid.");
  const value: unknown = document.toJS({ maxAliasCount: 0 });
  if (!value || typeof value !== "object" || Reflect.get(value, "id") !== id
    || typeof Reflect.get(value, "title") !== "string" || !Reflect.get(value, "title").trim()) {
    throw new ConflictError("ADR requires a title and an ID matching the file.");
  }
}
