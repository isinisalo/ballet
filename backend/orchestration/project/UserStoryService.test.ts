import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { USER_STORY_LIMITS, userStoryInputSchema, type UserStoryInput } from "../../../shared/orchestration/userStories.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";
import { ProjectDocumentRepository } from "./ProjectDocumentRepository.js";
import { UserStoryService } from "./UserStoryService.js";

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
const input: UserStoryInput = { role: "project owner", goal: "to define a useful outcome", benefit: "the team knows why it matters",
  acceptanceCriteria: [{ given: "a project", when: "I save the story", then: "the story is in Git-ready Markdown" }] };
const fixture = () => {
  const root = mkdtempSync(path.join(tmpdir(), "ballet-user-stories-"));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  const database = vi.fn(() => { throw new Error("User Stories must not access SQLite"); });
  const documents = new ProjectDocumentRepository(path.join(root, ".ballet"), database);
  const assertUnlocked = vi.fn();
  const service = new UserStoryService(documents, assertUnlocked);
  return { root, documents, service, database, assertUnlocked, filename: (id: string) => path.join(root, ".ballet/user-stories", `${id}.md`) };
};

describe("repository-first User Stories", () => {
  test("roundtrips ordered criteria across service restarts without creating config or accessing SQLite", () => {
    const { root, service, documents, database, filename } = fixture();
    expect(service.list()).toEqual({ stories: [], issues: [] });
    const saved = service.create({ ...input, acceptanceCriteria: [...input.acceptanceCriteria, { given: "offline", when: "I restart", then: "the file is retained" }] });
    expect(readFileSync(filename(saved.value.id), "utf8")).toContain("version: 1");
    const reopened = new UserStoryService(documents, () => undefined);
    expect(reopened.require(saved.value.id)).toEqual(saved);
    expect(reopened.list().stories).toEqual([saved]);
    expect(readdirSync(path.join(root, ".ballet"))).toEqual(["user-stories"]);
    expect(database).not.toHaveBeenCalled();
  });

  test("preserves Markdown notes, detects stale writes and deletes only the reviewed file", () => {
    const { service, filename } = fixture();
    const first = service.create(input);
    const notes = "\n# Notes\n\nA manually maintained paragraph.\n";
    writeFileSync(filename(first.value.id), readFileSync(filename(first.value.id), "utf8") + notes);
    const current = service.require(first.value.id);
    expect(() => service.update(first.value.id, input, first.contentHash)).toThrow("optimistic hash is stale");
    const updated = service.update(first.value.id, { ...input, role: "reviewer", acceptanceCriteria: [] }, current.contentHash);
    expect(readFileSync(filename(first.value.id), "utf8")).toContain(notes);
    expect(updated.value.acceptanceCriteria).toEqual([]);
    expect(() => service.remove(first.value.id, current.contentHash)).toThrow("optimistic hash is stale");
    service.remove(first.value.id, updated.contentHash);
    expect(service.list().stories).toEqual([]);
    expect(() => service.require(first.value.id)).toThrow("was not found");
  });

  test("reports invalid files without dropping valid stories or overwriting invalid input", () => {
    const { service, filename } = fixture();
    const good = service.create(input); const invalid = service.create(input);
    const source = readFileSync(filename(invalid.value.id), "utf8").replace("version: 1", "version: 2");
    writeFileSync(filename(invalid.value.id), source);
    const collection = service.list();
    expect(collection.stories).toEqual([good]);
    expect(collection.issues[0]?.id).toBe(invalid.value.id);
    expect(() => service.update(invalid.value.id, input, invalid.contentHash)).toThrow("Invalid User Story");
    expect(readFileSync(filename(invalid.value.id), "utf8")).toBe(source);
  });

  test("rejects unsafe paths, file symlinks and symlinked collection or data directories", () => {
    const { root, service, filename } = fixture();
    const story = service.create(input); const file = filename(story.value.id);
    const source = readFileSync(file, "utf8"); const external = path.join(root, "outside.md");
    writeFileSync(external, source); rmSync(file); symlinkSync(external, file);
    expect(() => service.require(story.value.id)).toThrow("ordinary file");
    expect(() => service.remove(story.value.id, story.contentHash)).toThrow("ordinary file");
    expect(() => service.require("../../outside")).toThrow("unsafe path");
    rmSync(path.dirname(file), { recursive: true });
    const externalDirectory = path.join(root, "external"); mkdirSync(externalDirectory);
    symlinkSync(externalDirectory, path.dirname(file));
    expect(() => service.create(input)).toThrow("ordinary directory");
    expect(() => service.list()).toThrow("ordinary directory");
    rmSync(path.join(root, ".ballet"), { recursive: true }); symlinkSync(externalDirectory, path.join(root, ".ballet"));
    expect(() => service.list()).toThrow("ordinary directory");
    expect(readFileSync(external, "utf8")).toBe(source);
  });

  test("rejects mismatched IDs, duplicate YAML keys and YAML aliases", () => {
    const { service, filename } = fixture(); const saved = service.create(input);
    const source = readFileSync(filename(saved.value.id), "utf8");
    for (const invalid of [source.replace(saved.value.id, "00000000-0000-4000-8000-000000000000"),
      source.replace("version: 1", "version: 1\nversion: 1"), source.replace("role: project owner", "role: &role project owner\nextra: *role")]) {
      writeFileSync(filename(saved.value.id), invalid);
      expect(() => service.require(saved.value.id)).toThrow("Invalid User Story");
    }
  });

  test("enforces active Run locks and bounded complete inputs before any write", () => {
    const { service, assertUnlocked, filename } = fixture(); const saved = service.create(input);
    assertUnlocked.mockImplementation(() => { throw new ConflictError("Locked by active Run"); });
    expect(() => service.create(input)).toThrow("Locked");
    expect(() => service.update(saved.value.id, input, saved.contentHash)).toThrow("Locked");
    expect(() => service.remove(saved.value.id, saved.contentHash)).toThrow("Locked");
    expect(service.require(saved.value.id)).toEqual(saved);
    expect(userStoryInputSchema.safeParse({ ...input, role: " " }).success).toBe(false);
    expect(userStoryInputSchema.safeParse({ ...input, acceptanceCriteria: [{ given: "ok", when: "ok", then: "" }] }).success).toBe(false);
    expect(userStoryInputSchema.safeParse({ ...input, acceptanceCriteria: Array(USER_STORY_LIMITS.criteria + 1).fill(input.acceptanceCriteria[0]) }).success).toBe(false);
    writeFileSync(filename(saved.value.id), "x".repeat(USER_STORY_LIMITS.documentBytes + 1));
    expect(() => service.require(saved.value.id)).toThrow("size limit");
  });
});
