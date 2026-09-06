import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { expect, test } from "vitest";
import { eventStormingModelSchema, normalizeStormJson } from "../../../shared/orchestration/eventStorming.js";
import { eventStormingLayoutSchema } from "../../../shared/orchestration/eventStormingLayout.js";

test("one-time repository conversion preserves every concept, source, view, placement, arrow, frame and Markdown byte", () => {
  const source = readFileSync(new URL("./fixtures/event-storming-v1/model.md", import.meta.url), "utf8");
  const match = source.match(/^---\n([\s\S]*?)\n---\n/)!;
  // Historical test fixture only: the application has no legacy parser or migration path.
  const old = parse(match[1]);
  const mapping = JSON.parse(readFileSync(new URL("./fixtures/event-storming-v1/mapping.json", import.meta.url), "utf8"));
  const model = eventStormingModelSchema.parse(JSON.parse(readFileSync(".ballet/event-storming/model.json", "utf8")));
  const layout = eventStormingLayoutSchema.parse(JSON.parse(readFileSync(".ballet/event-storming/layout.json", "utf8")));
  expect(normalizeStormJson(model.concepts)).toEqual(normalizeStormJson(old.notes)); expect(model.concepts).toHaveLength(113);
  expect(model.documentation).toBe(source.slice(match[0].length)); expect(model.processes).toHaveLength(6);
  expect(layout.views).toHaveLength(13); expect(layout.views.flatMap((v) => v.placements)).toHaveLength(233);
  expect(layout.views.flatMap((v) => v.connections)).toHaveLength(232); expect(layout.views.flatMap((v) => v.frames)).toHaveLength(18);
  const steps = model.processes.flatMap((p) => p.steps), edges = model.processes.flatMap((p) => p.connections);
  for (const board of old.boards) {
    const view = layout.views.find((v) => v.id === board.id)!;
    expect(view.title).toBe(board.title); expect(view.description).toBe(board.description);
    if (board.level === "process-modelling") expect(model.processes.find((p) => p.id === board.id)?.description).toBe(board.description);
    for (const placement of board.placements) {
      const converted = view.placements.find((p) => p.id === placement.id)!;
      for (const key of ["x", "y", "width", "height", "pivotal", "frameId"] as const) expect(converted[key]).toEqual(placement[key]);
      expect(converted).toMatchObject(mapping.placements[placement.id]);
      expect(converted.conceptId ?? steps.find((s) => s.id === converted.stepId)?.conceptId).toBe(placement.noteId);
    }
    for (const connection of board.connections) {
      const converted = view.connections.find((c) => c.id === connection.id)!;
      expect(converted).toMatchObject({ source: connection.source, target: connection.target, connectionId: mapping.connections[connection.id] });
      const semantic = edges.find((c) => c.id === converted.connectionId)!;
      expect(semantic).toMatchObject({ label: connection.label, source: mapping.placements[connection.source].stepId, target: mapping.placements[connection.target].stepId });
    }
    for (const frame of board.frames) expect(view.frames.find((f) => f.id === frame.id)).toMatchObject(frame);
  }
  expect(existsSync(".ballet/event-storming/model.md")).toBe(false);
});
