import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiRequestError } from "../src/apiClient";
import { StormDocumentStore } from "../src/orchestration/event-storming/StormDocumentStore";
import { stormFixture, stormId } from "@shared/orchestration/testing/eventStormingFixture";
import { eventStormingSemanticHash, type EventStormingDocument } from "@shared/orchestration/eventStorming";
import { type EventStormingLayoutDocument } from "@shared/orchestration/eventStormingLayout";
import { addStormStep, removeStormSteps, resolveStormView } from "../src/orchestration/event-storming/stormOperations";
import { routeFromPath } from "../src/workspace/routing";
const stores: StormDocumentStore[] = [];
afterEach(() => { stores.splice(0).forEach((s) => s.dispose()); vi.useRealTimers(); });
async function fixture() {
  const { model, layout } = stormFixture();
  let serverModel: EventStormingDocument = { value: model, contentHash: "a".repeat(64), semanticHash: eventStormingSemanticHash(model) };
  let serverLayout: EventStormingLayoutDocument = { value: layout, contentHash: "b".repeat(64) };
  const api = {
    read: vi.fn(async () => structuredClone(serverModel)), readLayout: vi.fn(async () => structuredClone(serverLayout)),
    save: vi.fn(async (value: typeof model, hash: string) => { if (hash !== serverModel.contentHash) throw new ApiRequestError("stale model", 409);
      serverModel = { value: structuredClone(value), contentHash: eventStormingSemanticHash(value), semanticHash: eventStormingSemanticHash(value) }; return structuredClone(serverModel); }),
    saveLayout: vi.fn(async (value: typeof layout, hash: string) => { if (hash !== serverLayout.contentHash) throw new ApiRequestError("stale layout", 409);
      serverLayout = { value: structuredClone(value), contentHash: String(serverLayout.contentHash.length) }; return structuredClone(serverLayout); }), context: vi.fn()
  };
  const store = new StormDocumentStore(api); stores.push(store); await store.refresh();
  return { store, api, externalModel: (doc: EventStormingDocument) => { serverModel = doc; }, externalLayout: (doc: EventStormingLayoutDocument) => { serverLayout = doc; } };
}
describe("separate semantic/layout save queues", () => {
  test("typing debounces; geometry saves independently and never changes the semantic hash", async () => {
    vi.useFakeTimers(); const { store, api } = await fixture(); const hash = eventStormingSemanticHash(store.model.state.value);
    store.edit((d) => { d.layout.views[0].placements[0].x++; }, true); await vi.advanceTimersByTimeAsync(0);
    expect(api.saveLayout).toHaveBeenCalledTimes(1); expect(api.save).not.toHaveBeenCalled(); expect(eventStormingSemanticHash(store.model.state.value)).toBe(hash);
    store.edit((d) => { d.model.concepts[0].title = "Typed"; }); await vi.advanceTimersByTimeAsync(599); expect(api.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(api.save).toHaveBeenCalledTimes(1);
  });
  test("semantic changes persist before their layout and late responses preserve newer edits", async () => {
    const { store, api } = await fixture(); let finish!: (value: EventStormingDocument) => void;
    api.save.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    store.edit((d) => { d.model.description = "first"; d.layout.views[0].placements[0].x++; }); const saving = store.save();
    store.edit((d) => { d.model.description = "newer"; }); expect(api.saveLayout).not.toHaveBeenCalled();
    finish({ value: { ...store.model.state.value, description: "first" }, contentHash: "a".repeat(64), semanticHash: "c".repeat(64) }); await saving;
    expect(store.model.state.value.description).toBe("newer"); expect(store.model.state.dirty).toBe(true);
    await store.save(); expect(store.model.state.dirty).toBe(false); expect(api.saveLayout).toHaveBeenCalledTimes(1);
  });
  test("layout conflicts preserve drafts while model edits still save, with explicit reload", async () => {
    const { store, api, externalLayout } = await fixture();
    store.edit((d) => { d.layout.views[0].placements[0].x = 900; });
    externalLayout({ value: stormFixture().layout, contentHash: "c".repeat(64) }); await store.layout.refresh();
    expect(store.layout.state.conflict).toBe(true); expect(store.layout.state.value.views[0].placements[0].x).toBe(900);
    store.edit((d) => { d.model.description = "Independent edit"; }); await store.save(); expect(api.save).toHaveBeenCalledTimes(1); expect(api.saveLayout).not.toHaveBeenCalled();
    await store.layout.refresh(true); expect(store.layout.state.conflict).toBe(false); expect(store.layout.state.value.views[0].placements[0].x).toBe(100);
  });
  test("an unrelated layout edit saves while a semantic draft has a validation error", async () => {
    const { store, api } = await fixture();
    store.edit((d) => { d.model.concepts[0].sources = ["invalid source"]; });
    store.edit((d) => { d.layout.views[0].placements[0].x = 321; });
    await store.save();
    expect(api.save).not.toHaveBeenCalled(); expect(api.saveLayout).toHaveBeenCalledTimes(1);
    expect(store.model.state.dirty).toBe(true); expect(store.layout.state.dirty).toBe(false);
  });
  test("undo/redo touches only edited files and preserves independent external layout", async () => {
    const { store, api, externalLayout } = await fixture(); store.edit((d) => { d.model.description = "changed"; }); await store.save();
    const layout = stormFixture().layout; layout.views[0].placements[0].x = 888; externalLayout({ value: layout, contentHash: "c".repeat(64) }); await store.layout.refresh();
    store.undo(); await store.save(); expect(store.model.state.value.description).toBe(""); expect(store.layout.state.value.views[0].placements[0].x).toBe(888);
    store.redo(); await store.save(); expect(store.model.state.value.description).toBe("changed"); expect(api.saveLayout).not.toHaveBeenCalled();
  });
  test("invalid models, unavailable layouts and active locks cannot overwrite source files", async () => {
    const { store, api } = await fixture(); store.locked = true; store.edit((d) => { d.model.description = "ignored"; }); expect(store.model.state.dirty).toBe(false);
    store.locked = false; api.readLayout.mockRejectedValue(new Error("Invalid layout JSON")); await store.layout.refresh(); expect(store.layout.state.error).toContain("Invalid layout");
    store.edit((d) => { d.model.concepts[0].sources = ["invalid source"]; }); await store.save(); expect(api.save).not.toHaveBeenCalled(); expect(store.model.state.error).toBeTruthy();
  });
});
test("missing geometry is deterministic; repeating a concept and removing an occurrence preserve other steps", () => {
  const draft = stormFixture(), process = draft.model.processes[0]; const missing = { version: 1 as const, views: [] };
  expect(resolveStormView(draft.model, missing, process)).toEqual(resolveStormView(draft.model, missing, process));
  const before = structuredClone(draft.layout.views[0].placements);
  addStormStep(draft, process.id, draft.layout.views[0], "event", stormId(20), stormId(1));
  expect(draft.model.concepts).toHaveLength(2); expect(draft.model.processes[0].steps).toHaveLength(3); expect(draft.layout.views[0].placements.slice(0, 2)).toEqual(before);
  removeStormSteps(draft, process.id, [stormId(20)]); expect(draft.model.processes[0].steps).toHaveLength(2); expect(draft.model.concepts).toHaveLength(2);
});
test("URL owns process, step, presentation and story; removed level routes and malformed selection fail", () => {
  expect(routeFromPath(`/project/event-storming?process=${stormId(3)}&step=${stormId(4)}&view=${stormId(3)}&story=${stormId(8)}`)).toMatchObject({ entityId: stormId(3), itemId: stormId(4), stormViewId: stormId(3), storyId: stormId(8) });
  for (const suffix of [`?id=${stormId(3)}`, `?step=${stormId(4)}`, "?process=bad", `?process=${stormId(3)}&process=${stormId(3)}`]) expect(routeFromPath(`/project/event-storming${suffix}`).workspaceView).toBe("invalid");
});
