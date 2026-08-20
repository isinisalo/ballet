import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loopModulePackageV1Schema } from "../../shared/api/loop-module-schemas.js";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import type { ProjectAutomationConfig, ProjectLoop } from "../../shared/domain/automation.js";
import type { LoopModulePackageV1 } from "../../shared/domain/loopModules.js";
import { validateProjectAutomationConfig } from "../../backend/automation/validateAutomationConfig.js";
import { LoopModuleService } from "../../backend/loop-modules/LoopModuleService.js";
import type { RuntimeDatabaseProvider } from "../../backend/services/RuntimeDatabaseProvider.js";
import { buildGraphEngineeringProjection } from "../../frontend/src/workspace/automation/loops/engineeringProjections.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("Phase 6 project-local Loop responsibility and starter library", () => {
  it("materializes each project Loop with one explicit done-condition and one strict capability boundary", async () => {
    const config = projectConfigSchema.parse(JSON.parse(await readFile(".ballet/project.json", "utf8")));
    const splitIds = [
      "arc42-solution-strategy",
      "arc42-building-block-view",
      "arc42-runtime-deployment",
      "arc42-crosscutting-concepts",
      "arc42-architecture-decision"
    ];

    expect(config.loops.map((loop) => loop.id)).not.toEqual(expect.arrayContaining([
      "arc42-design-structures",
      "arc42-design-concepts"
    ]));
    expect(config.loops.map((loop) => loop.id)).toEqual(expect.arrayContaining(splitIds));
    for (const loop of config.loops) {
      expect(loop.description, loop.id).toMatch(/\bDone when\b/);
      expect(loop.capabilities.accepts, loop.id).toHaveLength(1);
      expect(loop.capabilities.provides, loop.id).toHaveLength(1);
    }
    for (const loopId of splitIds) expect(config.loops.find((loop) => loop.id === loopId)?.nodes).toHaveLength(1);

    const loops = new Map(config.loops.map((loop) => [loop.id, loop]));
    for (const edge of config.graph.loopEdges) {
      if (edge.kind === "flow") {
        expect(loops.get(edge.source)?.capabilities.provides, edge.id).toContain(edge.capability);
        expect(loops.get(edge.target)?.capabilities.accepts, edge.id).toContain(edge.capability);
      } else {
        expect(loops.get(edge.target)?.capabilities.provides, edge.id).toContain(edge.capability);
      }
    }
    const projection = buildGraphEngineeringProjection({
      config: { version: 11, orchestrator: config.orchestrator, graph: config.graph, loops: config.loops }
    });
    expect(projection.orchestrator.id).toBe("loop-orchestrator");
    expect(projection.nodes).toHaveLength(config.loops.length);
    expect(projection.edges).toHaveLength(config.graph.loopEdges.length);
    expect(projection.nodes.reduce((count, node) => count + node.workLoopNodeCount, 0)).toBe(20);
  });

  it("keeps every starter as one strict-valid, target-independent Loop package", async () => {
    const packages = await readPackages();
    const starterIds = [
      "clarify-specification",
      "solution-strategy",
      "architecture-decision",
      "ui-mock",
      "ui-design",
      "implementation",
      "deploy-dev"
    ];
    expect(packages.map((pkg) => pkg.manifest.id)).toEqual(expect.arrayContaining(starterIds));

    const project = projectConfigSchema.parse(JSON.parse(await readFile(".ballet/project.json", "utf8")));
    const peerIds = [...new Set([
      ...project.loops.map((loop) => loop.id),
      ...packages.map((pkg) => pkg.manifest.id)
    ])].filter((id) => id.includes("-"));
    for (const pkg of packages) {
      expect(pkg.loop).toBeDefined();
      expect(Object.hasOwn(pkg, "loops"), pkg.manifest.id).toBe(false);
      expect(pkg.loop.description, pkg.manifest.id).toMatch(/\bDone when\b/);
      expect(pkg.capabilities.accepts, pkg.manifest.id).toHaveLength(1);
      expect(pkg.capabilities.provides, pkg.manifest.id).toHaveLength(1);
      expect(pkg.loop.state.initial, pkg.manifest.id).toEqual(pkg.stateContract.initial);
      expect(forbiddenTopologyKeys(pkg), pkg.manifest.id).toEqual([]);
      const reusableContent = [
        ...pkg.resources.flatMap((resource) => [resource.title, resource.description, resource.body]),
        ...pkg.loop.nodes.flatMap((node) => [node.description, node.work.task, node.validation.task])
      ];
      expect(peerReferences(reusableContent, peerIds.filter((id) => id !== pkg.manifest.id)), pkg.manifest.id).toEqual([]);
    }
  });
});

