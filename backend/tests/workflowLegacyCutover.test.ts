import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Workflow Engineering hard cut architecture", () => {
  it("keeps removed v9 runtime and authoring symbols out of active product code", async () => {
    const files = await activeSourceFiles();
    const forbidden = /\b(?:ProjectStep|ProjectStepTransitions|StepTransitionTarget|StepRun|StepRunResult)\b|z\.literal\(9\)|["']loop_step["']/;
    expect(await matchesIn(files, forbidden)).toEqual([]);
  });

  it("keeps the removed composite Workflow model and route out of active product code", async () => {
    const files = await activeSourceFiles();
    const forbidden = /\b(?:ProjectWorkLoopNode|WorkLoopNode|WorkNode|LOCAL_RETRY|ORCHESTRATOR_REPAIR|work_loop_node_runs|maxLocalAttempts|startNodeId)\b|view=loop|loops\\\.\\d\+\\\.nodes/;
    expect(await matchesIn(files, forbidden)).toEqual([]);
  });

  it("uses PASS/FAIL and escalation terminology in active Workflow contracts", async () => {
    const files = await sourceFiles([
      "shared/domain/automation.ts", "shared/domain/projectConfig.ts", "shared/domain/runtime.ts",
      "shared/domain/runs.ts", "shared/api/workspace-schemas.ts", "shared/api/runtime-schemas.ts",
      "backend/runtime", "frontend/src/workspace/automation/loops", ".fixture-ballet-project/.ballet/project.json"
    ]);
    expect(await matchesIn(files.filter(isActiveProductSource), /\b(?:approved|rejected)\b/)).toEqual([]);
  });

  it("keeps shared domain independent and tracked contracts on their hard-cut versions", async () => {
    const domainFiles = await sourceFiles(["shared/domain"]);
    const imports = await matchesIn(domainFiles, /from\s+["'][^"']*(?:backend|frontend)[^"']*["']/);
    expect(imports).toEqual([]);

    const project = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8")) as unknown;
    const fixture = JSON.parse(await readFile(path.join(root, ".fixture-ballet-project/.ballet/project.json"), "utf8")) as unknown;
    const theme = JSON.parse(await readFile(path.join(root, ".ballet/theme.json"), "utf8")) as unknown;
    expect(project).toMatchObject({ version: 12, graph: { loopEdges: expect.any(Array) } });
    expect(fixture).toMatchObject({ version: 12, graph: { loopEdges: expect.any(Array) } });
    expect(theme).toMatchObject({ version: 4, edge: { repairStyle: expect.any(String) } });
    expect(JSON.stringify(theme)).not.toContain("rejectedStyle");
  });
});

const activeSourceFiles = async (): Promise<string[]> => (await sourceFiles([
  "shared", "backend", "frontend/src", ".fixture-ballet-project", "scripts"
])).filter(isActiveProductSource);

const isActiveProductSource = (filename: string): boolean =>
  !filename.endsWith("workflowLegacyCutover.test.ts")
  && !filename.includes(`${path.sep}tests${path.sep}`)
  && !filename.endsWith(".test.ts")
  && !filename.endsWith(".test.tsx")
  && !filename.includes(`${path.sep}dist${path.sep}`);

const sourceFiles = async (relativePaths: string[]): Promise<string[]> => {
  const groups = await Promise.all(relativePaths.map(async (relativePath) => {
    const absolute = path.join(root, relativePath);
    const status = await readdir(absolute, { withFileTypes: true }).catch(() => undefined);
    return status ? walk(absolute) : [absolute];
  }));
  return groups.flat().filter((filename) => /\.(?:ts|tsx|js|mjs|json|sh)$/.test(filename));
};

const walk = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries
    .filter((entry) => entry.name !== "node_modules")
    .map((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return groups.flat();
};

const matchesIn = async (files: string[], pattern: RegExp): Promise<string[]> => {
  const results = await Promise.all(files.map(async (filename) => {
    const source = await readFile(filename, "utf8");
    return pattern.test(source) ? path.relative(root, filename) : undefined;
  }));
  return results.filter((filename): filename is string => filename !== undefined).sort();
};
