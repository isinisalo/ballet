import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { emptyEventStormingModel, eventStormingModelSchema, eventStormingSemanticHash, serializeStormJson } from "../../../shared/orchestration/eventStorming.js";
import { eventStormingLayoutSchema } from "../../../shared/orchestration/eventStormingLayout.js";
import { stormFixture, stormId } from "../../../shared/orchestration/testing/eventStormingFixture.js";
import { EventStormingService } from "./EventStormingService.js";
import { EventStormingContextService } from "./EventStormingContextService.js";
import { ProjectDocumentRepository } from "./ProjectDocumentRepository.js";
import { UserStoryService } from "./UserStoryService.js";
const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ballet-storm-")); roots.push(root);
  const connection = vi.fn(() => { throw new Error("No SQLite allowed"); }), locked = vi.fn();
  const documents = new ProjectDocumentRepository(path.join(root, ".ballet"), connection);
  return { root, connection, documents, locked, service: new EventStormingService(documents, locked), context: new EventStormingContextService(root) };
}
describe("Event Storming semantic and layout ownership", () => {
  test("empty read creates no files; independent JSON roundtrips preserve IDs and Markdown", () => {
    const f = fixture(); expect(f.service.read().contentHash).toBe("absent"); expect(readdirSync(f.root)).toEqual([]);
    const { model, layout } = stormFixture(); const saved = f.service.save(model, "absent"); f.service.saveLayout(layout, "absent");
    expect(new EventStormingService(f.documents, f.locked).read()).toEqual(saved);
    expect(f.service.readLayout().value).toEqual(layout); expect(saved.value.documentation).toBe(model.documentation);
    expect(readdirSync(path.join(f.root, ".ballet/event-storming")).sort()).toEqual(["layout.json", "model.json"]); expect(f.connection).not.toHaveBeenCalled();
  });
  test("layout edits and missing/broken layout never change semantic hash or context", () => {
    const f = fixture(), { model, layout } = stormFixture(); f.service.save(model, "absent");
    const before = f.context.read({ process: stormId(3) }); const raw = readFileSync(path.join(f.root, ".ballet/event-storming/model.json"));
    const saved = f.service.saveLayout(layout, "absent"); layout.views[0].placements[0].x += 99; f.service.saveLayout(layout, saved.contentHash);
    expect(f.context.read({ process: stormId(3) })).toEqual(before);
    writeFileSync(path.join(f.root, ".ballet/event-storming/layout.json"), "<<<<<<< unresolved");
    expect(() => f.service.readLayout()).toThrow(/Repair/); expect(f.context.read({ process: stormId(3) })).toEqual(before);
    expect(readFileSync(path.join(f.root, ".ballet/event-storming/model.json"))).toEqual(raw);
  });
  test("model and layout have separate conflict boundaries and invalid JSON cannot be overwritten", () => {
    const f = fixture(), { model, layout } = stormFixture(); const saved = f.service.save(model, "absent"), geometry = f.service.saveLayout(layout, "absent");
    layout.views[0].placements[0].x++; f.service.saveLayout(layout, geometry.contentHash);
    model.description = "Changed semantics"; expect(f.service.save(model, saved.contentHash).value.description).toBe("Changed semantics");
    expect(() => f.service.save(model, saved.contentHash)).toThrow(/stale/); expect(() => f.service.saveLayout(layout, geometry.contentHash)).toThrow(/stale/);
    const filename = path.join(f.root, ".ballet/event-storming/model.json");
    for (const source of ["{", "<<<<<<< branch", '{"version":1}', '"x"']) {
      writeFileSync(filename, source); expect(() => f.service.read()).toThrow(/Invalid Event Storming/);
      expect(() => f.service.save(emptyEventStormingModel(), "absent")).toThrow(); expect(readFileSync(filename, "utf8")).toBe(source);
    }
  });
  test("invalid layout versions preserve the file and leave semantics available", () => {
    const f = fixture(), { model, layout } = stormFixture(); f.service.save(model, "absent");
    const filename = path.join(f.root, ".ballet/event-storming/layout.json");
    for (const content of ['{"version":2,"views":[]}', "<<<<<<< branch", "{"]) {
      writeFileSync(filename, content);
      expect(() => f.service.saveLayout(layout, "absent")).toThrow(/Repair/);
      expect(readFileSync(filename, "utf8")).toBe(content); expect(f.context.read().kind).toBe("index");
    }
  });
  test("strict references, duplicate IDs, versions, geometry, safe sources and size limits", () => {
    const { model, layout } = stormFixture();
    for (const change of [(v: typeof model) => v.concepts.push(v.concepts[0]), (v: typeof model) => { v.processes[0].steps[0].conceptId = stormId(999); },
      (v: typeof model) => { v.processes[0].connections[0].target = stormId(999); }, (v: typeof model) => { v.concepts[0].sources = ["javascript:alert(1)"]; }]) {
      const value = structuredClone(model); change(value); expect(eventStormingModelSchema.safeParse(value).success).toBe(false);
    }
    expect(eventStormingModelSchema.safeParse({ ...model, version: 1 }).success).toBe(false);
    expect(eventStormingModelSchema.safeParse({ ...model, x: 1 }).success).toBe(false);
    layout.views[0].placements[0].x = NaN; expect(eventStormingLayoutSchema.safeParse(layout).success).toBe(false);
    const f = fixture(); mkdirSync(path.join(f.root, ".ballet/event-storming"), { recursive: true });
    writeFileSync(path.join(f.root, ".ballet/event-storming/model.json"), " ".repeat(786_433)); expect(() => f.service.read()).toThrow(/oversized/);
  });
  test("repeated concepts, incomplete processes and branches are valid without story or aggregate", () => {
    const f = fixture(), { model } = stormFixture(); model.processes[0].steps.push({ ...model.processes[0].steps[0], id: stormId(9) });
    expect(f.service.save(model, "absent").value.processes[0].steps).toHaveLength(3);
    model.concepts.reverse(); model.processes[0].steps.reverse();
    expect(eventStormingSemanticHash(model)).toBe(f.service.read().semanticHash); expect(serializeStormJson(model)).toBe(serializeStormJson(f.service.read().value));
  });
  test("symlink files and ancestors are rejected and the Markdown write path is closed", () => {
    const f = fixture(), outside = fixture(); mkdirSync(path.join(f.root, ".ballet")); symlinkSync(outside.root, path.join(f.root, ".ballet/event-storming"));
    expect(() => f.service.read()).toThrow(/ordinary/); expect(() => f.service.save(stormFixture().model, "absent")).toThrow(/ordinary/);
    expect(() => f.documents.put("event-storming", "model", "old content", "absent")).toThrow(/dedicated JSON/);
  });
  test("whole story links derive backlinks, block deletion and never rewrite approved story bytes", () => {
    const f = fixture(); const stories = new UserStoryService(f.documents, () => {});
    const draft = stories.create({ role: "buyer", goal: "order", benefit: "receive goods", acceptanceCriteria: [{ given: "items", when: "submit", then: "received" }], details: "More", adrIds: [] });
    const approved = stories.approve(draft.value.id, draft.contentHash, draft.semanticHash, { id: "human", source: "request_context" }, "2026-09-06T10:00:00Z");
    const filename = path.join(f.root, ".ballet/user-stories", `${draft.value.id}.md`), bytes = readFileSync(filename);
    const { model } = stormFixture(); model.processes[0].steps[0].storyIds = [draft.value.id]; const saved = f.service.save(model, "absent");
    expect(f.service.storyReferences(draft.value.id)).toHaveLength(1); expect(() => stories.remove(draft.value.id, approved.contentHash)).toThrow(/Orders/);
    expect(readFileSync(filename)).toEqual(bytes); const context = f.context.read({ story: draft.value.id });
    expect(context.kind === "detail" && context.stories[0].value.status).toBe("approved");
    model.processes[0].steps[0].storyIds = []; f.service.save(model, saved.contentHash); stories.remove(draft.value.id, approved.contentHash);
    expect(() => stories.require(draft.value.id)).toThrow();
  });
  test("a source removed in Git remains repairable but cannot acquire new links", () => {
    const f = fixture(); const stories = new UserStoryService(f.documents, () => {});
    const story = stories.create({ role: "reader", goal: "read", benefit: "learn", acceptanceCriteria: [] });
    const { model } = stormFixture(); model.processes[0].storyIds = [story.value.id];
    const saved = f.service.save(model, "absent");
    rmSync(path.join(f.root, ".ballet/user-stories", `${story.value.id}.md`));
    model.description = "Other changes are still allowed";
    const updated = f.service.save(model, saved.contentHash);
    expect(f.context.read()).toMatchObject({ stories: [{ id: story.value.id, issue: "Story source is missing." }] });
    model.processes[0].steps[0].storyIds = [story.value.id];
    expect(() => f.service.save(model, updated.contentHash)).toThrow(/not found/);
    expect(f.service.read()).toEqual(updated);
  });
});
