import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseAdr } from "../../shared/orchestration/adr.ts";
import { EventStormingService } from "../../backend/orchestration/project/EventStormingService.ts";
import { ProjectDocumentRepository } from "../../backend/orchestration/project/ProjectDocumentRepository.ts";
import { stormProcessStoryIds } from "../../shared/orchestration/eventStormingContext.ts";

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
  try {
    const service = new EventStormingService(new ProjectDocumentRepository(path.join(root, ".ballet")), () => {});
    const { value } = service.read(); service.readLayout();
    for (const process of value.processes) for (const id of stormProcessStoryIds(process)) {
      if (!existsSync(path.join(root, ".ballet/user-stories", `${id}.md`))) issues.push(`Missing Event Storming story ${id}.`);
    }
    const sources = [...value.concepts.flatMap(c => c.sources), ...value.processes.flatMap(p => [...p.sources, ...p.steps.flatMap(s => s.sources), ...p.boundaries.flatMap(b => b.sources)])];
    for (const source of new Set(sources.filter(s => s.startsWith(".ballet/")))) if (!existsSync(path.join(root, source.split("#")[0]))) issues.push(`Missing Event Storming source ${source}.`);
  } catch (error) { issues.push(`Event Storming: ${error.message}`); }
  return issues;
}
