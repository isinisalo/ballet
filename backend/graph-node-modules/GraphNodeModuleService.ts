import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { graphNodeModulePackageV6Schema } from "../../shared/api/graph-node-module-schemas.js";
import type {
  GraphNodeModuleExportResult,
  GraphNodeModuleInspection,
  GraphNodeModuleInstallPlan,
  GraphNodeModuleIssue,
  GraphNodeModuleLibraryEntry,
  GraphNodeModulePackageV6,
  InstalledGraphNodeModuleStatus,
  InstalledGraphNodeModulesFileV6
} from "../../shared/domain/graphNodeModules.js";
import { loadProjectResources } from "../documents/projectResourceCatalog.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import type { RuntimeDatabaseProvider } from "../services/RuntimeDatabaseProvider.js";
import {
  dematerializeGraphNode,
  graphNodeCompositions,
  renderResource
} from "./GraphNodeModuleMapping.js";
import {
  canonicalModuleJson,
  createModulePlan,
  installedModuleRecord,
  installedModulesPath,
  installModuleGraphNode,
  invalidModuleInspection,
  moduleContentHash,
  moduleExportResources,
  moduleSha256,
  moduleSourceIssues,
  removeModuleGraphNode,
  walkModuleLibrary
} from "./GraphNodeModuleOperations.js";

export class GraphNodeModuleError extends Error {
  constructor(message: string, readonly issues: GraphNodeModuleIssue[]) {
    super(message);
    this.name = "GraphNodeModuleError";
  }
}

export class GraphNodeModuleService {
  private readonly projects = new ProjectConfigurationRepository();
  constructor(private readonly root: () => string, private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider) {}

  inspect(input: unknown, source = "local-import"): GraphNodeModuleInspection {
    let value = input;
    if (typeof input === "string") {
      try { value = JSON.parse(input) as unknown; }
      catch { return invalidModuleInspection(source, input, "INVALID_JSON", "Package is not valid JSON."); }
    }
    const raw = JSON.stringify(value);
    if (Buffer.byteLength(raw, "utf8") > 524_288) return invalidModuleInspection(
      source, raw, "PACKAGE_TOO_LARGE", "Package exceeds 524288 bytes."
    );
    if (isRecord(value) && (value.format !== "ballet-graph-node-module" || value.version !== 6)) {
      return invalidModuleInspection(source, raw, "SCHEMA_DOWNGRADE", "Only Graph Node Module v6 packages are accepted.");
    }
    const parsed = graphNodeModulePackageV6Schema.safeParse(value);
    if (!parsed.success) return {
      valid: false, source, sizeBytes: Buffer.byteLength(raw, "utf8"),
      issues: parsed.error.issues.map((issue) => ({
        code: issue.code === "unrecognized_keys" ? "UNKNOWN_FIELD" : "INVALID_SCHEMA",
        path: issue.path.map(String).join("."), message: issue.message
      }))
    };
    const canonicalJson = canonicalModuleJson(parsed.data);
    return {
      valid: true, package: parsed.data, canonicalJson, sha256: moduleSha256(canonicalJson), source,
      sizeBytes: Buffer.byteLength(canonicalJson, "utf8"), issues: []
    };
  }

  async listLibrary(): Promise<GraphNodeModuleLibraryEntry[]> {
    const directory = path.join(this.root(), ".ballet", "graph-node-library");
    const files = await walkModuleLibrary(directory).catch(() => []);
    return Promise.all(files.filter((file) => file.endsWith(".ballet-graph-node.json")).sort().map(async (filename) => {
      const source = path.relative(this.root(), filename);
      const inspection = this.inspect(await readFile(filename, "utf8"), source);
      return {
        source, sha256: inspection.sha256, sizeBytes: inspection.sizeBytes, valid: inspection.valid,
        manifest: inspection.package?.manifest, permissions: inspection.package?.permissions,
        package: inspection.package, issues: inspection.issues
      };
    }));
  }

