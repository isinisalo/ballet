import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { validateProjectContent } from "../tools/validate-project-content.mjs";
import { parseEventStormingMarkdown } from "../../backend/orchestration/project/eventStormingMarkdown.js";

const root = path.resolve(import.meta.dirname, "../..");
it("keeps valid current ADRs and a sourced three-level Ballet domain model", () => {
  expect(validateProjectContent(root)).toEqual([]);
  const { value } = parseEventStormingMarkdown(readFileSync(path.join(root, ".ballet/event-storming/model.md"), "utf8"));
  const titles = value.notes.map((note) => note.title).join("\n");
  for (const title of ["Action ja Feedback estyivät atomisesti", "Run peruutettiin", "Tehtävä päättyi runtime_lost-virheeseen", "Refinement-apply estettiin", "Tarinan hyväksyntä mitätöityi"]) expect(titles).toContain(title);
  for (const board of value.boards.filter((board) => board.level === "software-design")) {
    const source = value.boards.find((other) => other.id === board.sourceBoardId)!;
    expect(source.level).toBe("process-modelling");
    expect(board.placements.some((placement) => source.placements.some((other) => other.noteId === placement.noteId))).toBe(true);
  }
});
