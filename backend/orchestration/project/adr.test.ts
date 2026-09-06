import { describe, expect, it } from "vitest";
import { nextAdrId, parseAdr, serializeAdr } from "../../../shared/orchestration/adr.js";

const record = { id: "adr-034", title: "Suoritus", decision: "Validation ohjaa.", scope: "Environment Run." };
const source = "[ADR-034: Suoritus]\nDecision: Validation ohjaa.\nScope: Environment Run.\n";
describe("accepted three-line ADR contract", () => {
  it("round trips Finnish content and accepts CRLF", () => {
    expect(serializeAdr(record)).toBe(source);
    expect(parseAdr(source, record.id)).toEqual(record);
    expect(parseAdr(source.replaceAll("\n", "\r\n"))).toEqual(record);
  });
  it.each([`---\nid: adr-034\n---\n${source}`, `${source}\n`, `${source}Status: accepted\n`, source.replace("Validation ohjaa.", " "), source.replace("Scope:", "Rajaus:"), source.replace("Suoritus", "Suoritus] muuta")])("rejects invalid records", (content) => expect(() => parseAdr(content)).toThrow());
  it("rejects mismatched IDs and multiline fields", () => {
    expect(() => parseAdr(source, "adr-035")).toThrow();
    expect(() => serializeAdr({ ...record, decision: "Ensimmäinen\nToinen" })).toThrow();
  });
  it("allocates after the highest ID without filling gaps", () => expect(nextAdrId(["adr-001", "adr-048"])).toBe("adr-049"));
});

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectDocumentRepository } from "./ProjectDocumentRepository.js";
it("preserves named ADR paths and rejects duplicate numeric file identities", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ballet-adr-record-"));
  try {
    const data = path.join(root, ".ballet"); mkdirSync(path.join(data, "adr"), { recursive: true });
    const file = path.join(data, "adr", "adr-034-execution.md"); writeFileSync(file, source);
    const repo = new ProjectDocumentRepository(data); const saved = repo.require("adr", "adr-034");
    expect(repo.list("adr").map(({ id }) => id)).toEqual(["adr-034"]);
    repo.put("adr", "adr-034", serializeAdr({ ...record, decision: "Uusi päätös." }), saved.contentHash);
    expect(repo.require("adr", "adr-034").content).toContain("Uusi päätös.");
    expect(() => repo.put("adr", "adr-034", source, saved.contentHash)).toThrow("stale");
    writeFileSync(path.join(data, "adr", "adr-034-duplicate.md"), source);
    expect(() => repo.list("adr")).toThrow("Duplicate adr");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