  async plan(input: {
    package: unknown; source: string; profileMappings?: Record<string, string>;
  }): Promise<GraphNodeModuleInstallPlan> {
    const inspection = this.inspect(input.package, input.source);
    if (!inspection.valid || !inspection.package || !inspection.sha256) throw new GraphNodeModuleError(
      "Graph Node Module is invalid.", inspection.issues
    );
    const loaded = this.projects.load(this.root());
    if (!loaded.config) throw new GraphNodeModuleError("Project configuration is invalid.", moduleSourceIssues(loaded.issues));
    return createModulePlan(inspection.package, inspection.sha256, input.source, input.profileMappings ?? {}, loaded.config);
  }

  async commit(input: {
    package: unknown; source: string; profileMappings?: Record<string, string>; expectedPlanHash: string;
  }): Promise<InstalledGraphNodeModuleStatus> {
    const plan = await this.plan(input);
    if (plan.planHash !== input.expectedPlanHash) throw new GraphNodeModuleError("Install plan is stale.", [{
      code: "PLAN_STALE", path: "expectedPlanHash", message: "Re-inspect and approve the current install plan."
    }]);
    if (!plan.canInstall) throw new GraphNodeModuleError("Graph Node Module cannot be installed.", plan.issues);
    const inspection = this.inspect(input.package, input.source);
    const pkg = inspection.package!;
    const loaded = this.projects.load(this.root());
    if (!loaded.config) throw new GraphNodeModuleError("Project configuration is invalid.", []);
    const written: string[] = [];
    try {
      for (const resource of plan.resources) {
        const definition = pkg.resources.find((candidate) => candidate.key === resource.key)!;
        const filename = path.join(this.root(), resource.relativePath);
        await mkdir(path.dirname(filename), { recursive: true });
        await writeFile(filename, renderResource(resource.resourceId, definition), { encoding: "utf8", flag: "wx" });
        written.push(filename);
      }
      const next = installModuleGraphNode(loaded.config, plan.graphNode);
      this.projects.putAutomation(this.root(), { version: 18, graph: next.graph });
      const persisted = this.projects.load(this.root()).config?.graph.graphNodes.find(({ id }) => id === plan.graphNode.id);
      if (!persisted) throw new GraphNodeModuleError("Installed Graph Node was not persisted.", []);
      const record = installedModuleRecord(pkg, inspection.sha256!, input.source, plan, persisted);
      const installed = await this.readInstalled();
      installed.installed.push(record);
      await this.writeInstalled(installed);
      return { ...record, status: "exact", currentContentSha256: record.installedContentSha256, missingResources: [] };
    } catch (error) {
      for (const filename of written.reverse()) await unlink(filename).catch(() => undefined);
      throw error;
    }
  }

  async statuses(): Promise<InstalledGraphNodeModuleStatus[]> {
    const records = await this.readInstalled();
    const loaded = this.projects.load(this.root()).config;
    return Promise.all(records.installed.map(async (record) => {
      const graphNode = loaded?.graph.graphNodes.find(({ id }) => id === record.graphNodeId);
      const missingResources: string[] = [];
      const hashes: Array<{ relativePath: string; sha256: string }> = [];
      for (const resource of record.ownedResources) {
        const source = await readFile(path.join(this.root(), resource.relativePath), "utf8").catch(() => undefined);
        if (source === undefined) missingResources.push(resource.resourceId);
        else hashes.push({ relativePath: resource.relativePath, sha256: moduleSha256(source) });
      }
      const currentContentSha256 = graphNode ? moduleContentHash(graphNode, hashes) : undefined;
      return {
        ...record,
        status: !graphNode || missingResources.length ? "missing-resources"
          : currentContentSha256 === record.installedContentSha256 ? "exact" : "modified",
        currentContentSha256, missingResources
      };
    }));
  }

