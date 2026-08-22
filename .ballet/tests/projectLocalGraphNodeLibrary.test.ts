import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { graphNodeModulePackageV4Schema } from "../../shared/api/graph-node-module-schemas.js";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import type { GraphNodeModulePackageV4 } from "../../shared/domain/graphNodeModules.js";
import { GraphNodeModuleService } from "../../backend/graph-node-modules/GraphNodeModuleService.js";
import { ProjectConfigurationSourceError } from "../../backend/project-config/ProjectConfigurationRepository.js";
import type { RuntimeDatabaseProvider } from "../../backend/services/RuntimeDatabaseProvider.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("project-local Graph Engineering v14", () => {
  it("contains five Graph Nodes and 17 aggregate Job Nodes with Luna/Sol agents", async () => {
    const config = projectConfigSchema.parse(JSON.parse(await readFile(".ballet/project.json", "utf8")));
    expect(config.version).toBe(14);
    expect(config.graph.graphNodes.map(({ id }) => id)).toEqual(["design","plan","build","deploy","verify"]);
    expect(config.graph.graphNodes.flatMap(({ jobNodes }) => jobNodes)).toHaveLength(17);
    expect(config.graph.graphNodes.flatMap(({ jobNodes }) => jobNodes)
      .every((job) => job.workNode && job.validationNode)).toBe(true);
    expect(config.graph.orchestrator).toMatchObject({
      nodeStyle: "luna",
      executionProfileId: "codex-gpt-5-6-luna-medium-network-off",
      maxRouteAttempts: 3,
      maxTransitions: 256
    });
    expect(config.graph.repairNode).toMatchObject({
      nodeStyle: "sol",
      executionProfileId: "codex-gpt-5-6-sol-medium-network-off",
      maxRepairAttempts: 3,
      maxRepairDepth: 3
    });
    for (const graphNode of config.graph.graphNodes) {
      expect(graphNode.orchestrator.executionProfileId).toBe("codex-gpt-5-6-luna-medium-network-off");
      expect(graphNode.repairNode?.executionProfileId).toBe("codex-gpt-5-6-sol-medium-network-off");
    }
  });

  it("publishes 14 strict Graph Node Module v4 packages without peer targets", async () => {
    const packages = await readPackages();
    expect(packages).toHaveLength(14);
    expect(new Set(packages.map(({ manifest }) => manifest.id)).size).toBe(14);
    for (const pkg of packages) {
      expect(pkg).toMatchObject({ format: "ballet-graph-node-module", version: 4 });
      expect(pkg.graphNode.jobNodes.length).toBeGreaterThan(0);
      expect(pkg.graphNode.orchestrator).toBeDefined();
      expect(pkg.graphNode.repairNode).toBeDefined();
      expect(peerGraphTargetPaths(pkg)).toEqual([]);
    }
  });

  it("roundtrips all packages through inspect, plan, install, export and remove", async () => {
    for (const pkg of await readPackages()) {
      const root = await emptyProject(pkg.stateContract.requiredKeys);
      const modules = service(root);
      const source = `library:${pkg.manifest.id}`;
      const inspection = modules.inspect(pkg, source);
      expect(inspection.valid, pkg.manifest.id).toBe(true);
      const mappings = Object.fromEntries(pkg.profileSlots.map((slot) => [
        slot.key,
        /sol|repair/i.test(`${slot.key} ${slot.title}`) ? "sol" : "luna"
      ]));
      const unmapped = await modules.plan({ package: pkg, source });
      expect(unmapped.canInstall, pkg.manifest.id).toBe(false);
      expect(unmapped.issues.some(({ code }) => code === "PROFILE_MAPPING_REQUIRED")).toBe(true);
      const plan = await modules.plan({ package: pkg, source, profileMappings: mappings });
      expect(plan.canInstall, `${pkg.manifest.id}: ${JSON.stringify(plan.issues)}`).toBe(true);
      const installed = await modules.commit({
        package: pkg, source, profileMappings: mappings, expectedPlanHash: plan.planHash
      }).catch((error: unknown) => {
        if (error instanceof ProjectConfigurationSourceError) {
          throw new Error(`${pkg.manifest.id}: ${JSON.stringify(error.issues)}`);
        }
        throw error;
      });
      expect(installed).toMatchObject({
        graphNodeId: pkg.manifest.id,
        packageSha256: inspection.sha256,
        status: "exact"
      });
      const exported = await modules.exportGraphNode({ graphNodeId: installed.graphNodeId });
      expect(exported.package).toMatchObject({ format: "ballet-graph-node-module", version: 4 });
      expect(exported.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect((await modules.statuses())[0]).toMatchObject({ graphNodeId: installed.graphNodeId, status: "exact" });
      await modules.remove(installed.graphNodeId);
      expect(await modules.statuses()).toEqual([]);
    }
  });
});

