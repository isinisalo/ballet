import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { EnvironmentRunStore } from "../persistence/EnvironmentRunStore.js";
import { environmentSeed, VALID_INSTRUCTION } from "../persistence/PersistenceTestFixtures.js";
import { LocalDatabase } from "../persistence/LocalDatabase.js";
import { validProjectConfig } from "../testing/ProjectFixtures.js";
import { ProjectDocumentRepository } from "./ProjectDocumentRepository.js";
import { ProjectConfigurationRepository } from "./ProjectConfigurationRepository.js";
import { ProjectDefinitionService } from "./ProjectDefinitionService.js";
import { ProjectReferenceIndex } from "./ProjectReferenceIndex.js";

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

describe("canonical project persistence", () => {
  test("rejects a rejected-old-version fixture without fallback", () => {
    const context = fixture(false);
    const rejectedOldVersion = { version: 19, projectModel: {} };
    writeFileSync(path.join(context.root, ".ballet", "project.json"), JSON.stringify(rejectedOldVersion));
    expect(() => context.projects.load()).toThrow("Project Config v19 is unsupported");
    expect(() => context.projects.loadOptional()).toThrow("Project Config v19 is unsupported");
  });

  test("writes stable canonical JSON atomically and enforces optimistic hashes", () => {
    const context = fixture();
    const first = readFileSync(context.projects.configPath, "utf8");
    const loaded = context.projects.load();
    context.projects.save(loaded.config, loaded.configHash);
    expect(readFileSync(context.projects.configPath, "utf8")).toBe(first);
    expect(readdirSync(path.dirname(context.projects.configPath)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    expect(() => context.projects.save(loaded.config, "f".repeat(64))).toThrow("optimistic hash is stale");
  });

  test("rejects config and document symlinks without following them", () => {
    const context = fixture(false);
    const target = path.join(context.root, "target.json"); writeFileSync(target, JSON.stringify(validProjectConfig()));
    mkdirSync(path.dirname(context.projects.configPath), { recursive: true }); symlinkSync(target, context.projects.configPath);
    expect(() => context.projects.load()).toThrow("ordinary file");
    const markdown = path.join(context.root, "target.md"); writeFileSync(markdown, "# target\n");
    mkdirSync(path.join(context.documents.dataRoot, "goals"), { recursive: true });
    symlinkSync(markdown, path.join(context.documents.dataRoot, "goals", "goal-1.md"));
    expect(() => context.documents.require("goal", "goal-1")).toThrow("ordinary file");
  });

  test("locks snapshotted config and referenced resources while allowing unrelated resources", () => {
    const context = fixture();
    context.documents.put("instruction", "instruction", VALID_INSTRUCTION, "absent");
    const extra = context.documents.put("instruction", "extra", VALID_INSTRUCTION, "absent");
    new EnvironmentRunStore(context.database).create(environmentSeed());
    expect(context.documents.runReferences("instruction", "instruction")).toEqual(["run-1"]);
    const loaded = context.projects.load();
    expect(() => context.projects.save({ ...loaded.config, environment: { ...loaded.config.environment, name: "Changed" } }, loaded.configHash))
      .toThrow("locked");
    const instruction = context.documents.require("instruction", "instruction");
    expect(() => context.documents.put("instruction", "instruction", `${VALID_INSTRUCTION}\n`, instruction.contentHash)).toThrow("locked");
    expect(context.documents.put("instruction", "extra", `${VALID_INSTRUCTION}\n`, extra.contentHash).content).toContain("Acceptance evidence");
  });

  test("invalidates Use Case approval on a semantic Markdown authoring edit", () => {
    const context = fixture();
    const document = context.documents.put("use-case", "UC-1", "# Use Case\n", "absent");
    const loaded = context.projects.load();
    const useCase = loaded.config.direction.useCases[0]!;
    context.service.putDirection({ kind: "use-case", id: useCase.id, value: { ...useCase, name: "Changed semantics" },
      markdown: "# Changed semantics\n", expectedConfigHash: loaded.configHash, expectedDocumentHash: document.contentHash });
    const saved = context.projects.load().config.direction.useCases[0];
    expect(saved).toMatchObject({ status: "draft" }); expect(saved).not.toHaveProperty("approval");
  });

  test("indexes deletion blockers across Direction, Environment, instructions, and skills", () => {
    const index = new ProjectReferenceIndex(validProjectConfig());
    expect(index.for("goal", "goal-1")).toContainEqual(expect.objectContaining({ ownerType: "use-case" }));
    expect(index.for("use-case", "UC-1")).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerType: "state" }), expect.objectContaining({ ownerType: "action" })
    ]));
    expect(index.for("instruction", "instruction").length).toBeGreaterThanOrEqual(4);
  });
});

const fixture = (initialize = true) => {
  const root = mkdtempSync(path.join(tmpdir(), "ballet-orchestration-project-"));
  mkdirSync(path.join(root, ".ballet"), { recursive: true });
  const manager = new LocalDatabase(path.join(root, "state.sqlite"));
  const database = () => manager.connection(); database();
  const projects = new ProjectConfigurationRepository(path.join(root, ".ballet", "project.json"), database);
  const documents = new ProjectDocumentRepository(path.join(root, ".ballet"), database);
  if (initialize) projects.save(validProjectConfig(), "absent");
  const service = new ProjectDefinitionService(root, projects, documents);
  cleanups.push(() => { manager.close(); rmSync(root, { recursive: true, force: true }); });
  return { root, manager, database, projects, documents, service };
};
