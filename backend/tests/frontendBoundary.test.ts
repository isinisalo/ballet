import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = path.join(process.cwd(), "frontend");
const sourceExtensions = new Set([".ts", ".tsx"]);
const forbiddenImportPattern = /\b(?:import|export)\b[^'"]*['"][^'"]*(?:shared\/domain|backend\/)[^'"]*['"]/;

const sourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return sourceExtensions.has(path.extname(entry.name)) ? [absolutePath] : [];
  }));
  return nested.flat();
};

describe("frontend import boundaries", () => {
  it("depends on shared API contracts instead of backend internals or shared domain modules", async () => {
    const files = await sourceFiles(frontendRoot);
    const violations: string[] = [];
    await Promise.all(files.map(async (file) => {
      const source = await readFile(file, "utf8");
      if (forbiddenImportPattern.test(source)) {
        violations.push(path.relative(process.cwd(), file));
      }
    }));

    expect(violations).toEqual([]);
  });
});
