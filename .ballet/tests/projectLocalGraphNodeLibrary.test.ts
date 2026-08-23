import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { graphNodeModulePackageV6Schema } from "../../shared/api/graph-node-module-schemas.js";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import type { GraphNodeModulePackageV6 } from "../../shared/domain/graphNodeModules.js";
import { GraphNodeModuleService } from "../../backend/graph-node-modules/GraphNodeModuleService.js";
import type { RuntimeDatabaseProvider } from "../../backend/services/RuntimeDatabaseProvider.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("project-local Graph Engineering strict v18", () => {
  it("contains one global Reward-MDP, five options and 17 ordered Action Nodes", async () => {
    const config = projectConfigSchema.parse(JSON.parse(await readFile(".ballet/project.json", "utf8")));
    expect(config.version).toBe(18);
    expect(config.graph.graphNodes.map(({ id }) => id)).toEqual(["design", "plan", "build", "deploy", "verify"]);
    expect(config.graph.graphNodes.flatMap(({ actionNodes }) => actionNodes)).toHaveLength(17);
    expect(config.graph.strategy.kind).toBe("reward_mdp_v3");
    expect(config.graph.strategy.model.discountPpm).toBe(990_000);
    expect(config.graph.strategy.model.states).toHaveLength(63);
    expect(config.graph.strategy.model.stateActions.some(({ stateId }) =>
      config.graph.strategy.model.stateActions.filter((row) => row.stateId === stateId).length >= 2)).toBe(true);
    expect(config.graph.strategy.model.stateActions.every(({ successors }) =>
      successors.reduce((sum, branch) => sum + branch.probabilityPpm, 0) === 1_000_000
      && successors.every(({ provenance }) => provenance === "default_prior"))).toBe(true);
    expect(JSON.stringify(config)).not.toMatch(/agent_v1|repairNode|RepairNode/);
  });

  it("publishes 14 strict Graph Node Module v6 packages without local policy or Repair resources", async () => {
    const packages = await readPackages();
    expect(packages).toHaveLength(14);
    expect(new Set(packages.map(({ manifest }) => manifest.id)).size).toBe(14);
    for (const pkg of packages) {
      expect(pkg).toMatchObject({ format: "ballet-graph-node-module", version: 6 });
      expect(pkg.graphNode.actionNodes.length).toBeGreaterThan(0);
      expect(pkg.graphNode.outcomes.length).toBeGreaterThan(0);
      expect(pkg.graphNode).not.toHaveProperty("strategy");
      expect(pkg.graphNode).not.toHaveProperty("repairNode");
      expect(JSON.stringify(pkg.resources)).not.toMatch(/Graph Node Orchestrator|Repair Node/);
      expect(peerGraphTargetPaths(pkg)).toEqual([]);
    }
  });

  it("roundtrips every v6 package through inspect, plan, install, export and remove", async () => {
    for (const pkg of await readPackages()) {
      const root = await emptyProject(pkg.stateContract.requiredKeys);
      const modules = service(root);
      const source = `library:${pkg.manifest.id}`;
      const inspection = modules.inspect(pkg, source);
      expect(inspection.valid, pkg.manifest.id).toBe(true);
      const mappings = Object.fromEntries(pkg.profileSlots.map((slot) => [
        slot.key,
        slot.network === "required" ? "sol-network-on" : "sol-network-off"
      ]));
      if (pkg.profileSlots.length) {
        const unmapped = await modules.plan({ package: pkg, source });
        expect(unmapped.canInstall, pkg.manifest.id).toBe(false);
        expect(unmapped.issues.some(({ code }) => code === "PROFILE_MAPPING_REQUIRED")).toBe(true);
      }
      const plan = await modules.plan({ package: pkg, source, profileMappings: mappings });
      expect(plan.canInstall, `${pkg.manifest.id}: ${JSON.stringify(plan.issues)}`).toBe(true);
      const installed = await modules.commit({
        package: pkg,
        source,
        profileMappings: mappings,
        expectedPlanHash: plan.planHash
      });
      expect(installed).toMatchObject({
        graphNodeId: pkg.manifest.id,
        packageSha256: inspection.sha256,
        status: "exact"
      });
      const exported = await modules.exportGraphNode({ graphNodeId: installed.graphNodeId });
      expect(exported.package).toMatchObject({ format: "ballet-graph-node-module", version: 6 });
      expect(exported.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect((await modules.statuses())[0]).toMatchObject({ graphNodeId: installed.graphNodeId, status: "exact" });
      await modules.remove(installed.graphNodeId);
      expect(await modules.statuses()).toEqual([]);
    }
  });
});