const readPackages = async (): Promise<GraphNodeModulePackageV4[]> => {
  const library = path.resolve(".ballet/graph-node-library");
  const categories = (await readdir(library, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  const files = (await Promise.all(categories.map(async (entry) =>
    (await readdir(path.join(library, entry.name)))
      .filter((name) => name.endsWith(".ballet-graph-node.json"))
      .map((name) => path.join(library, entry.name, name))))).flat().sort();
  return Promise.all(files.map(async (file) =>
    graphNodeModulePackageV4Schema.parse(JSON.parse(await readFile(file, "utf8")))));
};

const peerGraphTargetPaths = (value: unknown, current = "$"): string[] => {
  if (Array.isArray(value)) return value.flatMap((entry, index) => peerGraphTargetPaths(entry, `${current}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) =>
    /^(?:graphNodeId|peerGraphNode|targetGraphNode)$/i.test(key)
      ? [`${current}.${key}`] : peerGraphTargetPaths(child, `${current}.${key}`));
};

const emptyProject = async (requiredKeys: string[]): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-v4-module-"));
  roots.push(root);
  await mkdir(path.join(root, ".ballet/instructions"), { recursive: true });
  await Promise.all(["global-orch","global-repair","local-orch","local-repair"].map((id) =>
    writeFile(path.join(root, `.ballet/instructions/${id}.md`),
      `---\nid: ${id}\ntitle: ${id}\n---\nOperate only inside the immutable candidate set.\n`)));
  await writeFile(path.join(root, ".ballet/project.json"), JSON.stringify({
    version: 14,
    executionProfiles: [
      { id: "luna", name: "Luna", provider: "codex", model: "gpt-5.6-luna", reasoningEffort: "medium", networkAccess: false },
      { id: "sol", name: "Sol", provider: "codex", model: "gpt-5.6-sol", reasoningEffort: "medium", networkAccess: false }
    ],
    issueTracker: {
      kind: "tk", testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
      orchestrationDirectory: ".tickets/orchestration", workDirectory: ".tickets/work"
    },
    graph: {
      id: "test-graph", name: "Test Graph",
      state: { description: "Test state", initial: Object.fromEntries(requiredKeys.map((key) => [key, null])) },
      orchestrator: orchestrator("global", "global-orch", [
        { target: { graphNodeId: "placeholder" }, description: "Placeholder" },
        terminal("PASS"), terminal("FAIL")
      ], "placeholder"),
      repairNode: repair("global-repair", "global-repair"),
      graphNodes: [{
        id: "placeholder", description: "Placeholder", nodeStyle: "vector-planet", nodeSize: "medium",
        capabilities: { accepts: ["test:input"], provides: ["test:output"] },
        stateContract: { description: "Test state" },
        orchestrator: orchestrator("local", "local-orch", [
          { target: { jobNodeId: "placeholder-job" }, description: "Placeholder job" },
          terminal("PASS"), terminal("FAIL")
        ], "placeholder-job"),
        repairNode: repair("local-repair", "local-repair"),
        jobNodes: [{
          id: "placeholder-job", description: "Placeholder Job", nodeStyle: "vector-planet", nodeSize: "medium",
          capabilities: { accepts: ["test:input"], provides: ["test:output"] }, maxRetries: 1,
          workNode: {
            id: "placeholder-work", type: "human", description: "Work", task: "Work",
            nodeStyle: "vector-planet", nodeSize: "medium"
          },
          validationNode: {
            id: "placeholder-validation", type: "human", description: "Validate", task: "Validate",
            nodeStyle: "vector-planet", nodeSize: "medium"
          }
        }]
      }]
    }
  }, null, 2));
  return root;
};

const orchestrator = (
  id: string, instruction: string, startCandidates: unknown[], childId: string
) => ({
  id, description: "Route", nodeStyle: "luna", nodeSize: "medium",
  executionProfileId: "luna", primaryInstructionId: `project:${instruction}`, skillIds: [],
  maxTransitions: 256, maxRouteAttempts: 3,
  routing: {
    start: { id: `${id}-start`, candidates: startCandidates },
    continuation: [
      { id: `${id}-pass`, sourceId: childId, result: "PASS", candidates: [terminal("PASS"), terminal("FAIL")] },
      { id: `${id}-fail`, sourceId: childId, result: "FAIL", candidates: [terminal("PASS"), terminal("FAIL")] }
    ],
    repair: []
  }
});
const repair = (id: string, instruction: string) => ({
  id, description: "Repair", task: "Repair", nodeStyle: "sol", nodeSize: "medium",
  executionProfileId: "sol", primaryInstructionId: `project:${instruction}`, skillIds: [],
  maxRepairDepth: 3, maxRepairAttempts: 3
});
const terminal = (result: "PASS" | "FAIL") => ({
  target: { terminal: result }, description: result
});
const service = (root: string) => new GraphNodeModuleService(() => root, {
  runtimeDatabase: () => ({ activeGraphNodeIds: () => new Set<string>() })
} as unknown as RuntimeDatabaseProvider);
