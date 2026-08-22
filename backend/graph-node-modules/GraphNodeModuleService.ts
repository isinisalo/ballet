import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { graphNodeModulePackageV4Schema } from "../../shared/api/graph-node-module-schemas.js";
import type {
  ProjectExecutionComposition,
  ProjectGraphNode,
  ProjectGraphNodeRouteTarget,
  ProjectJobNode,
  ProjectValidationNode,
  ProjectWorkNode
} from "../../shared/domain/automation.js";
import type {
  GraphNodeModuleCompositionV4,
  GraphNodeModuleExportResult,
  GraphNodeModuleGraphNodeV4,
  GraphNodeModuleInspection,
  GraphNodeModuleInstallPlan,
  GraphNodeModuleIssue,
  GraphNodeModuleLibraryEntry,
  GraphNodeModulePackageV4,
  GraphNodeModuleResourceV4,
  InstalledGraphNodeModuleStatus,
  InstalledGraphNodeModuleV4,
  InstalledGraphNodeModulesFileV4
} from "../../shared/domain/graphNodeModules.js";
import type { ExecutionProfile, ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import { loadProjectResources } from "../documents/projectResourceCatalog.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import type { RuntimeDatabaseProvider } from "../services/RuntimeDatabaseProvider.js";

export class GraphNodeModuleError extends Error {
  constructor(message: string, readonly issues: GraphNodeModuleIssue[]) { super(message); this.name = "GraphNodeModuleError"; }
}

export class GraphNodeModuleService {
  private readonly projects = new ProjectConfigurationRepository();
  constructor(private readonly root: () => string, private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider) {}

  inspect(input: unknown, source = "local-import"): GraphNodeModuleInspection {
    let value = input;
    if (typeof input === "string") {
      try { value = JSON.parse(input) as unknown; }
      catch { return invalidInspection(source, input, "INVALID_JSON", "Package is not valid JSON."); }
    }
    const raw = JSON.stringify(value);
    if (Buffer.byteLength(raw, "utf8") > 524_288) return invalidInspection(source, raw, "PACKAGE_TOO_LARGE", "Package exceeds 524288 bytes.");
    if (isRecord(value) && (value.format !== "ballet-graph-node-module" || value.version !== 4)) {
      return invalidInspection(source, raw, "SCHEMA_DOWNGRADE", "Only Graph Node Module v4 packages are accepted.");
    }
    const parsed = graphNodeModulePackageV4Schema.safeParse(value);
    if (!parsed.success) return {
      valid: false, source, sizeBytes: Buffer.byteLength(raw, "utf8"),
      issues: parsed.error.issues.map((issue) => ({
        code: issue.code === "unrecognized_keys" ? "UNKNOWN_FIELD" : "INVALID_SCHEMA",
        path: issue.path.map(String).join("."), message: issue.message
      }))
    };
    const canonicalJson = canonical(parsed.data);
    return {
      valid: true,
      package: parsed.data,
      canonicalJson,
      sha256: sha256(canonicalJson),
      source,
      sizeBytes: Buffer.byteLength(canonicalJson, "utf8"),
      issues: []
    };
  }

  async listLibrary(): Promise<GraphNodeModuleLibraryEntry[]> {
    const directory = path.join(this.root(), ".ballet", "graph-node-library");
    const files = await walk(directory).catch(() => []);
    return Promise.all(files.filter((file) => file.endsWith(".ballet-graph-node.json")).sort().map(async (filename) => {
      const source = path.relative(this.root(), filename);
      const body = await readFile(filename, "utf8");
      const inspection = this.inspect(body, source);
      return {
        source,
        sha256: inspection.sha256,
        sizeBytes: inspection.sizeBytes,
        valid: inspection.valid,
        manifest: inspection.package?.manifest,
        permissions: inspection.package?.permissions,
        package: inspection.package,
        issues: inspection.issues
      };
    }));
  }

  async plan(input: { package: unknown; source: string; profileMappings?: Record<string, string> }): Promise<GraphNodeModuleInstallPlan> {
    const inspection = this.inspect(input.package, input.source);
    if (!inspection.valid || !inspection.package || !inspection.sha256) throw new GraphNodeModuleError("Graph Node Module is invalid.", inspection.issues);
    const loaded = this.projects.load(this.root());
    if (!loaded.config) throw new GraphNodeModuleError("Project configuration is invalid.", loaded.issues.map((issue) => ({ code: "INVALID_SCHEMA", path: issue.path, message: issue.message })));
    return this.createPlan(inspection.package, inspection.sha256, input.source, input.profileMappings ?? {}, loaded.config);
  }

  async commit(input: { package: unknown; source: string; profileMappings?: Record<string, string>; expectedPlanHash: string }): Promise<InstalledGraphNodeModuleStatus> {
    const plan = await this.plan(input);
    if (plan.planHash !== input.expectedPlanHash) throw new GraphNodeModuleError("Install plan is stale.", [{ code: "PLAN_STALE", path: "expectedPlanHash", message: "Re-inspect and approve the current install plan." }]);
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
      const next = installGraphNode(loaded.config, plan.graphNode);
      this.projects.putAutomation(this.root(), { version: 14, graph: next.graph });
      const record: InstalledGraphNodeModuleV4 = {
        moduleId: pkg.manifest.id, moduleVersion: pkg.manifest.version, title: pkg.manifest.title,
        source: input.source, packageSha256: inspection.sha256!, graphNodeId: plan.graphNode.id,
        installedAt: new Date().toISOString(), profileMappings: Object.fromEntries(plan.profileMappings.map((mapping) => [mapping.slot.key, mapping.selectedProfileId!])),
        idRemapping: plan.idRemapping, stateContract: pkg.stateContract, capabilities: pkg.capabilities,
        ownedResources: plan.resources.map((resource) => ({
          kind: resource.kind, resourceId: resource.resourceId, relativePath: resource.relativePath,
          installedSha256: resource.sha256
        })),
        installedContentSha256: contentHash(plan.graphNode, plan.resources.map(({ relativePath, sha256: digest }) => ({ relativePath, sha256: digest })))
      };
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
      const graphNode = loaded?.graph.graphNodes.find((candidate) => candidate.id === record.graphNodeId);
      const missingResources: string[] = [];
      const resourceHashes: Array<{ relativePath: string; sha256: string }> = [];
      for (const resource of record.ownedResources) {
        const source = await readFile(path.join(this.root(), resource.relativePath), "utf8").catch(() => undefined);
        if (source === undefined) missingResources.push(resource.resourceId);
        else resourceHashes.push({ relativePath: resource.relativePath, sha256: sha256(source) });
      }
      const currentContentSha256 = graphNode ? contentHash(graphNode, resourceHashes) : undefined;
      return {
        ...record,
        status: !graphNode || missingResources.length ? "missing-resources" : currentContentSha256 === record.installedContentSha256 ? "exact" : "modified",
        currentContentSha256,
        missingResources
      };
    }));
  }

  async remove(graphNodeId: string): Promise<void> {
    if (this.runtimeDatabaseProvider.runtimeDatabase().activeGraphNodeIds().has(graphNodeId)) throw new GraphNodeModuleError("Graph Node has an active Run.", [{ code: "ACTIVE_RUN", path: "graphNodeId", message: graphNodeId }]);
    const installed = await this.readInstalled();
    const record = installed.installed.find((candidate) => candidate.graphNodeId === graphNodeId);
    if (!record) throw new GraphNodeModuleError("Module is not installed.", [{ code: "MODULE_NOT_INSTALLED", path: "graphNodeId", message: graphNodeId }]);
    const loaded = this.projects.load(this.root());
    if (!loaded.config) throw new GraphNodeModuleError("Project configuration is invalid.", []);
    const graph = loaded.config.graph;
    const graphNodes = graph.graphNodes.filter((candidate) => candidate.id !== graphNodeId);
    if (!graphNodes.length) throw new GraphNodeModuleError("A project must retain at least one Graph Node.", [{ code: "ID_CONFLICT", path: "graphNodeId", message: graphNodeId }]);
    const cleanCandidates = <T extends { target: ProjectGraphNodeRouteTarget | { graphNodeId: string } }>(values: T[]) => values.filter((candidate) => !("graphNodeId" in candidate.target) || candidate.target.graphNodeId !== graphNodeId);
    const routing = graph.orchestrator.routing;
    const nextGraph = {
      ...graph,
      graphNodes,
      orchestrator: {
        ...graph.orchestrator,
        routing: {
          ...routing,
          start: { ...routing.start, candidates: cleanCandidates(routing.start.candidates) },
          continuation: routing.continuation.filter((rule) => rule.sourceId !== graphNodeId).map((rule) => ({ ...rule, candidates: cleanCandidates(rule.candidates) })),
          repair: routing.repair.filter((rule) => rule.sourceId !== graphNodeId).map((rule) => ({ ...rule, candidates: cleanCandidates(rule.candidates) }))
        }
      }
    };
    this.projects.putAutomation(this.root(), { version: 14, graph: nextGraph });
    for (const resource of record.ownedResources) await unlink(path.join(this.root(), resource.relativePath)).catch(() => undefined);
    installed.installed = installed.installed.filter((candidate) => candidate.graphNodeId !== graphNodeId);
    await this.writeInstalled(installed);
  }

  async exportGraphNode(input: { graphNodeId: string; title?: string; description?: string; version?: string; category?: string; tags?: string[] }): Promise<GraphNodeModuleExportResult> {
    const config = this.projects.load(this.root()).config;
    const graphNode = config?.graph.graphNodes.find((candidate) => candidate.id === input.graphNodeId);
    if (!config || !graphNode) throw new GraphNodeModuleError("Graph Node was not found.", [{ code: "GRAPH_NODE_NOT_FOUND", path: "graphNodeId", message: input.graphNodeId }]);
    const catalog = await loadProjectResources(this.root());
    const compositionValues = graphNodeCompositions(graphNode);
    const profileIds = [...new Set(compositionValues.map((composition) => composition.executionProfileId))].sort();
    const profileSlots = profileIds.map((profileId, index) => {
      const profile = config.executionProfiles.find((candidate) => candidate.id === profileId)!;
      return { key: `slot-${index + 1}`, title: profile.name, description: `Map ${profile.name}.`, providers: [profile.provider], network: profile.networkAccess ? "required" as const : "forbidden" as const };
    });
    const slotByProfile = new Map(profileIds.map((profileId, index) => [profileId, profileSlots[index].key]));
    const resourceIds = [...new Set(compositionValues.flatMap((composition) => [composition.primaryInstructionId, ...composition.skillIds]))];
    const resources = resourceIds.map((resourceId): GraphNodeModuleResourceV4 => {
      const instruction = catalog.instructions.find((entry) => entry.id === resourceId);
      if (instruction) return { kind: "instruction", key: localResourceKey(resourceId), title: instruction.title, metadata: {}, body: instruction.body };
      const skill = catalog.skills.find((entry) => entry.id === resourceId);
      if (skill) return { kind: "skill", key: localResourceKey(resourceId), name: skill.name, description: skill.description, metadata: skill.metadata, body: skill.body };
      throw new GraphNodeModuleError("Referenced resource is missing.", [{ code: "INVALID_SCHEMA", path: resourceId, message: resourceId }]);
    });
    const pkg: GraphNodeModulePackageV4 = {
      format: "ballet-graph-node-module", version: 4,
      manifest: { id: graphNode.id, title: input.title ?? graphNode.description, description: input.description ?? graphNode.description, version: input.version ?? "1.0.0", category: input.category, tags: input.tags ?? [] },
      permissions: { network: profileSlots.some((slot) => slot.network === "required") ? "required" : "forbidden", externalWrites: false },
      profileSlots,
      stateContract: { id: `${graphNode.id}-state`, version: "1.0.0", description: graphNode.stateContract.description, requiredKeys: [] },
      capabilities: { requires: [], accepts: graphNode.capabilities.accepts, provides: graphNode.capabilities.provides, recommendedGraphRoutes: [] },
      resources,
      graphNode: dematerializeGraphNode(graphNode, slotByProfile)
    };
    const parsed = graphNodeModulePackageV4Schema.parse(pkg);
    const canonicalJson = canonical(parsed);
    return { package: parsed, canonicalJson, sha256: sha256(canonicalJson), filename: `${graphNode.id}.ballet-graph-node.json` };
  }

  private createPlan(pkg: GraphNodeModulePackageV4, packageSha256: string, source: string, mappings: Record<string, string>, project: ProjectConfiguration): GraphNodeModuleInstallPlan {
    const issues: GraphNodeModuleIssue[] = [];
    const profileMappings = pkg.profileSlots.map((slot) => {
      const candidates = project.executionProfiles.filter((profile) => slot.providers.includes(profile.provider) && networkCompatible(slot.network, profile)).map(profileCandidate);
      const selectedProfileId = mappings[slot.key];
      const selected = candidates.find((candidate) => candidate.id === selectedProfileId);
      const issue = !selectedProfileId
        ? { code: "PROFILE_MAPPING_REQUIRED" as const, path: `profileMappings.${slot.key}`, message: "Choose an execution profile explicitly." }
        : !selected ? { code: "PROFILE_INCOMPATIBLE" as const, path: `profileMappings.${slot.key}`, message: `Profile ${selectedProfileId} is incompatible.` } : undefined;
      if (issue) issues.push(issue);
      return { slot, selectedProfileId, candidates, compatible: Boolean(selected), issue };
    });
    const profileMap = new Map(profileMappings.flatMap((mapping) => mapping.selectedProfileId ? [[mapping.slot.key, mapping.selectedProfileId] as const] : []));
    const idRemapping = moduleRemapping(pkg);
    const graphNode = materializeGraphNode(pkg.graphNode, idRemapping, profileMap);
    if (project.graph.graphNodes.some((candidate) => candidate.id === graphNode.id)) issues.push({ code: "ID_CONFLICT", path: "graphNode.key", message: `Graph Node ${graphNode.id} already exists.` });
    const resources = pkg.resources.map((resource) => {
      const resourceId = resource.kind === "instruction" ? idRemapping.instructions[resource.key] : idRemapping.skills[resource.key];
      const relativePath = resource.kind === "instruction" ? `.ballet/instructions/${resourceId.slice(8)}.md` : `.agents/skills/${resourceId.slice(8)}/SKILL.md`;
      const rendered = renderResource(resourceId, resource);
      return { kind: resource.kind, key: resource.key, resourceId, relativePath, sha256: sha256(rendered), bytes: Buffer.byteLength(rendered), action: "create" as const };
    });
    const base = { packageSha256, source, module: pkg.manifest, graphNode, idRemapping, resources, profileMappings, conflicts: [], issues, canInstall: issues.length === 0 };
    return { ...base, planHash: sha256(canonical(base)) };
  }

  private async readInstalled(): Promise<InstalledGraphNodeModulesFileV4> {
    const source = await readFile(installedPath(this.root()), "utf8").catch(() => undefined);
    if (!source) return { version: 4, installed: [] };
    const value = JSON.parse(source) as InstalledGraphNodeModulesFileV4;
    if (value.version !== 4 || !Array.isArray(value.installed)) throw new GraphNodeModuleError("Installed module registry is invalid.", [{ code: "INVALID_SCHEMA", path: ".ballet/graph-node-modules.json", message: "Expected version 4." }]);
    return value;
  }
  private async writeInstalled(value: InstalledGraphNodeModulesFileV4) {
    const filename = installedPath(this.root());
    await mkdir(path.dirname(filename), { recursive: true });
    const temporary = `${filename}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, filename);
  }
}

const installedPath = (root: string) => path.join(root, ".ballet", "graph-node-modules.json");
const invalidInspection = (source: string, raw: string, code: GraphNodeModuleIssue["code"], message: string): GraphNodeModuleInspection => ({ valid: false, source, sizeBytes: Buffer.byteLength(raw), issues: [{ code, path: "package", message }] });
const canonical = (value: unknown): string => JSON.stringify(sortValue(value));
const sortValue = (value: unknown): unknown => Array.isArray(value) ? value.map(sortValue) : isRecord(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])])) : value;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const walk = async (directory: string): Promise<string[]> => (await readdir(directory, { withFileTypes: true })).flatMap((entry) => entry.isDirectory() ? [] : [path.join(directory, entry.name)]).concat((await Promise.all((await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => walk(path.join(directory, entry.name))))).flat());
const profileCandidate = (profile: ExecutionProfile) => ({ id: profile.id, name: profile.name, provider: profile.provider, networkAccess: profile.networkAccess });
const networkCompatible = (requirement: string, profile: ExecutionProfile) => requirement === "optional" || (requirement === "required") === profile.networkAccess;
const moduleRemapping = (pkg: GraphNodeModulePackageV4) => ({
  graphNode: { [pkg.graphNode.key]: pkg.manifest.id },
  nodes: Object.fromEntries([pkg.graphNode.orchestrator, ...(pkg.graphNode.repairNode ? [pkg.graphNode.repairNode] : []), ...pkg.graphNode.jobNodes.flatMap((job) => [job, job.workNode, job.validationNode])].map((node) => [node.key, `${pkg.manifest.id}-${node.key}`])),
  rules: Object.fromEntries([pkg.graphNode.orchestrator.routing.start, ...pkg.graphNode.orchestrator.routing.continuation, ...pkg.graphNode.orchestrator.routing.repair].map((rule) => [rule.key, `${pkg.manifest.id}-${rule.key}`])),
  instructions: Object.fromEntries(pkg.resources.filter((resource) => resource.kind === "instruction").map((resource) => [resource.key, `project:${pkg.manifest.id}-${resource.key}`])),
  skills: Object.fromEntries(pkg.resources.filter((resource) => resource.kind === "skill").map((resource) => [resource.key, `project:${pkg.manifest.id}-${resource.key}`]))
});
type Remapping = ReturnType<typeof moduleRemapping>;
const composition = (value: GraphNodeModuleCompositionV4, remap: Remapping, profiles: Map<string, string>): ProjectExecutionComposition => ({
  executionProfileId: profiles.get(value.profileSlot) ?? "",
  primaryInstructionId: remap.instructions[value.primaryInstruction],
  skillIds: value.skills.map((key) => remap.skills[key])
});
const materializeExecutable = <T extends GraphNodeModuleGraphNodeV4["jobNodes"][number]["workNode"] | GraphNodeModuleGraphNodeV4["jobNodes"][number]["validationNode"]>(value: T, remap: Remapping, profiles: Map<string, string>): ProjectWorkNode | ProjectValidationNode => {
  const base = {
    id: remap.nodes[value.key], description: value.description, task: value.task,
    nodeStyle: value.nodeStyle, nodeSize: value.nodeSize
  };
  return value.type === "human"
    ? { ...base, type: "human" }
    : { ...base, type: "agent", ...composition(value, remap, profiles) };
};
const materializeGraphNode = (value: GraphNodeModuleGraphNodeV4, remap: Remapping, profiles: Map<string, string>): ProjectGraphNode => ({
  id: remap.graphNode[value.key], description: value.description, nodeStyle: value.nodeStyle, nodeSize: value.nodeSize,
  capabilities: structuredClone(value.capabilities), stateContract: { ...value.stateContract },
  orchestrator: {
    id: remap.nodes[value.orchestrator.key], description: value.orchestrator.description,
    nodeStyle: value.orchestrator.nodeStyle, nodeSize: value.orchestrator.nodeSize,
    ...composition(value.orchestrator, remap, profiles), maxTransitions: value.orchestrator.maxTransitions,
    maxRouteAttempts: value.orchestrator.maxRouteAttempts,
    routing: {
      start: { id: remap.rules[value.orchestrator.routing.start.key], candidates: value.orchestrator.routing.start.candidates.map((candidate) => materializeCandidate(candidate, remap)) },
      continuation: value.orchestrator.routing.continuation.map((rule) => ({ id: remap.rules[rule.key], sourceId: remap.nodes[rule.sourceJobNode], result: rule.result, candidates: rule.candidates.map((candidate) => materializeCandidate(candidate, remap)) })),
      repair: value.orchestrator.routing.repair.map((rule) => ({ id: remap.rules[rule.key], sourceId: remap.nodes[rule.sourceJobNode], capability: rule.capability, candidates: rule.candidates.map((candidate) => materializeCandidate(candidate, remap)) }))
    }
  },
  ...(value.repairNode ? { repairNode: { id: remap.nodes[value.repairNode.key], description: value.repairNode.description, task: value.repairNode.task, nodeStyle: value.repairNode.nodeStyle, nodeSize: value.repairNode.nodeSize, ...composition(value.repairNode, remap, profiles), maxRepairDepth: value.repairNode.maxRepairDepth, maxRepairAttempts: value.repairNode.maxRepairAttempts } } : {}),
  jobNodes: value.jobNodes.map((job): ProjectJobNode => ({
    id: remap.nodes[job.key], description: job.description, nodeStyle: job.nodeStyle, nodeSize: job.nodeSize,
    capabilities: structuredClone(job.capabilities), maxRetries: job.maxRetries,
    workNode: materializeExecutable(job.workNode, remap, profiles) as ProjectWorkNode,
    validationNode: materializeExecutable(job.validationNode, remap, profiles) as ProjectValidationNode
  }))
});
const materializeCandidate = (candidate: { target: { jobNode: string } | { terminal: "PASS" | "FAIL" }; description: string }, remap: Remapping) => ({ target: "jobNode" in candidate.target ? { jobNodeId: remap.nodes[candidate.target.jobNode] } : { terminal: candidate.target.terminal }, description: candidate.description });
const installGraphNode = (config: ProjectConfiguration, graphNode: ProjectGraphNode): ProjectConfiguration => ({
  ...config,
  graph: {
    ...config.graph,
    graphNodes: [...config.graph.graphNodes, graphNode],
    orchestrator: {
      ...config.graph.orchestrator,
      routing: {
        ...config.graph.orchestrator.routing,
        start: {
          ...config.graph.orchestrator.routing.start,
          candidates: [...config.graph.orchestrator.routing.start.candidates, { target: { graphNodeId: graphNode.id }, description: `Installed Graph Node ${graphNode.id}.` }]
        }
      }
    }
  }
});
const renderResource = (resourceId: string, resource: GraphNodeModuleResourceV4) => {
  const localId = resourceId.slice(8);
  const title = resource.kind === "instruction" ? resource.title : resource.name;
  return `---\nid: ${localId}\ntitle: ${JSON.stringify(title)}\ncreatedAt: ${new Date().toISOString().slice(0, 10)}\nupdatedAt: ${new Date().toISOString().slice(0, 10)}\n---\n${resource.body.startsWith("\n") ? "" : "\n"}${resource.body.trimEnd()}\n`;
};
const contentHash = (graphNode: ProjectGraphNode, resources: Array<{ relativePath: string; sha256: string }>) => sha256(canonical({ graphNode, resources: [...resources].sort((a, b) => a.relativePath.localeCompare(b.relativePath)) }));
const graphNodeCompositions = (node: ProjectGraphNode): ProjectExecutionComposition[] => [node.orchestrator, ...(node.repairNode ? [node.repairNode] : []), ...node.jobNodes.flatMap((job) => [...(job.workNode.type === "agent" ? [job.workNode] : []), ...(job.validationNode.type === "agent" ? [job.validationNode] : [])])];
const localResourceKey = (resourceId: string) => resourceId.slice(8).replace(/^[^-]+-/, "");
const dematerializeComposition = (value: ProjectExecutionComposition, slots: Map<string, string>) => ({ profileSlot: slots.get(value.executionProfileId)!, primaryInstruction: localResourceKey(value.primaryInstructionId), skills: value.skillIds.map(localResourceKey) });
const dematerializeExecutable = (
  value: ProjectWorkNode | ProjectValidationNode,
  slots: Map<string, string>
): GraphNodeModuleGraphNodeV4["jobNodes"][number]["workNode"] => {
  const base = {
    key: value.id, description: value.description, task: value.task,
    nodeStyle: value.nodeStyle, nodeSize: value.nodeSize
  };
  return value.type === "human"
    ? { ...base, type: "human" }
    : { ...base, type: "agent", ...dematerializeComposition(value, slots) };
};
const dematerializeGraphNode = (node: ProjectGraphNode, slots: Map<string, string>): GraphNodeModuleGraphNodeV4 => ({
  key: node.id, description: node.description, nodeStyle: node.nodeStyle, nodeSize: node.nodeSize,
  capabilities: structuredClone(node.capabilities), stateContract: { ...node.stateContract },
  orchestrator: {
    key: node.orchestrator.id, description: node.orchestrator.description, nodeStyle: node.orchestrator.nodeStyle,
    nodeSize: node.orchestrator.nodeSize, ...dematerializeComposition(node.orchestrator, slots),
    maxTransitions: node.orchestrator.maxTransitions, maxRouteAttempts: node.orchestrator.maxRouteAttempts,
    routing: {
      start: { key: node.orchestrator.routing.start.id, candidates: node.orchestrator.routing.start.candidates.map(dematerializeCandidate) },
      continuation: node.orchestrator.routing.continuation.map((rule) => ({ key: rule.id, sourceJobNode: rule.sourceId, result: rule.result, candidates: rule.candidates.map(dematerializeCandidate) })),
      repair: node.orchestrator.routing.repair.map((rule) => ({ key: rule.id, sourceJobNode: rule.sourceId, capability: rule.capability, candidates: rule.candidates.map(dematerializeCandidate) }))
    }
  },
  ...(node.repairNode ? { repairNode: { key: node.repairNode.id, description: node.repairNode.description, task: node.repairNode.task, nodeStyle: node.repairNode.nodeStyle, nodeSize: node.repairNode.nodeSize, ...dematerializeComposition(node.repairNode, slots), maxRepairDepth: node.repairNode.maxRepairDepth, maxRepairAttempts: node.repairNode.maxRepairAttempts } } : {}),
  jobNodes: node.jobNodes.map((job) => ({
    key: job.id, description: job.description, nodeStyle: job.nodeStyle, nodeSize: job.nodeSize,
    capabilities: structuredClone(job.capabilities), maxRetries: job.maxRetries,
    workNode: dematerializeExecutable(job.workNode, slots),
    validationNode: dematerializeExecutable(job.validationNode, slots)
  }))
});
const dematerializeCandidate = (candidate: { target: ProjectGraphNodeRouteTarget; description: string }) => ({ target: "jobNodeId" in candidate.target ? { jobNode: candidate.target.jobNodeId } : { terminal: candidate.target.terminal }, description: candidate.description });