describe("Phase 6 Loop package lifecycle and capability substitution", () => {
  it("preserves capabilities, State contract, provenance and hashes through install/export for every pilot starter", async () => {
    const packages = (await readPackages()).filter((pkg) => [
      "clarify-specification",
      "solution-strategy",
      "architecture-decision",
      "ui-mock",
      "ui-design",
      "implementation",
      "deploy-dev"
    ].includes(pkg.manifest.id));

    for (const pkg of packages) {
      const root = await emptyProject();
      const modules = service(root);
      const source = `test-library:${pkg.manifest.id}`;
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
      expect(exported.package.capabilities).toEqual(pkg.capabilities);
      expect(exported.package.stateContract).toEqual(pkg.stateContract);
      expect(exported.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect((await modules.statuses())[0]).toMatchObject({ status: "exact", packageSha256: inspection.sha256 });
    }
  });

  it("swaps a capability-compatible implementation target by changing only graph edge data", async () => {
    const packages = await readPackages();
    const alternatives = packages.filter((pkg) => [
      "implementation",
      "backend-implementation",
      "frontend-implementation"
    ].includes(pkg.manifest.id));
    expect(alternatives).toHaveLength(3);
    for (const pkg of alternatives) {
      expect(pkg.capabilities.accepts).toEqual(["implementation:change.requested"]);
      expect(pkg.capabilities.provides).toEqual(["implementation:change.ready"]);
      expect(pkg.stateContract.id).toBe("software-engineering-state");
    }

    const sourceLoop = implementationSource();
    const targets = alternatives.map((pkg) => targetLoop(pkg.manifest.id));
    const sourceBefore = structuredClone(sourceLoop);
    const packageBefore = alternatives.map((pkg) => JSON.stringify(pkg));
    const profile = executionProfile();
    for (const target of targets) {
      const automation: ProjectAutomationConfig = {
        version: 11,
        orchestrator: { executionProfileId: profile.id, primaryInstructionId: "project:orchestrator", skillIds: [], maxRepairDepth: 4, maxRepairAttempts: 3 },
        graph: { loopEdges: [{
          id: `implementation-route-${target.id}`,
          source: sourceLoop.id,
          target: target.id,
          kind: "flow",
          capability: "implementation:change.requested",
          description: "Operator-owned capability-compatible implementation route."
        }] },
        loops: [sourceLoop, target]
      };
      expect(validateProjectAutomationConfig(automation, [profile])).toEqual([]);
    }
    expect(sourceLoop).toEqual(sourceBefore);
    expect(alternatives.map((pkg) => JSON.stringify(pkg))).toEqual(packageBefore);
  });
});

const readPackages = async (): Promise<LoopModulePackageV1[]> => {
  const library = path.resolve(".ballet/loop-library");
  const categories = await readdir(library, { withFileTypes: true });
  const files = (await Promise.all(categories.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const directory = path.join(library, entry.name);
    return (await readdir(directory)).filter((name) => name.endsWith(".ballet-loop.json"))
      .map((name) => path.join(directory, name));
  }))).flat().sort();
  return Promise.all(files.map(async (file) => loopModulePackageV1Schema.parse(JSON.parse(await readFile(file, "utf8")))));
};

const forbiddenTopologyKeys = (value: unknown, currentPath = "$"): string[] => {
  if (Array.isArray(value)) return value.flatMap((entry, index) => forbiddenTopologyKeys(entry, `${currentPath}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, entry]) =>
    /^(?:graph|loopEdges|targetLoopId|peerLoopId|nextLoopId|repairTargetLoopId|continuationLoopId)$/i.test(key)
      ? [`${currentPath}.${key}`]
      : forbiddenTopologyKeys(entry, `${currentPath}.${key}`));
};

const peerReferences = (value: unknown, peerIds: string[], currentPath = "$"): string[] => {
  if (typeof value === "string") return peerIds
    .filter((peer) => new RegExp(`(^|[^a-z0-9-])${peer}([^a-z0-9-]|$)`, "i").test(value))
    .map((peer) => `${currentPath}:${peer}`);
  if (Array.isArray(value)) return value.flatMap((entry, index) => peerReferences(entry, peerIds, `${currentPath}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, entry]) => peerReferences(entry, peerIds, `${currentPath}.${key}`));
};

const emptyProject = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-phase6-library-"));
  roots.push(root);
  await mkdir(path.join(root, ".ballet/instructions"), { recursive: true });
  await writeFile(path.join(root, ".ballet/instructions/orchestrator.md"), "---\nid: orchestrator\ntitle: Orchestrator\n---\nRoute by capability.\n");
  await writeFile(path.join(root, ".ballet/project.json"), JSON.stringify({
    version: 11,
    executionProfiles: [executionProfile()],
    orchestrator: { executionProfileId: "codex-test", primaryInstructionId: "project:orchestrator", skillIds: [], maxRepairDepth: 4, maxRepairAttempts: 3 },
    graph: { loopEdges: [] },
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

const implementationSource = (): ProjectLoop => ({
  id: "implementation-request-source",
  description: "Produce one implementation request for a capability-compatible target.",
  capabilities: { accepts: ["test:entry.requested"], provides: ["implementation:change.requested"] },
  state: { description: "Swap test State.", initial: {} },
  startNodeId: "request",
  nodes: [{
    id: "request",
    description: "Produce an implementation request.",
    work: { type: "human", task: "Produce the request.", nodeStyle: "terra", nodeSize: "small" },
    validation: { type: "human", task: "Validate the request.", nodeStyle: "luna", nodeSize: "small" },
    maxLocalAttempts: 3
  }],
  edges: [{ id: "request-completed", source: "request", target: { terminal: "completed" } }]
});

const targetLoop = (id: string): ProjectLoop => ({
  id,
  description: `Capability-compatible ${id}.`,
  capabilities: { accepts: ["implementation:change.requested"], provides: ["implementation:change.ready"] },
  state: { description: "Swap test State.", initial: {} },
  startNodeId: `${id}-task`,
  nodes: [{
    id: `${id}-task`,
    description: "Implement the request.",
    work: { type: "human", task: "Implement.", nodeStyle: "terra", nodeSize: "small" },
    validation: { type: "human", task: "Validate.", nodeStyle: "luna", nodeSize: "small" },
    maxLocalAttempts: 3
  }],
  edges: [{ id: `${id}-completed`, source: `${id}-task`, target: { terminal: "completed" } }]
});
