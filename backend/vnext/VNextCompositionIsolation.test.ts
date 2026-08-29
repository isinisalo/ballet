import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { VNextConnection } from "./persistence/VNextConnection.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("v19/vNext transition storage isolation", () => {
  test("vNext opens only its explicit v16 path and leaves the v15 database byte-identical", () => {
    const root = temporaryRoot(); const stateRoot = path.join(root, "state"); mkdirSync(stateRoot);
    const v15Path = path.join(stateRoot, "state.sqlite");
    const v15 = new RuntimeDatabase(v15Path); v15.connection(); v15.close(); const before = digest(v15Path);
    const v16 = new VNextConnection(path.join(stateRoot, "vnext", "state.sqlite"));
    expect(v16.connection().prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get()).toEqual({ value: "16" });
    v16.close();
    expect(digest(v15Path)).toBe(before);
    expect(path.resolve(v15Path)).not.toBe(path.resolve(path.join(stateRoot, "vnext", "state.sqlite")));
  });

  test("v19 repositories and runtime never open or write the v16 transition database", () => {
    const root = temporaryRoot(); const stateRoot = path.join(root, "state"); mkdirSync(stateRoot);
    mkdirSync(path.join(root, ".ballet"));
    writeFileSync(path.join(root, ".ballet", "project.json"), readFileSync(".ballet/project.json", "utf8"));
    const v16Path = path.join(stateRoot, "vnext", "state.sqlite");
    const v16 = new VNextConnection(v16Path); v16.connection(); v16.close(); const before = digest(v16Path);
    expect(new ProjectConfigurationRepository().load(root).config?.version).toBe(19);
    const v15 = new RuntimeDatabase(path.join(stateRoot, "state.sqlite")); v15.connection(); v15.close();
    expect(digest(v16Path)).toBe(before);
  });
});

const temporaryRoot = (): string => {
  const root = mkdtempSync(path.join(tmpdir(), "ballet-vnext-isolation-")); roots.push(root); return root;
};
const digest = (filename: string): string => createHash("sha256").update(readFileSync(filename)).digest("hex");
