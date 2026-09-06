import { mkdtempSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { stormFixture } from "../../../shared/orchestration/testing/eventStormingFixture.js";
import { EventStormingService } from "./EventStormingService.js";
import { ProjectDocumentRepository } from "./ProjectDocumentRepository.js";

vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return { ...fs, renameSync: vi.fn(fs.renameSync) };
});
const roots: string[] = [];
afterEach(() => { vi.mocked(renameSync).mockClear(); roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })); });

test("failed atomic replacement retains the original file and cleans temporary files; layout failure retains a saved model", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ballet-storm-atomic-")); roots.push(root);
  const directory = path.join(root, ".ballet/event-storming");
  const service = new EventStormingService(new ProjectDocumentRepository(path.join(root, ".ballet")), () => {});
  const { model, layout } = stormFixture();
  const saved = service.save(model, "absent"), savedLayout = service.saveLayout(layout, "absent");
  const bytes = readFileSync(path.join(directory, "model.json"));
  model.description = "New semantics";
  vi.mocked(renameSync).mockImplementationOnce(() => { throw new Error("Simulated rename failure"); });
  expect(() => service.save(model, saved.contentHash)).toThrow(/rename failure/);
  expect(readFileSync(path.join(directory, "model.json"))).toEqual(bytes);
  expect(readdirSync(directory).sort()).toEqual(["layout.json", "model.json"]);
  const updated = service.save(model, saved.contentHash);
  layout.views[0].placements[0].x += 42;
  vi.mocked(renameSync).mockImplementationOnce(() => { throw new Error("Simulated layout failure"); });
  expect(() => service.saveLayout(layout, savedLayout.contentHash)).toThrow(/layout failure/);
  expect(service.read()).toEqual(updated); expect(service.readLayout()).toEqual(savedLayout);
  expect(readdirSync(directory).sort()).toEqual(["layout.json", "model.json"]);
});
