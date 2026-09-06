import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { validateProjectContent } from "../tools/validate-project-content.mjs";
import { eventStormingModelSchema } from "../../shared/orchestration/eventStorming.js";
import { eventStormingLayoutSchema } from "../../shared/orchestration/eventStormingLayout.js";
const root = path.resolve(import.meta.dirname, "../..");
it("keeps sourced Ballet process context and optional responsibility presentations without a level hierarchy", () => {
  expect(validateProjectContent(root)).toEqual([]);
  const value = eventStormingModelSchema.parse(JSON.parse(readFileSync(path.join(root, ".ballet/event-storming/model.json"), "utf8")));
  const layout = eventStormingLayoutSchema.parse(JSON.parse(readFileSync(path.join(root, ".ballet/event-storming/layout.json"), "utf8")));
  const titles = value.concepts.map((concept) => concept.title).join("\n");
  for (const title of ["Action ja Feedback estyivät atomisesti", "Run peruutettiin", "Tehtävä päättyi runtime_lost-virheeseen", "Refinement-apply estettiin", "Tarinan hyväksyntä mitätöityi"]) expect(titles).toContain(title);
  for (const view of layout.views.filter((v) => v.kind === "responsibilities")) {
    const process = value.processes.find((p) => p.id === view.processId)!;
    expect(process).toBeDefined();
    expect(view.placements.every((p) => process.steps.some((s) => s.id === p.stepId))).toBe(true);
  }
  expect(eventStormingModelSchema.safeParse({ version: 2, concepts: [], processes: [], sharedConceptIds: [], documentation: "", description: "" }).success).toBe(true);
});
