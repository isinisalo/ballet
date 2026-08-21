import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loopModulePackageV3Schema } from "../../shared/api/loop-module-schemas.js";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import type { LoopModulePackageV3 } from "../../shared/domain/loopModules.js";
import { LoopModuleService } from "../../backend/loop-modules/LoopModuleService.js";
import type { RuntimeDatabaseProvider } from "../../backend/services/RuntimeDatabaseProvider.js";
import { buildGraphEngineeringProjection } from "../../frontend/src/workspace/automation/loops/engineeringProjections.js";

const roots: string[] = [];
const graphEngineeringIds = ["design", "plan", "build", "deploy", "verify"];

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("Graph Engineering project-local RunBook", () => {
  it("materializes exactly five Loops, the 18 named transitions, and no default Repair Edges", async () => {
    const config = projectConfigSchema.parse(JSON.parse(await readFile(".ballet/project.json", "utf8")));

    expect(config.version).toBe(13);
    expect(config.loops.map((loop) => loop.id)).toEqual(graphEngineeringIds);
    expect(config.graph).toMatchObject({
      id: "graph-engineering", name: "Graph Engineering", startLoopId: "design", repairEdges: []
    });
    expect(config.graph.transitions).toHaveLength(18);
    expect(new Set(config.graph.transitions.map((route) => `${route.source}:${route.decision}:${route.outcome}`)).size).toBe(18);
    expect(config.graph.transitions).toContainEqual(expect.objectContaining({
      source: "verify", decision: "PASS", outcome: "complete", target: { runResult: "DONE" }
    }));

    const design = config.loops[0]!;
    expect(design.workflow.jobNodes).toHaveLength(12);
    expect(design.workflow.validationNodes).toHaveLength(12);
    expect(design.workflow.jobNodes.map(({ id }) => id)).toEqual([
      "design-01-introduction-and-goals",
      "design-02-constraints",
      "design-03-context-and-scope",
      "design-04-solution-strategy",
      "design-05-building-block-view",
      "design-06-runtime-view",
      "design-07-deployment-view",
      "design-08-crosscutting-concepts",
      "design-09-architecture-decisions",
      "design-10-quality-requirements",
      "design-11-risks-and-technical-debt",
      "design-12-glossary"
    ]);
    expect(config.loops.find((loop) => loop.id === "plan")?.workflow.jobNodes).toHaveLength(2);
    expect(config.loops.find((loop) => loop.id === "build")?.workflow.jobNodes).toHaveLength(1);

    const projection = buildGraphEngineeringProjection({ config });
    expect(projection.orchestrator.id).toBe("loop-orchestrator");
    expect(projection.nodes).toHaveLength(5);
    expect(projection.edges).toHaveLength(18);
    expect(projection.done).toBe(true);
  });

  it("publishes exactly five graph-engineering V3 modules with separate transition and repair recommendations", async () => {
    const packages = await readPackages("graph-engineering");

    expect(packages.map((pkg) => pkg.manifest.id)).toEqual([...graphEngineeringIds].sort());
    expect(packages.every((pkg) => pkg.version === 3)).toBe(true);
    expect(packages.flatMap((pkg) => pkg.capabilities.recommendedTransitions)).toHaveLength(18);
    expect(packages.flatMap((pkg) => pkg.capabilities.recommendedRepairs)).toEqual([]);
    expect(packages.find((pkg) => pkg.manifest.id === "deploy")?.permissions.externalWrites)
      .toBe("requires-human-authorization");
    expect(packages.filter((pkg) => pkg.manifest.id !== "deploy").every((pkg) => pkg.permissions.externalWrites === false))
      .toBe(true);

    for (const pkg of packages) {
      expect(pkg.format).toBe("ballet-loop-module");
      expect(pkg.loop).toBeDefined();
      expect(Object.hasOwn(pkg, "loops"), pkg.manifest.id).toBe(false);
      expect(pkg.loop.state.initial, pkg.manifest.id).toEqual(pkg.stateContract.initial);
      expect(forbiddenTopologyKeys(pkg), pkg.manifest.id).toEqual([]);
    }
  });

  it("keeps every retained generic module on the strict V3 package contract", async () => {
    const packages = await readPackages();
    expect(packages.length).toBeGreaterThan(graphEngineeringIds.length);
    expect(new Set(packages.map((pkg) => pkg.manifest.id)).size).toBe(packages.length);
    for (const pkg of packages) {
      expect(pkg.version, pkg.manifest.id).toBe(3);
      expect(pkg.capabilities).toHaveProperty("recommendedTransitions");
      expect(pkg.capabilities).toHaveProperty("recommendedRepairs");
      expect(Object.hasOwn(pkg.capabilities, "recommendedConnections"), pkg.manifest.id).toBe(false);
    }
  });
});