const readPackages = async (): Promise<GraphNodeModulePackageV6[]> => {
  const library = path.resolve(".ballet/graph-node-library");
  const categories = (await readdir(library, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  const files = (await Promise.all(categories.map(async (entry) =>
    (await readdir(path.join(library, entry.name)))
      .filter((name) => name.endsWith(".ballet-graph-node.json"))
      .map((name) => path.join(library, entry.name, name))))).flat().sort();
  return Promise.all(files.map(async (file) =>
    graphNodeModulePackageV6Schema.parse(JSON.parse(await readFile(file, "utf8")))));
};

const peerGraphTargetPaths = (value: unknown, current = "$"): string[] => {
  if (Array.isArray(value)) return value.flatMap((entry, index) => peerGraphTargetPaths(entry, `${current}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) =>
    /^(?:graphNodeId|peerGraphNode|targetGraphNode)$/i.test(key)
      ? [`${current}.${key}`] : peerGraphTargetPaths(child, `${current}.${key}`));
};

const emptyProject = async (requiredKeys: string[]): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-v6-module-"));
  roots.push(root);
  await mkdir(path.join(root, ".ballet"), { recursive: true });
  await writeFile(path.join(root, ".ballet/project.json"), JSON.stringify({
    version: 18,
    executionProfiles: [
      { id: "sol-network-off", name: "Sol off", provider: "codex", model: "gpt-5.6-sol", reasoningEffort: "high", networkAccess: false },
      { id: "sol-network-on", name: "Sol on", provider: "codex", model: "gpt-5.6-sol", reasoningEffort: "high", networkAccess: true }
    ],
    issueTracker: {
      kind: "tk",
      testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
      orchestrationDirectory: ".tickets/orchestration",
      workDirectory: ".tickets/work"
    },
    graph: {
      id: "test-graph",
      name: "Test Graph",
      state: { description: "Test state", initial: Object.fromEntries(requiredKeys.map((key) => [key, null])) },
      strategy: baseStrategy(),
      graphNodes: [baseGraphNode("alpha"), baseGraphNode("beta")]
    }
  }, null, 2));
  return root;
};

const baseStrategy = () => ({
  kind: "reward_mdp_v3",
  id: "test-policy",
  description: "Test Reward-MDP",
  capabilityModel: {
    version: 3,
    outcomes: [
      { id: "alpha-pass", description: "Alpha passes", result: "PASS", penaltyClass: "none" },
      { id: "beta-pass", description: "Beta passes", result: "PASS", penaltyClass: "none" }
    ],
    actions: [{ actionId: "alpha", guards: [] }, { actionId: "beta", guards: [] }]
  },
  model: {
    version: 3,
    discountPpm: 990_000,
    acceptance: { version: 1, obligations: [{ obligationId: "accepted", description: "Accepted", weight: 1 }] },
    reward: {
      actionCostMicros: 1_000_000,
      completionBonusMicros: 25_000_000,
      progressPotentialScaleMicros: 100_000_000,
      outcomePenaltyMicros: { none: 0, transient: 2_000_000, implementation_defect: 5_000_000, invalid_plan: 12_000_000, invalid_design: 25_000_000 }
    },
    features: [],
    states: [
      { id: "open", values: {}, verifiedObligationIds: [], invalidatedObligationIds: [] },
      { id: "done", values: {}, verifiedObligationIds: ["accepted"], invalidatedObligationIds: [], terminal: "success" }
    ],
    stateActions: [
      { stateId: "open", actionId: "alpha", successors: [{ outcomeId: "alpha-pass", nextStateId: "done", probabilityPpm: 1_000_000, provenance: "default_prior" }] },
      { stateId: "open", actionId: "beta", successors: [{ outcomeId: "beta-pass", nextStateId: "done", probabilityPpm: 1_000_000, provenance: "default_prior" }] }
    ],
    solver: { algorithm: "discounted_value_iteration_v3", maxIterations: 1_000, convergenceToleranceMicros: 1 }
  }
});

const baseGraphNode = (id: "alpha" | "beta") => ({
  id,
  description: id,
  capabilities: { accepts: [], provides: [] },
  outcomes: [{ outcomeId: `${id}-pass`, result: "PASS" }],
  stateContract: { description: "Test state" },
  actionNodes: [{
    id: `${id}-job`,
    description: `${id} job`,
    capabilities: { accepts: [], provides: [] },
    outcomes: [{ outcomeId: `${id}-pass`, result: "PASS" }],
    maxRetries: 0,
    workNode: { id: `${id}-work`, type: "human", description: "Work", task: "Work", nodeStyle: "flat", nodeSize: "medium" },
    validationNode: { id: `${id}-validation`, type: "human", description: "Validate", task: "Validate", nodeStyle: "flat", nodeSize: "medium" }
  }]
});

const service = (root: string) => new GraphNodeModuleService(() => root, {
  runtimeDatabase: () => ({ activeGraphNodeIds: () => new Set<string>() })
} as unknown as RuntimeDatabaseProvider);
