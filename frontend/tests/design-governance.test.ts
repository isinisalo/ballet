import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("design governance", () => {
  it("keeps DESIGN.md and AGENTS.md in the repository root", () => {
    const designPath = resolve(root, "DESIGN.md");
    const agentsPath = resolve(root, "AGENTS.md");

    expect(existsSync(designPath)).toBe(true);
    expect(existsSync(agentsPath)).toBe(true);
    expect(readFileSync(designPath, "utf8")).toContain("Ballet Matte Workbench");
    expect(readFileSync(agentsPath, "utf8")).toContain("Read `DESIGN.md`");
  });
});
