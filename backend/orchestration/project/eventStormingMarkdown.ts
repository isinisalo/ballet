import { parseDocument, stringify } from "yaml";
import { EVENT_STORMING_LIMITS, eventStormingModelSchema, type EventStormingModelV1 } from "../../../shared/orchestration/eventStorming.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";

export function parseEventStormingMarkdown(content: string): { value: EventStormingModelV1; body: string } {
  if (Buffer.byteLength(content) > EVENT_STORMING_LIMITS.documentBytes) throw new ConflictError("Event Storming document exceeds the size limit.");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new ConflictError("Event Storming model requires YAML frontmatter.");
  try {
    const document = parseDocument(match[1], { prettyErrors: false });
    if (document.errors.length) throw document.errors[0];
    return { value: eventStormingModelSchema.parse(document.toJS({ maxAliasCount: 0 })), body: content.slice(match[0].length) };
  } catch (error) { throw new ConflictError(`Invalid Event Storming model: ${error instanceof Error ? error.message : "invalid YAML"}`); }
}
export function serializeEventStormingMarkdown(input: EventStormingModelV1, body = "\n"): string {
  const value = eventStormingModelSchema.parse(input);
  const sorted = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
  const canonical = { ...value, notes: sorted(value.notes), boards: sorted(value.boards).map((board) => ({
    ...board, placements: sorted(board.placements), connections: sorted(board.connections), frames: sorted(board.frames)
  })) };
  const source = `---\n${stringify(canonical, { lineWidth: 0 })}---\n${body}`;
  if (Buffer.byteLength(source) > EVENT_STORMING_LIMITS.documentBytes) throw new ConflictError("Event Storming document exceeds the size limit.");
  return source;
}
