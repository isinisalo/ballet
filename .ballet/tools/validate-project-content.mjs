import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseAdr } from "../../shared/orchestration/adr.ts";
import { parseEventStormingMarkdown } from "../../backend/orchestration/project/eventStormingMarkdown.ts";

/** Ballet's own content coverage; the generic platform still permits an empty workshop. */
export function validateProjectContent(root) {
  const issues = []; const ids = new Set();
  for (const file of readdirSync(path.join(root, ".ballet/adr")).filter((file) => file.endsWith(".md"))) {
    try {
      const expected = file.match(/^(adr-\d{3,})(?:-|\.md$)/)?.[1];
      if (!expected) throw new Error("ADR filename requires its numeric ID.");
      const record = parseAdr(readFileSync(path.join(root, ".ballet/adr", file), "utf8"), expected);
      if (ids.has(record.id)) issues.push(`Duplicate ADR ${record.id}.`);
      ids.add(record.id);
    } catch (error) { issues.push(`${file}: ${error.message}`); }
  }
  const filename = path.join(root, ".ballet/event-storming/model.md");
  if (!existsSync(filename)) return [...issues, "Ballet Event Storming model is missing."];
  try {
    const { value } = parseEventStormingMarkdown(readFileSync(filename, "utf8"));
    for (const [level, count] of [["big-picture", 1], ["process-modelling", 6], ["software-design", 6]]) {
      if (value.boards.filter((board) => board.level === level).length < count) issues.push(`Ballet requires at least ${count} ${level} boards.`);
    }
    issues.push(...validateStormContent(root, value));
  } catch (error) { issues.push(`Event Storming: ${error.message}`); }
  return issues;
}

function validateStormContent(root, value) {
  const issues = [];
    for (const board of value.boards) {
      if (!board.placements.length || !board.connections.length) issues.push(`Empty Event Storming board ${board.title}.`);
      if (board.level !== "big-picture" && !board.sourceBoardId) issues.push(`Missing source board for ${board.title}.`);
    }
    for (const note of value.notes) {
      if (!note.title.trim() || !note.details.trim() || !note.sources.length) issues.push(`Unsourced or empty Event Storming note ${note.id}.`);
      for (const source of note.sources.filter((source) => source.startsWith(".ballet/"))) {
        if (!existsSync(path.join(root, source.split("#")[0]))) issues.push(`Missing Event Storming source ${source}.`);
      }
      if (!value.boards.some((board) => board.placements.some((placement) => placement.noteId === note.id))) issues.push(`Unplaced note ${note.id}.`);
    }
  return issues;
}