describe("Loop Module V3 lifecycle", () => {
  it("preserves capabilities, State contract, provenance, and hashes through install/export", async () => {
    for (const pkg of await readPackages("graph-engineering")) {
      const root = await emptyProject();
      const modules = service(root);
      const source = `graph-engineering:${pkg.manifest.id}`;
      const inspection = modules.inspect(pkg, source);
      expect(inspection).toMatchObject({ valid: true, issues: [], sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });

      const plan = await modules.plan({ package: pkg, source });
      expect(plan.canInstall, pkg.manifest.id).toBe(true);
      const installed = await modules.commit({ package: pkg, source, expectedPlanHash: plan.planHash });
      expect(installed).toMatchObject({
        packageSha256: inspection.sha256,
        stateContract: pkg.stateContract,
        capabilities: pkg.capabilities,
        installedContentSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        status: "exact"
      });

      const exported = await modules.exportLoop({ loopId: installed.loopId });
      expect(exported.package.version).toBe(3);
      expect(exported.package.capabilities).toEqual(pkg.capabilities);
      expect(exported.package.stateContract).toEqual(pkg.stateContract);
      expect(exported.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect((await modules.statuses())[0]).toMatchObject({ status: "exact", packageSha256: inspection.sha256 });
    }
  });
});

const readPackages = async (category?: string): Promise<LoopModulePackageV3[]> => {
  const library = path.resolve(".ballet/loop-library");
  const categories = (await readdir(library, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && (!category || entry.name === category));
  const files = (await Promise.all(categories.map(async (entry) => {
    const directory = path.join(library, entry.name);
    return (await readdir(directory)).filter((name) => name.endsWith(".ballet-loop.json"))
      .map((name) => path.join(directory, name));
  }))).flat().sort();
  return Promise.all(files.map(async (file) => loopModulePackageV3Schema.parse(JSON.parse(await readFile(file, "utf8")))));
};

const forbiddenTopologyKeys = (value: unknown, currentPath = "$"): string[] => {
  if (Array.isArray(value)) return value.flatMap((entry, index) => forbiddenTopologyKeys(entry, `${currentPath}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, entry]) =>
    /^(?:graph|loopEdges|targetLoopId|peerLoopId|nextLoopId|repairTargetLoopId|continuationLoopId)$/i.test(key)
      ? [`${currentPath}.${key}`]
      : forbiddenTopologyKeys(entry, `${currentPath}.${key}`));
};

const emptyProject = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-v3-library-"));
  roots.push(root);
  await mkdir(path.join(root, ".ballet/instructions"), { recursive: true });
  await writeFile(path.join(root, ".ballet/instructions/orchestrator.md"), "---\nid: orchestrator\ntitle: Orchestrator\n---\nRoute repairs through the allowlist.\n");
  await writeFile(path.join(root, ".ballet/project.json"), JSON.stringify({
    version: 13,
    executionProfiles: [executionProfile()],
    issueTracker: {
      kind: "tk", testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
      orchestrationDirectory: ".tickets/orchestration", workDirectory: ".tickets/work"
    },
    orchestrator: { mode: "runbook", maxTransitions: 256 },
    graph: { id: "test-graph", name: "Test Graph", startLoopId: "", transitions: [], repairEdges: [] },
    loops: []
  }, null, 2));
  return root;
};

const executionProfile = () => ({
  id: "codex-test",
  name: "Codex test",
  provider: "codex" as const,
  model: "test",
  reasoningEffort: "medium" as const,
  networkAccess: false
});

const service = (root: string) => new LoopModuleService(() => root, {
  runtimeDatabase: () => ({ activeLoopIds: () => [] })
} as unknown as RuntimeDatabaseProvider);