  async remove(graphNodeId: string): Promise<void> {
    if (this.runtimeDatabaseProvider.runtimeDatabase().activeGraphNodeIds().has(graphNodeId)) throw new GraphNodeModuleError(
      "Graph Node has an active Run.", [{ code: "ACTIVE_RUN", path: "graphNodeId", message: graphNodeId }]
    );
    const installed = await this.readInstalled();
    const record = installed.installed.find((candidate) => candidate.graphNodeId === graphNodeId);
    if (!record) throw new GraphNodeModuleError("Module is not installed.", [{
      code: "MODULE_NOT_INSTALLED", path: "graphNodeId", message: graphNodeId
    }]);
    const loaded = this.projects.load(this.root());
    if (!loaded.config) throw new GraphNodeModuleError("Project configuration is invalid.", []);
    const graph = removeModuleGraphNode(loaded.config, graphNodeId);
    if (!graph) throw new GraphNodeModuleError("A project must retain a Graph Node.", []);
    this.projects.putAutomation(this.root(), { version: 18, graph });
    for (const resource of record.ownedResources) await unlink(path.join(this.root(), resource.relativePath)).catch(() => undefined);
    installed.installed = installed.installed.filter((candidate) => candidate.graphNodeId !== graphNodeId);
    await this.writeInstalled(installed);
  }

  async exportGraphNode(input: {
    graphNodeId: string; title?: string; description?: string; version?: string; category?: string; tags?: string[];
  }): Promise<GraphNodeModuleExportResult> {
    const config = this.projects.load(this.root()).config;
    const graphNode = config?.graph.graphNodes.find(({ id }) => id === input.graphNodeId);
    if (!config || !graphNode) throw new GraphNodeModuleError("Graph Node was not found.", [{
      code: "GRAPH_NODE_NOT_FOUND", path: "graphNodeId", message: input.graphNodeId
    }]);
    const catalog = await loadProjectResources(this.root());
    const compositions = graphNodeCompositions(graphNode);
    const profileIds = [...new Set(compositions.map(({ executionProfileId }) => executionProfileId))].sort();
    const profileSlots = profileIds.map((profileId, index) => {
      const profile = config.executionProfiles.find(({ id }) => id === profileId)!;
      return {
        key: `slot-${index + 1}`, title: profile.name, description: `Map ${profile.name}.`,
        providers: [profile.provider], network: profile.networkAccess ? "required" as const : "forbidden" as const
      };
    });
    const slotByProfile = new Map(profileIds.map((profileId, index) => [profileId, profileSlots[index]!.key]));
    const resources = moduleExportResources(compositions, catalog);
    if (!resources) throw new GraphNodeModuleError("Referenced resource is missing.", []);
    const pkg: GraphNodeModulePackageV6 = {
      format: "ballet-graph-node-module", version: 6,
      manifest: {
        id: graphNode.id, title: input.title ?? graphNode.description,
        description: input.description ?? graphNode.description, version: input.version ?? "1.0.0",
        category: input.category, tags: input.tags ?? []
      },
      permissions: {
        network: profileSlots.some((slot) => slot.network === "required") ? "required" : "forbidden",
        externalWrites: false
      },
      profileSlots,
      stateContract: {
        id: `${graphNode.id}-state`, version: "1.0.0",
        description: graphNode.stateContract.description, requiredKeys: []
      },
      capabilities: { requires: [], accepts: graphNode.capabilities.accepts, provides: graphNode.capabilities.provides },
      resources,
      graphNode: dematerializeGraphNode(graphNode, slotByProfile)
    };
    const parsed = graphNodeModulePackageV6Schema.parse(pkg);
    const canonicalJson = canonicalModuleJson(parsed);
    return { package: parsed, canonicalJson, sha256: moduleSha256(canonicalJson), filename: `${graphNode.id}.ballet-graph-node.json` };
  }

  private async readInstalled(): Promise<InstalledGraphNodeModulesFileV6> {
    const source = await readFile(installedModulesPath(this.root()), "utf8").catch(() => undefined);
    if (!source) return { version: 6, installed: [] };
    const value = JSON.parse(source) as InstalledGraphNodeModulesFileV6;
    if (value.version !== 6 || !Array.isArray(value.installed)) throw new GraphNodeModuleError(
      "Installed module registry is invalid.", [{
        code: "INVALID_SCHEMA", path: ".ballet/graph-node-modules.json", message: "Expected version 6."
      }]
    );
    return value;
  }

  private async writeInstalled(value: InstalledGraphNodeModulesFileV6): Promise<void> {
    const filename = installedModulesPath(this.root());
    await mkdir(path.dirname(filename), { recursive: true });
    const temporary = `${filename}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, filename);
  }
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
