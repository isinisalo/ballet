import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { emptyEventStormingModel, eventStormingModelSchema, type EventStormingModelV1 } from "../../../shared/orchestration/eventStorming.js";
import { EventStormingService } from "./EventStormingService.js";
import { ProjectDocumentRepository } from "./ProjectDocumentRepository.js";
import { parseEventStormingMarkdown, serializeEventStormingMarkdown } from "./eventStormingMarkdown.js";

const roots: string[] = [];
afterEach(() => { roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })); });
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ballet-storm-")); roots.push(root);
  const connection = vi.fn(() => { throw new Error("Event Storming must not access SQLite"); });
  const locked = vi.fn(); const documents = new ProjectDocumentRepository(path.join(root, ".ballet"), connection);
  return { root, locked, connection, documents, service: new EventStormingService(documents, locked) };
}
function model(): EventStormingModelV1 {
  const noteId = randomUUID();
  return { version: 1, notes: [{ id: noteId, kind: "event", title: "Order placed", details: "Keep stakeholder language", sources: [] }],
    boards: [{ id: randomUUID(), title: "Ordering", level: "big-picture", description: "", frames: [], connections: [],
      placements: [{ id: randomUUID(), noteId, x: 0, y: 0, width: 184, height: 168, pivotal: false }] }] };
}
describe("Event Storming repository ownership", () => {
  test("first read creates nothing; shared notes and layouts survive restart without database access", () => {
    const f = fixture(); expect(f.service.read().contentHash).toBe("absent"); expect(readdirSync(f.root)).toEqual([]);
    const value = model(); const source = value.boards[0];
    value.boards.push({ ...source, id: randomUUID(), sourceBoardId: source.id, level: "process-modelling", placements: source.placements.map((p) => ({ ...p, id: randomUUID(), x: 800 })) });
    const saved = f.service.save(value, "absent"); value.notes[0].title = "Purchase confirmed";
    f.service.save(value, saved.contentHash);
    const restarted = new EventStormingService(f.documents, f.locked).read();
    expect(restarted.value.notes).toHaveLength(1); expect(restarted.value.notes[0].title).toBe("Purchase confirmed");
    expect(restarted.value.boards.flatMap((b) => b.placements.map((p) => p.x)).sort()).toEqual([0, 800]);
    expect(f.connection).not.toHaveBeenCalled(); expect(readdirSync(path.join(f.root, ".ballet"))).toEqual(["event-storming"]);
  });
  test("preserves agent Markdown bytes, exposes external changes and rejects stale writes", () => {
    const f = fixture(); const saved = f.service.save(model(), "absent"); const filename = path.join(f.root, ".ballet/event-storming/model.md");
    const body = "\n## Workshop evidence\r\nDomain expert said **confirmed**.\n";
    const external = { ...saved.value, notes: saved.value.notes.map((n) => ({ ...n, title: "Agent change" })) };
    writeFileSync(filename, serializeEventStormingMarkdown(external, body));
    expect(() => f.service.save(saved.value, saved.contentHash)).toThrow(/stale/);
    const latest = f.service.read(); expect(latest.value.notes[0].title).toBe("Agent change");
    f.service.save(latest.value, latest.contentHash); expect(f.service.read().body).toBe(body);
    expect(readFileSync(filename, "utf8").endsWith(body)).toBe(true);
  });
  test("invalid, duplicate, oversized and incompatible data cannot overwrite a file", () => {
    const f = fixture(); f.service.save(model(), "absent"); const filename = path.join(f.root, ".ballet/event-storming/model.md");
    for (const content of ["broken", "---\nversion: 2\nnotes: []\nboards: []\n---\n", "---\nversion: 1\nversion: 1\n---\n", "x".repeat(800_000)]) {
      writeFileSync(filename, content); expect(() => f.service.read()).toThrow(); expect(() => f.service.save(emptyEventStormingModel(), "absent")).toThrow();
      expect(readFileSync(filename, "utf8")).toBe(content);
    }
  });
  test("validates references, versions, duplicates, finite geometry and safe source links", () => {
    const base = model(); const broken = structuredClone(base); broken.boards[0].placements[0].noteId = randomUUID();
    expect(eventStormingModelSchema.safeParse(broken).success).toBe(false);
    for (const mutate of [(v: EventStormingModelV1) => v.notes.push(v.notes[0]),
      (v: EventStormingModelV1) => { v.boards[0].placements[0].x = NaN; },
      (v: EventStormingModelV1) => { v.boards[0].sourceBoardId = v.boards[0].id; },
      (v: EventStormingModelV1) => { v.boards[0].connections.push({ id: randomUUID(), source: randomUUID(), target: randomUUID(), label: "" }); },
      (v: EventStormingModelV1) => { v.notes[0].sources = ["javascript:alert(1)"]; }]) {
      const value = structuredClone(base); mutate(value); expect(eventStormingModelSchema.safeParse(value).success).toBe(false);
    }
    expect(() => parseEventStormingMarkdown("---\na: &a [a]\nnotes: *a\nversion: 1\nboards: []\n---\n")).toThrow();
  });
  test("refuses symlink ancestors, symlink files and arbitrary document IDs", () => {
    const f = fixture(); const outside = path.join(f.root, "outside"); mkdirSync(outside);
    symlinkSync(outside, path.join(f.root, ".ballet")); expect(() => f.service.read()).toThrow(/ordinary directory/);
    rmSync(path.join(f.root, ".ballet")); mkdirSync(path.join(f.root, ".ballet/event-storming"), { recursive: true });
    writeFileSync(path.join(outside, "target.md"), "untouched"); symlinkSync(path.join(outside, "target.md"), path.join(f.root, ".ballet/event-storming/model.md"));
    expect(() => f.service.read()).toThrow(/ordinary file/); expect(() => f.documents.put("event-storming", "../escape", "x", "absent")).toThrow();
    expect(readFileSync(path.join(outside, "target.md"), "utf8")).toBe("untouched");
  });
  test("serialization is stable across input ordering and supports 500 notes", () => {
    const value = model(); const board = value.boards[0];
    for (let index = 1; index < 500; index++) { const id = randomUUID(); value.notes.push({ ...value.notes[0], id, title: `Event ${index}` }); board.placements.push({ ...board.placements[0], id: randomUUID(), noteId: id, x: index * 100 }); }
    const first = serializeEventStormingMarkdown(value); value.notes.reverse(); board.placements.reverse();
    expect(serializeEventStormingMarkdown(value)).toBe(first); expect(parseEventStormingMarkdown(first).value.notes).toHaveLength(500);
  });
});
