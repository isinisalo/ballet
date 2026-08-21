import { constants, type Dirent } from "node:fs";
import { mkdir, open, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import { loopModulePackageV3Schema } from "../../shared/api/loop-module-schemas.js";
import {
  isProjectAgentValidationNode,
  isProjectProviderJobNode,
  type ProjectAutomationConfig,
  type ProjectExecutionComposition,
  type ProjectJobNode,
  type ProjectLoop,
  type ProjectValidationNode
} from "../../shared/domain/automation.js";
import type { ProjectResourceCatalog } from "../../shared/domain/documents.js";
import {
  maxLoopModulePackageBytes,
  type InstalledLoopModuleStatus,
  type InstalledLoopModuleV3,
  type LoopModuleErrorCode,
  type LoopModuleExportResult,
  type LoopModuleIdRemapping,
  type LoopModuleInspection,
  type LoopModuleInstallPlan,
  type LoopModuleIssue,
  type LoopModuleLibraryEntry,
  type LoopModuleNetworkRequirement,
  type LoopModulePackageV3,
  type LoopModuleProfileMappingPlan,
  type LoopModuleJobNodeV3,
  type LoopModuleResourceV3,
  type LoopModuleResourceWritePlan,
  type LoopModuleStateCompatibility,
  type LoopModuleValidationNodeV3
} from "../../shared/domain/loopModules.js";
import type { ExecutionProfile, ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import { loadProjectResources } from "../documents/projectResourceCatalog.js";
import { resolveSafeProjectPath } from "../documents/safeProjectPath.js";
import { markdownSource } from "../markdown.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import type { RuntimeDatabaseProvider } from "../services/RuntimeDatabaseProvider.js";
import { validateProjectAutomationConfig, validateProjectExecutionResources } from "../automation.js";
import { canonicalLoopModuleJson, compareLoopModuleText, loopModuleSha256 } from "./canonicalLoopModule.js";
import { InstalledLoopModuleRepository } from "./InstalledLoopModuleRepository.js";
import { LoopModuleConflictError, LoopModuleNotFoundError, LoopModuleValidationError } from "./LoopModuleErrors.js";

type PlanInput = { package: unknown; source: string; profileMappings?: Record<string, string> };
type ExportInput = { loopId: string; title?: string; description?: string; version?: string; category?: string; tags?: string[] };

export class LoopModuleService {
  private readonly projects = new ProjectConfigurationRepository();
  private readonly provenance = new InstalledLoopModuleRepository();

  constructor(
    private readonly root: () => string,
    private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider
  ) {}

  inspect(input: unknown, source = "local-import"): LoopModuleInspection {
    const raw = canonicalLoopModuleJson(input);
    const sizeBytes = Buffer.byteLength(raw, "utf8");
    if (sizeBytes > maxLoopModulePackageBytes) return invalidInspection(source, sizeBytes, issue(
      "PACKAGE_TOO_LARGE", "$", `Package exceeds ${maxLoopModulePackageBytes} UTF-8 bytes.`
    ));
    if (isRecord(input) && input.version !== 3) return invalidInspection(source, sizeBytes, issue(
      "SCHEMA_DOWNGRADE", "version", `Loop module package version 3 is required; received ${String(input.version)}.`
    ));
    const forbidden = forbiddenPackageIssue(input);
    if (forbidden) return invalidInspection(source, sizeBytes, forbidden);
    const parsed = loopModulePackageV3Schema.safeParse(input);
    if (!parsed.success) return {
      valid: false, source, sizeBytes,
      issues: parsed.error.issues.map(zodIssue)
    };
    const canonicalJson = canonicalLoopModuleJson(parsed.data);
    return {
      valid: true,
      package: parsed.data,
      sha256: loopModuleSha256(canonicalJson),
      canonicalJson,
      source,
      sizeBytes: Buffer.byteLength(canonicalJson, "utf8"),
      issues: []
    };
  }

  inspectJson(bytes: Uint8Array, source: string): LoopModuleInspection {
    if (bytes.byteLength > maxLoopModulePackageBytes) return invalidInspection(source, bytes.byteLength, issue(
      "PACKAGE_TOO_LARGE", "$", `Package exceeds ${maxLoopModulePackageBytes} UTF-8 bytes.`
    ));
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { return invalidInspection(source, bytes.byteLength, issue("INVALID_UTF8", "$", "Package must contain valid UTF-8.")); }
    try { return this.inspect(JSON.parse(text), source); }
    catch { return invalidInspection(source, bytes.byteLength, issue("INVALID_JSON", "$", "Package must contain one valid JSON envelope.")); }
  }

  async listLibrary(): Promise<LoopModuleLibraryEntry[]> {
    const root = this.root();
    const relativeRoot = ".ballet/loop-library";
    const files = await walkLibrary(root, relativeRoot);
    return Promise.all(files.map(async (relativePath) => {
      const absolute = await resolveSafeProjectPath(root, relativePath);
      const inspection = this.inspectJson(await readFile(absolute, { flag: constants.O_RDONLY | constants.O_NOFOLLOW }), relativePath);
      return {
        source: relativePath,
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

  async libraryPackage(source: string): Promise<LoopModuleInspection> {
    if (!source.startsWith(".ballet/loop-library/") || !source.endsWith(".ballet-loop.json")) {
      throw new LoopModuleValidationError("Invalid Loop Library source.", [issue("FORBIDDEN_CONTENT", "source", "Source must be a project Loop Library package path.")]);
    }
    const absolute = await resolveSafeProjectPath(this.root(), source);
    return this.inspectJson(await readFile(absolute, { flag: constants.O_RDONLY | constants.O_NOFOLLOW }), source);
  }

  async plan(input: PlanInput): Promise<LoopModuleInstallPlan> {
    const inspection = this.inspect(input.package, input.source);
    if (!inspection.valid || !inspection.package || !inspection.sha256) {
      throw new LoopModuleValidationError("Loop module package is invalid.", inspection.issues);
    }
    const root = this.root();
    const loaded = this.projects.load(root);
    if (!loaded.config) throw new LoopModuleConflictError("Project configuration is invalid.", loaded.issues.map((value) => issue("ID_CONFLICT", value.path, value.message)));
    const [resources, provenance] = await Promise.all([loadProjectResources(root), this.provenance.load(root)]);
    return this.createPlan(inspection.package, inspection.sha256, input.source, input.profileMappings ?? {}, loaded.config, resources, provenance.installed);
  }

  async commit(input: PlanInput & { expectedPlanHash: string }): Promise<InstalledLoopModuleStatus> {
    const plan = await this.plan(input);
    if (plan.planHash !== input.expectedPlanHash) throw new LoopModuleConflictError("Install plan is stale; review the current plan before installing.", [
      issue("PLAN_STALE", "expectedPlanHash", "Project state or mappings changed after the plan was created.")
    ]);
    if (!plan.canInstall) throw new LoopModuleConflictError("Loop module cannot be installed.", plan.issues);
    this.assertLoopInactive(plan.loop.id);
    const inspection = this.inspect(input.package, input.source);
    const pkg = inspection.package!;
    const sources = materializedResourceSources(pkg, plan.idRemapping);
    const created: string[] = [];
    let provenanceWritten = false;
    try {
      for (const resource of plan.resources) {
        const source = sources.get(resource.key)!;
        await writeExclusiveProjectFile(this.root(), resource.relativePath, source);
        created.push(resource.relativePath);
      }
      const loaded = this.projects.load(this.root());
      if (!loaded.config) throw new LoopModuleConflictError("Project configuration changed and is invalid.");
      const automation = automationOf(loaded.config);
      const next: ProjectAutomationConfig = {
        ...automation,
        loops: [...automation.loops, plan.loop],
        graph: attachInstalledLoop(automation, plan.loop.id)
      };
      const currentResources = await loadProjectResources(this.root());
      const validationIssues = [
        ...validateProjectAutomationConfig(next, loaded.config.executionProfiles),
        ...validateProjectExecutionResources(next, currentResources)
      ];
      if (validationIssues.length) throw new LoopModuleValidationError("Materialized Loop is invalid.", validationIssues.map((value) => issue("INVALID_SCHEMA", value.path, value.message)));
      const ownedResources = plan.resources.map((resource) => ({
        kind: resource.kind,
        resourceId: resource.resourceId,
        relativePath: resource.relativePath,
        installedSha256: resource.sha256
      }));
      const installedContentSha256 = contentHash(plan.loop, ownedResources.map((resource) => ({
        relativePath: resource.relativePath, sha256: resource.installedSha256
      })));
      const record: InstalledLoopModuleV3 = {
        moduleId: pkg.manifest.id,
        moduleVersion: pkg.manifest.version,
        title: pkg.manifest.title,
        source: input.source,
        packageSha256: plan.packageSha256,
        loopId: plan.loop.id,
        installedAt: new Date().toISOString(),
        profileMappings: Object.fromEntries(plan.profileMappings.map((mapping) => [mapping.slot.key, mapping.selectedProfileId!])),
        idRemapping: plan.idRemapping,
        stateContract: pkg.stateContract,
        capabilities: pkg.capabilities,
        ownedResources,
        installedContentSha256
      };
      await this.provenance.add(this.root(), record);
      provenanceWritten = true;
      this.projects.putAutomation(this.root(), next);
      return { ...record, status: "exact", currentContentSha256: installedContentSha256, missingResources: [] };
    } catch (error) {
      if (provenanceWritten) await this.provenance.remove(this.root(), plan.loop.id).catch(() => undefined);
      await Promise.all(created.map((relativePath) => removeOwnedFile(this.root(), relativePath)));
      throw error;
    }
  }

  async statuses(): Promise<InstalledLoopModuleStatus[]> {
    const root = this.root();
    const loaded = this.projects.load(root);
    const file = await this.provenance.load(root);
    return Promise.all(file.installed.map(async (record): Promise<InstalledLoopModuleStatus> => {
      const loop = loaded.config?.loops.find((candidate) => candidate.id === record.loopId);
      const current: Array<{ relativePath: string; sha256: string }> = [];
      const missingResources: string[] = [];
      for (const resource of record.ownedResources) {
        try {
          const filename = await resolveSafeProjectPath(root, resource.relativePath);
          const bytes = await readFile(filename, { flag: constants.O_RDONLY | constants.O_NOFOLLOW });
          current.push({ relativePath: resource.relativePath, sha256: loopModuleSha256(bytes) });
        } catch (error) {
          if (!isMissing(error)) throw error;
          missingResources.push(resource.relativePath);
        }
      }
      if (!loop || missingResources.length) return { ...record, status: "missing-resources", missingResources };
      const currentContentSha256 = contentHash(loop, current);
      return {
        ...record,
        status: currentContentSha256 === record.installedContentSha256 ? "exact" : "modified",
        currentContentSha256,
        missingResources
      };
    }));
  }

  async exportLoop(input: ExportInput): Promise<LoopModuleExportResult> {
    this.assertLoopInactive(input.loopId);
    const root = this.root();
    const loaded = this.projects.load(root);
    if (!loaded.config) throw new LoopModuleConflictError("Project configuration is invalid.");
    const loop = loaded.config.loops.find((candidate) => candidate.id === input.loopId);
    if (!loop) throw new LoopModuleNotFoundError(`Loop ${input.loopId} was not found.`);
    const resources = await loadProjectResources(root);
    const statuses = await this.statuses();
    const provenance = statuses.find((record) => record.loopId === loop.id);
    const pkg = exportPackage(loop, loaded.config.executionProfiles, resources, provenance, input);
    const parsed = loopModulePackageV3Schema.parse(pkg);
    const inspection = this.inspect(parsed, `export:${loop.id}`);
    if (!inspection.valid || !inspection.package || !inspection.canonicalJson || !inspection.sha256) {
      throw new LoopModuleValidationError("Loop export contains forbidden or invalid content.", inspection.issues);
    }
    return {
      package: inspection.package,
      canonicalJson: inspection.canonicalJson,
      sha256: inspection.sha256,
      filename: `${inspection.package.manifest.id}-${inspection.package.manifest.version}.ballet-loop.json`
    };
  }

  async remove(loopId: string): Promise<void> {
    this.assertLoopInactive(loopId);
    const root = this.root();
    const file = await this.provenance.load(root);
    const record = file.installed.find((candidate) => candidate.loopId === loopId);
    if (!record) throw new LoopModuleNotFoundError(`Loop ${loopId} has no installed module provenance.`);
    const loaded = this.projects.load(root);
    if (!loaded.config) throw new LoopModuleConflictError("Project configuration is invalid.");
    if (!loaded.config.loops.some((loop) => loop.id === loopId)) throw new LoopModuleNotFoundError(`Loop ${loopId} was not found.`);
    const nextLoops = loaded.config.loops.filter((loop) => loop.id !== loopId);
    const next = {
      ...automationOf(loaded.config),
      loops: nextLoops,
      graph: nextLoops.length === 0 ? {
        ...loaded.config.graph,
        startLoopId: "",
        transitions: [],
        repairEdges: []
      } : {
        ...loaded.config.graph,
        startLoopId: loaded.config.graph.startLoopId === loopId ? nextLoops[0]!.id : loaded.config.graph.startLoopId,
        transitions: loaded.config.graph.transitions.filter((transition) =>
          transition.source !== loopId && !("loopId" in transition.target && transition.target.loopId === loopId)),
        repairEdges: loaded.config.graph.repairEdges.filter((edge) => edge.source !== loopId && edge.target !== loopId)
      }
    };
    this.projects.putAutomation(root, next);
    await this.provenance.remove(root, loopId);
    const referenced = referencedResourceIds(next);
    for (const resource of record.ownedResources) {
      if (!referenced.has(resource.resourceId)) await removeOwnedFile(root, resource.relativePath);
    }
  }

  private createPlan(
    pkg: LoopModulePackageV3,
    packageSha256: string,
    source: string,
    requestedMappings: Record<string, string>,
    project: ProjectConfiguration,
    catalog: ProjectResourceCatalog,
    installed: InstalledLoopModuleV3[]
  ): LoopModuleInstallPlan {
    const allLoopIds = project.loops.map((loop) => loop.id);
    const loopId = uniqueId(allLoopIds, pkg.manifest.id, 101);
    const allNodeIds = project.loops.flatMap((loop) => [
      ...loop.workflow.jobNodes.map((node) => node.id),
      ...loop.workflow.validationNodes.map((node) => node.id)
    ]);
    const allEdgeIds = [
      ...project.loops.flatMap((loop) => [
        ...loop.workflow.passEdges.map((edge) => edge.id),
        ...loop.workflow.failEdges.map((edge) => edge.id)
      ]),
      ...project.graph.transitions.map((edge) => edge.id),
      ...project.graph.repairEdges.map((edge) => edge.id)
    ];
    const nodeMap: Record<string, string> = {};
    for (const node of [...pkg.loop.workflow.jobNodes, ...pkg.loop.workflow.validationNodes]) {
      nodeMap[node.key] = uniqueId([...allNodeIds, ...Object.values(nodeMap)], `${loopId}-${node.key}`, 160);
    }
    const edgeMap: Record<string, string> = {};
    for (const edge of [...pkg.loop.workflow.passEdges, ...pkg.loop.workflow.failEdges]) {
      edgeMap[edge.key] = uniqueId([...allEdgeIds, ...Object.values(edgeMap)], `${loopId}-${edge.key}`, 200);
    }
    const instructionMap: Record<string, string> = {};
    const skillMap: Record<string, string> = {};
    const resources: LoopModuleResourceWritePlan[] = [];
    const conflicts: LoopModuleInstallPlan["conflicts"] = [];
    if (loopId !== pkg.manifest.id) conflicts.push({
      kind: "id", code: "ID_CONFLICT", target: pkg.manifest.id, blocking: false,
      message: `Loop id ${pkg.manifest.id} is already in use and will be materialized as ${loopId}.`
    });
    for (const [key, materializedId] of Object.entries(nodeMap)) {
      const preferredId = `${loopId}-${key}`;
      if (materializedId !== preferredId) conflicts.push({
        kind: "id", code: "ID_CONFLICT", target: preferredId, blocking: false,
        message: `Node id ${preferredId} is already in use and will be materialized as ${materializedId}.`
      });
    }
    for (const [key, materializedId] of Object.entries(edgeMap)) {
      const preferredId = `${loopId}-${key}`;
      if (materializedId !== preferredId) conflicts.push({
        kind: "id", code: "ID_CONFLICT", target: preferredId, blocking: false,
        message: `Edge id ${preferredId} is already in use and will be materialized as ${materializedId}.`
      });
    }
    const namespace = loopId;
    for (const resource of pkg.resources) {
      const resourceId = resource.kind === "instruction"
        ? `project:module-${namespace}-${resource.key}`
        : `project:modules/${namespace}/${resource.key}`;
      const relativePath = resource.kind === "instruction"
        ? `.ballet/instructions/modules/${namespace}/${resource.key}.md`
        : `.agents/skills/modules/${namespace}/${resource.key}/SKILL.md`;
      if (resource.kind === "instruction") instructionMap[resource.key] = resourceId;
      else skillMap[resource.key] = resourceId;
      const sourceText = materializedResourceSource(resource, resourceId);
      const conflict = [...catalog.instructions, ...catalog.skills].some((candidate) =>
        candidate.id === resourceId || candidate.relativePath === relativePath);
      const owner = installed.find((record) => record.ownedResources.some((candidate) =>
        candidate.resourceId === resourceId || candidate.relativePath === relativePath));
      if (conflict) conflicts.push({
        kind: "resource", code: "RESOURCE_CONFLICT", target: relativePath, blocking: true,
        message: `Project resource already exists: ${relativePath}.`
      });
      if (owner) conflicts.push({
        kind: "ownership", code: "OWNERSHIP_CONFLICT", target: relativePath, blocking: true,
        message: `Resource ${relativePath} is owned by installed Loop ${owner.loopId}.`
      });
      resources.push({
        kind: resource.kind,
        key: resource.key,
        resourceId,
        relativePath,
        sha256: loopModuleSha256(sourceText),
        bytes: Buffer.byteLength(sourceText, "utf8"),
        action: conflict || owner ? "conflict" : "create"
      });
    }
    const idRemapping: LoopModuleIdRemapping = {
      loop: { [pkg.loop.key]: loopId }, nodes: nodeMap, edges: edgeMap,
      instructions: instructionMap, skills: skillMap
    };
    const profileMappings = pkg.profileSlots.map((slot): LoopModuleProfileMappingPlan => {
      const providerCandidates = project.executionProfiles.filter((profile) => slot.providers.includes(profile.provider));
      const candidates = project.executionProfiles.filter((profile) => profileCompatible(profile, slot));
      const requested = requestedMappings[slot.key];
      const selected = requested ?? (candidates.length === 1 ? candidates[0]!.id : undefined);
      const compatible = Boolean(selected && candidates.some((candidate) => candidate.id === selected));
      const mappingIssue = compatible ? undefined : requested
        ? issue("PROFILE_INCOMPATIBLE", `profileMappings.${slot.key}`, `ExecutionProfile ${requested} is incompatible with slot ${slot.key}.`)
        : candidates.length === 0 && providerCandidates.length > 0
          ? issue("NETWORK_PERMISSION_MISMATCH", `profileMappings.${slot.key}`, `No ${slot.network} network profile is compatible with slot ${slot.key}.`)
        : issue("PROFILE_MAPPING_REQUIRED", `profileMappings.${slot.key}`, `Select one compatible ExecutionProfile for slot ${slot.key}.`);
      return { slot, selectedProfileId: selected, candidates, compatible, issue: mappingIssue };
    });
    const mappingBySlot = Object.fromEntries(profileMappings.map((mapping) => [mapping.slot.key, mapping.selectedProfileId ?? ""]));
    const loop = materializeLoop(pkg, loopId, nodeMap, edgeMap, instructionMap, skillMap, mappingBySlot);
    const stateCompatibility = stateCompatibilityWith(pkg, installed);
    const availableCapabilities = [...new Set(installed.flatMap((record) => record.capabilities.provides))]
      .sort(compareLoopModuleText);
    const missingRequires = pkg.capabilities.requires.filter((capability) => !availableCapabilities.includes(capability));
    const issues = [
      ...peerLoopReferenceIssues(pkg, project.loops),
      ...profileMappings.flatMap((mapping) => mapping.issue ? [mapping.issue] : []),
      ...(stateCompatibility.compatibility === "incompatible" ? [issue(
        "STATE_CONTRACT_INCOMPATIBLE",
        "stateContract",
        `State contract ${pkg.stateContract.id}@${pkg.stateContract.version} is incompatible with installed materializations.`
      )] : []),
      ...conflicts.filter((conflict) => conflict.blocking)
        .map((conflict) => issue(conflict.code, conflict.target, conflict.message))
    ];
    const remapped = loopId !== pkg.manifest.id
      || Object.entries(nodeMap).some(([key, value]) => value !== `${loopId}-${key}`)
      || Object.entries(edgeMap).some(([key, value]) => value !== `${loopId}-${key}`);
    const base = {
      packageSha256, source,
      module: pkg.manifest,
      loop, idRemapping, resources, profileMappings,
      permissions: { externalWrites: pkg.permissions.externalWrites, network: pkg.permissions.network, compatible: profileMappings.every((mapping) => mapping.compatible) },
      stateContract: { contract: pkg.stateContract, compatibility: stateCompatibility.compatibility, comparedWith: stateCompatibility.comparedWith },
      capabilities: {
        requires: pkg.capabilities.requires,
        accepts: pkg.capabilities.accepts,
        provides: pkg.capabilities.provides,
        recommendedTransitions: pkg.capabilities.recommendedTransitions,
        recommendedRepairs: pkg.capabilities.recommendedRepairs,
        available: availableCapabilities,
        missingRequires
      },
      conflicts, issues,
      diff: {
        loopsAdded: [loop.id],
        projectFilesCreated: resources.filter((resource) => resource.action === "create").map((resource) => resource.relativePath),
        provenanceFilesChanged: [this.provenance.relativePath],
        projectConfigChanged: true
      },
      requiresPreview: remapped || conflicts.length > 0 || profileMappings.some((mapping) => mapping.candidates.length !== 1) || stateCompatibility.compatibility === "incompatible",
      canInstall: issues.length === 0
    };
    return { ...base, planHash: loopModuleSha256(canonicalLoopModuleJson(base)) };
  }

  private assertLoopInactive(loopId: string): void {
    if (this.runtimeDatabaseProvider.runtimeDatabase().activeLoopIds().includes(loopId)) {
      throw new LoopModuleConflictError(`Loop ${loopId} cannot be changed while it has an active Run.`, [
        issue("ACTIVE_RUN", "loopId", `Loop ${loopId} has an active Run.`)
      ]);
    }
  }
}

const materializeLoop = (
  pkg: LoopModulePackageV3,
  loopId: string,
  nodes: Record<string, string>,
  edges: Record<string, string>,
  instructions: Record<string, string>,
  skills: Record<string, string>,
  profiles: Record<string, string>
): ProjectLoop => ({
  id: loopId,
  description: pkg.loop.description,
  capabilities: {
    accepts: [...pkg.capabilities.accepts].sort(compareLoopModuleText),
    provides: [...pkg.capabilities.provides].sort(compareLoopModuleText)
  },
  state: structuredClone(pkg.loop.state),
  workflow: {
    startJobNodeId: nodes[pkg.loop.workflow.startJobNode]!,
    jobNodes: pkg.loop.workflow.jobNodes.map((node) => materializeJob(
      node, nodes[node.key]!, nodes[node.validationNode]!, profiles, instructions, skills
    )),
    validationNodes: pkg.loop.workflow.validationNodes.map((node) => materializeValidation(
      node, nodes[node.key]!, profiles, instructions, skills
    )),
    passEdges: pkg.loop.workflow.passEdges.map((edge) => ({
      id: edges[edge.key]!,
      sourceValidationNodeId: nodes[edge.sourceValidationNode]!,
      target: "jobNode" in edge.target
        ? { jobNodeId: nodes[edge.target.jobNode]! }
        : { workflowResult: "PASS" as const }
    })),
    failEdges: pkg.loop.workflow.failEdges.map((edge) => ({
      id: edges[edge.key]!,
      sourceValidationNodeId: nodes[edge.sourceValidationNode]!,
      target: { workflowResult: "FAIL" as const }
    }))
  }
});

const attachInstalledLoop = (
  automation: ProjectAutomationConfig,
  loopId: string
): ProjectAutomationConfig["graph"] => {
  const edgeIds = [
    ...automation.graph.transitions.map((transition) => transition.id),
    ...automation.graph.repairEdges.map((edge) => edge.id)
  ];
  const hasExistingLoop = automation.loops.length > 0;
  const incomingOutcome = hasExistingLoop ? uniqueTransitionOutcome(
    automation.graph.transitions
      .filter((transition) => transition.source === automation.graph.startLoopId && transition.decision === "PASS")
      .map((transition) => transition.outcome),
    `install_${loopId.replaceAll("-", "_")}`
  ) : undefined;
  const incomingId = hasExistingLoop ? uniqueId(edgeIds, `module-${loopId}-entry`, 200) : undefined;
  const passId = uniqueId(incomingId ? [...edgeIds, incomingId] : edgeIds, `module-${loopId}-pass`, 200);
  const failId = uniqueId(incomingId ? [...edgeIds, incomingId, passId] : [...edgeIds, passId], `module-${loopId}-fail`, 200);
  return {
    ...automation.graph,
    startLoopId: hasExistingLoop ? automation.graph.startLoopId : loopId,
    transitions: [
      ...automation.graph.transitions,
      ...(incomingId && incomingOutcome ? [{
        id: incomingId,
        source: automation.graph.startLoopId,
        decision: "PASS",
        outcome: incomingOutcome,
        target: { loopId },
        description: `Enter installed Loop ${loopId} through an explicit RunBook outcome.`
      } as const] : []),
      {
        id: passId,
        source: loopId,
        decision: "PASS",
        outcome: "success",
        target: { runResult: "DONE" },
        description: `Complete the Graph Run after installed Loop ${loopId} passes.`
      },
      {
        id: failId,
        source: loopId,
        decision: "FAIL",
        outcome: "failure",
        target: { loopId },
        description: `Retry installed Loop ${loopId} after its explicit failure outcome.`
      }
    ]
  };
};

const uniqueTransitionOutcome = (existing: readonly string[], requested: string): string => {
  const base = requested.replace(/[^a-z0-9_]/g, "_").replace(/^[^a-z]+/, "").slice(0, 54) || "installed";
  if (!existing.includes(base)) return base;
  for (let index = 2; index < 10_000; index += 1) {
    const suffix = `_${index}`;
    const candidate = `${base.slice(0, 64 - suffix.length)}${suffix}`;
    if (!existing.includes(candidate)) return candidate;
  }
  throw new LoopModuleConflictError("No unique RunBook outcome is available for the installed Loop.");
};

const materializeJob = (
  node: LoopModuleJobNodeV3,
  id: string,
  validationNodeId: string,
  profiles: Record<string, string>,
  instructions: Record<string, string>,
  skills: Record<string, string>
): ProjectJobNode => {
  const base = {
    id,
    validationNodeId,
    description: node.description,
    task: node.task,
    maxRetries: node.maxRetries,
    nodeStyle: node.nodeStyle,
    nodeSize: node.nodeSize
  };
  if (node.type === "human") return { ...base, type: "human" };
  const composition = {
    executionProfileId: profiles[node.profileSlot]!,
    primaryInstructionId: instructions[node.primaryInstruction]!,
    skillIds: node.skills.map((key) => skills[key]!).sort(compareLoopModuleText)
  };
  if (node.type === "scheduled") return {
    ...base, id, validationNodeId, ...composition, type: "scheduled", schedule: node.schedule
  };
  return { ...base, id, validationNodeId, ...composition, type: "agent" };
};

const materializeValidation = (
  node: LoopModuleValidationNodeV3,
  id: string,
  profiles: Record<string, string>,
  instructions: Record<string, string>,
  skills: Record<string, string>
): ProjectValidationNode => node.type === "human" ? {
  id, description: node.description, task: node.task,
  nodeStyle: node.nodeStyle, nodeSize: node.nodeSize, type: "human"
} : ({
  id, description: node.description, task: node.task,
  nodeStyle: node.nodeStyle, nodeSize: node.nodeSize,
  type: "agent",
  executionProfileId: profiles[node.profileSlot]!,
  primaryInstructionId: instructions[node.primaryInstruction]!,
  skillIds: node.skills.map((key) => skills[key]!).sort(compareLoopModuleText)
});

const materializedResourceSources = (pkg: LoopModulePackageV3, remapping: LoopModuleIdRemapping): Map<string, string> =>
  new Map(pkg.resources.map((resource) => [resource.key, materializedResourceSource(
    resource,
    resource.kind === "instruction" ? remapping.instructions[resource.key]! : remapping.skills[resource.key]!
  )]));

const materializedResourceSource = (resource: LoopModuleResourceV3, resourceId: string): string => {
  if (resource.kind === "instruction") return markdownSource({
    ...resource.metadata,
    id: resourceId.replace(/^project:/, ""),
    title: resource.title
  }, normalizeBody(resource.body));
  return markdownSource({
    ...resource.metadata,
    name: resource.name,
    description: resource.description
  }, normalizeBody(resource.body));
};

const normalizeBody = (body: string): string => body.endsWith("\n") ? body : `${body}\n`;

const writeExclusiveProjectFile = async (root: string, relativePath: string, source: string): Promise<void> => {
  const filename = await resolveSafeProjectPath(root, relativePath);
  await mkdir(path.dirname(filename), { recursive: true });
  const handle = await open(filename, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o666);
  try { await handle.writeFile(source, "utf8"); await handle.sync(); } finally { await handle.close(); }
};

const removeOwnedFile = async (root: string, relativePath: string): Promise<void> => {
  const filename = await resolveSafeProjectPath(root, relativePath);
  await rm(filename, { force: true });
  let directory = path.dirname(filename);
  const stop = path.resolve(root);
  while (directory.startsWith(stop) && directory !== stop) {
    try { await rm(directory); } catch { break; }
    directory = path.dirname(directory);
  }
};

const exportPackage = (
  loop: ProjectLoop,
  profiles: ExecutionProfile[],
  catalog: ProjectResourceCatalog,
  provenance: InstalledLoopModuleStatus | undefined,
  input: ExportInput
): LoopModulePackageV3 => {
  const compositions = [
    ...loop.workflow.jobNodes.filter(isProjectProviderJobNode),
    ...loop.workflow.validationNodes.filter(isProjectAgentValidationNode)
  ];
  const profileIds = [...new Set(compositions.map((composition) => composition.executionProfileId))];
  const provenanceSlots = provenance ? Object.entries(provenance.profileMappings) : undefined;
  const slotEntries = provenanceSlots?.length
    ? provenanceSlots
    : profileIds.map((profileId, index) => [`slot-${index + 1}`, profileId] as const);
  const profileSlots = slotEntries.map(([slotKey, profileId]) => {
    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile) throw new LoopModuleValidationError("Loop references an unknown ExecutionProfile.", [issue("INVALID_SCHEMA", "loop", `Unknown ExecutionProfile ${profileId}.`)]);
    return {
      key: slotKey,
      title: profile.name,
      description: `Compatible ${profile.provider} profile for ${profile.name}.`,
      providers: [profile.provider],
      network: (profile.networkAccess ? "required" : "forbidden") as LoopModuleNetworkRequirement
    };
  });
  const slotByProfile = Object.fromEntries(slotEntries.map(([slotKey, profileId]) => [profileId, slotKey]));
  const instructionIds = [...new Set(compositions.map((composition) => composition.primaryInstructionId))];
  const skillIds = [...new Set(compositions.flatMap((composition) => composition.skillIds))];
  const resourceKeyById = new Map<string, string>();
  const usedKeys = new Set<string>();
  const originalResourceKeys = provenance ? new Map([
    ...Object.entries(provenance.idRemapping.instructions).map(([key, id]) => [id, key] as const),
    ...Object.entries(provenance.idRemapping.skills).map(([key, id]) => [id, key] as const)
  ]) : undefined;
  const keyFor = (id: string): string => {
    const original = originalResourceKeys?.get(id);
    if (original) { usedKeys.add(original); resourceKeyById.set(id, original); return original; }
    const base = slug(id.split(/[/:]/).at(-1) ?? "resource");
    const key = uniqueId([...usedKeys], base, 100);
    usedKeys.add(key); resourceKeyById.set(id, key); return key;
  };
  const resources: LoopModuleResourceV3[] = [
    ...instructionIds.map((id) => {
      const resource = catalog.instructions.find((candidate) => candidate.id === id);
      if (!resource?.valid) throw missingExportResource(id);
      return {
        kind: "instruction" as const,
        key: keyFor(id),
        title: resource.title,
        metadata: omitKeys(resource.frontmatter ?? {}, ["id", "title"]),
        body: resource.body
      };
    }),
    ...skillIds.map((id) => {
      const resource = catalog.skills.find((candidate) => candidate.id === id);
      if (!resource?.valid) throw missingExportResource(id);
      return {
        kind: "skill" as const,
        key: keyFor(id),
        name: resource.name,
        description: resource.description || "Project skill.",
        metadata: omitKeys(resource.frontmatter ?? {}, ["id", "name", "title", "description"]),
        body: resource.body
      };
    })
  ];
  const originalNodeKeys = provenance ? inverse(provenance.idRemapping.nodes) : {};
  const originalEdgeKeys = provenance ? inverse(provenance.idRemapping.edges) : {};
  const workflowNodes = [...loop.workflow.jobNodes, ...loop.workflow.validationNodes];
  const workflowEdges = [...loop.workflow.passEdges, ...loop.workflow.failEdges];
  const nodeKeys = Object.fromEntries(workflowNodes.map((node) => [
    node.id, originalNodeKeys[node.id] ?? localKeyFromMaterialized(loop.id, node.id)
  ]));
  const edgeKeys = Object.fromEntries(workflowEdges.map((edge) => [
    edge.id, originalEdgeKeys[edge.id] ?? localKeyFromMaterialized(loop.id, edge.id)
  ]));
  const toModuleComposition = (composition: ProjectExecutionComposition) => ({
    profileSlot: slotByProfile[composition.executionProfileId]!,
    primaryInstruction: resourceKeyById.get(composition.primaryInstructionId)!,
    skills: composition.skillIds.map((id) => resourceKeyById.get(id)!).sort(compareLoopModuleText)
  });
  const initialObject = loop.state.initial && typeof loop.state.initial === "object" && !Array.isArray(loop.state.initial)
    ? Object.keys(loop.state.initial).sort(compareLoopModuleText) : [];
  const networkSet = new Set(profileSlots.map((slot) => slot.network));
  const network: LoopModuleNetworkRequirement = networkSet.size === 0 ? "optional"
    : networkSet.size === 1 ? [...networkSet][0]! : "optional";
  return {
    format: "ballet-loop-module",
    version: 3,
    manifest: {
      id: slug(input.loopId),
      title: input.title ?? provenance?.title ?? loop.id,
      description: input.description ?? loop.description,
      version: input.version ?? provenance?.moduleVersion ?? "1.0.0",
      ...(input.category ? { category: input.category } : provenance ? { category: "installed" } : { category: "custom" }),
      tags: [...new Set(input.tags ?? [])].sort(compareLoopModuleText)
    },
    permissions: { network, externalWrites: false },
    profileSlots,
    stateContract: provenance?.stateContract ?? {
      id: `${slug(loop.id)}-state`, version: "1.0.0", description: loop.state.description,
      initial: structuredClone(loop.state.initial), requiredKeys: initialObject
    },
    capabilities: {
      requires: provenance?.capabilities.requires ?? [],
      accepts: [...loop.capabilities.accepts],
      provides: [...loop.capabilities.provides],
      recommendedTransitions: provenance?.capabilities.recommendedTransitions ?? [],
      recommendedRepairs: provenance?.capabilities.recommendedRepairs ?? []
    },
    resources,
    loop: {
      key: "loop", description: loop.description, state: structuredClone(loop.state),
      workflow: {
        startJobNode: nodeKeys[loop.workflow.startJobNodeId]!,
        jobNodes: loop.workflow.jobNodes.map((node) => exportJob(
          node, nodeKeys[node.id]!, nodeKeys[node.validationNodeId]!, toModuleComposition
        )),
        validationNodes: loop.workflow.validationNodes.map((node) => exportValidation(
          node, nodeKeys[node.id]!, toModuleComposition
        )),
        passEdges: loop.workflow.passEdges.map((edge) => ({
          key: edgeKeys[edge.id]!,
          sourceValidationNode: nodeKeys[edge.sourceValidationNodeId]!,
          target: "jobNodeId" in edge.target
            ? { jobNode: nodeKeys[edge.target.jobNodeId]! }
            : { workflowResult: "PASS" as const }
        })),
        failEdges: loop.workflow.failEdges.map((edge) => ({
          key: edgeKeys[edge.id]!,
          sourceValidationNode: nodeKeys[edge.sourceValidationNodeId]!,
          target: { workflowResult: "FAIL" as const }
        }))
      }
    }
  };
};

const exportJob = (
  node: ProjectJobNode,
  key: string,
  validationNode: string,
  composition: (value: ProjectExecutionComposition) => {
    profileSlot: string; primaryInstruction: string; skills: string[]
  }
): LoopModuleJobNodeV3 => {
  const base = {
    key,
    validationNode,
    description: node.description,
    task: node.task,
    maxRetries: node.maxRetries,
    nodeStyle: node.nodeStyle,
    nodeSize: node.nodeSize
  };
  if (node.type === "human") return { ...base, type: "human" };
  if (node.type === "scheduled") return {
    ...base, ...composition(node), type: "scheduled", schedule: node.schedule
  };
  return { ...base, ...composition(node), type: "agent" };
};

const exportValidation = (
  node: ProjectValidationNode,
  key: string,
  composition: (value: ProjectExecutionComposition) => {
    profileSlot: string; primaryInstruction: string; skills: string[]
  }
): LoopModuleValidationNodeV3 => node.type === "human"
  ? {
      key, description: node.description, task: node.task,
      nodeStyle: node.nodeStyle, nodeSize: node.nodeSize, type: "human"
    }
  : {
      key, description: node.description, task: node.task,
      nodeStyle: node.nodeStyle, nodeSize: node.nodeSize,
      ...composition(node), type: "agent"
    };

const missingExportResource = (id: string) => new LoopModuleValidationError("Loop export closure is incomplete.", [
  issue("INVALID_SCHEMA", "resources", `Referenced project resource is missing or invalid: ${id}.`)
]);

const profileCompatible = (profile: ExecutionProfile, slot: LoopModulePackageV3["profileSlots"][number]): boolean =>
  slot.providers.includes(profile.provider)
  && (slot.network === "optional" || profile.networkAccess === (slot.network === "required"));

const stateCompatibilityWith = (pkg: LoopModulePackageV3, installed: InstalledLoopModuleV3[]): {
  compatibility: LoopModuleStateCompatibility; comparedWith: string[]
} => {
  const comparable = installed.filter((record) => record.stateContract.id === pkg.stateContract.id);
  if (comparable.length === 0) return { compatibility: "compatible", comparedWith: [] };
  return {
    compatibility: comparable.every((record) =>
      record.stateContract.version === pkg.stateContract.version
      && canonicalLoopModuleJson([...record.stateContract.requiredKeys].sort(compareLoopModuleText))
        === canonicalLoopModuleJson([...pkg.stateContract.requiredKeys].sort(compareLoopModuleText))
      && canonicalLoopModuleJson(record.stateContract.initial) === canonicalLoopModuleJson(pkg.stateContract.initial)
    ) ? "compatible" : "incompatible",
    comparedWith: comparable.map((record) => record.loopId).sort(compareLoopModuleText)
  };
};

const referencedResourceIds = (config: ProjectAutomationConfig): Set<string> => new Set([
  ...(config.orchestrator.repairRouter
    ? [config.orchestrator.repairRouter.primaryInstructionId, ...config.orchestrator.repairRouter.skillIds]
    : []),
  ...config.loops.flatMap((loop) => [
    ...loop.workflow.jobNodes.flatMap((node) =>
      isProjectProviderJobNode(node) ? [node.primaryInstructionId, ...node.skillIds] : []),
    ...loop.workflow.validationNodes.flatMap((node) =>
      isProjectAgentValidationNode(node) ? [node.primaryInstructionId, ...node.skillIds] : [])
  ])
].filter(Boolean));

const contentHash = (loop: ProjectLoop, resources: Array<{ relativePath: string; sha256: string }>): string =>
  loopModuleSha256(canonicalLoopModuleJson({
    loop,
    resources: [...resources].sort((left, right) => compareLoopModuleText(left.relativePath, right.relativePath))
  }));

const automationOf = (config: ProjectConfiguration): ProjectAutomationConfig => ({
  version: 13, orchestrator: config.orchestrator, graph: config.graph, loops: config.loops
});

const walkLibrary = async (root: string, relativeDirectory: string): Promise<string[]> => {
  const directory = await resolveSafeProjectPath(root, relativeDirectory);
  let entries: Dirent[];
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (isMissing(error)) return []; throw error; }
  const symlink = entries.find((entry) => entry.isSymbolicLink());
  if (symlink) throw new LoopModuleValidationError("Loop Library contains a symbolic link.", [issue(
    "FORBIDDEN_CONTENT", `${relativeDirectory}/${symlink.name}`, "Symbolic links are forbidden in Loop Library paths."
  )]);
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".ballet-loop.json"))
    .map((entry) => posix(path.join(relativeDirectory, entry.name)));
  const nested = await Promise.all(entries.filter((entry) => entry.isDirectory())
    .map((entry) => walkLibrary(root, posix(path.join(relativeDirectory, entry.name)))));
  return [...files, ...nested.flat()].sort(compareLoopModuleText);
};

const forbiddenPackageIssue = (value: unknown, currentPath = "$", key?: string): LoopModuleIssue | undefined => {
  if (key && /^(?:graph|loopEdges|targetLoopId|peerLoopId|nextLoopId|repairTargetLoopId|continuationLoopId)$/i.test(key)) {
    return issue("FORBIDDEN_CONTENT", currentPath, `Project-global routing and target selection metadata is forbidden (${key}).`);
  }
  if (key && /^(?:password|secret|token|credential|credentials|history|consoleHistory|command|commands|script|scripts|hook|hooks|postInstall|post-install|symlink)$/i.test(key)) {
    return issue("FORBIDDEN_CONTENT", currentPath, `Executable, credential, and runtime-history metadata is forbidden (${key}).`);
  }
  if (typeof value === "string") return forbiddenStringIssue(value, currentPath, key);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = forbiddenPackageIssue(value[index], `${currentPath}[${index}]`);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const [childKey, child] of Object.entries(value)) {
    const found = forbiddenPackageIssue(child, `${currentPath}.${childKey}`, childKey);
    if (found) return found;
  }
  return undefined;
};

const forbiddenStringIssue = (value: string, currentPath: string, key?: string): LoopModuleIssue | undefined => {
  if (/\b(?:targetLoopId|peerLoopId|nextLoopId|repairTargetLoopId|continuationLoopId)\b/i.test(value)
    || /\b(?:target|peer|next|repair target)\s+Loop\s+ID\b/i.test(value)) {
    return issue("FORBIDDEN_CONTENT", currentPath, "Loop packages and resources must not select or name a peer Loop target.");
  }
  if (value.includes("\0")) return issue("FORBIDDEN_CONTENT", currentPath, "NUL characters are forbidden.");
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)) return issue("FORBIDDEN_CONTENT", currentPath, "Private key material is forbidden.");
  if (/\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/.test(value)) return issue("FORBIDDEN_CONTENT", currentPath, "Credential-like secret material is forbidden.");
  if (/(?:^|[\s`'"/])\.git\/ballet(?:[\s`'"/]|$)/.test(value)) return issue("FORBIDDEN_CONTENT", currentPath, "Checkout-local .git/ballet runtime data is forbidden.");
  if (/(?:^|[\s`'"])(?:\/Users\/|\/home\/|\/var\/folders\/|[A-Za-z]:\\)/.test(value)) return issue("FORBIDDEN_CONTENT", currentPath, "Absolute filesystem roots are forbidden.");
  if (key && /(?:path|root|file)$/i.test(key) && path.isAbsolute(value)) return issue("FORBIDDEN_CONTENT", currentPath, "Absolute paths are forbidden.");
  return undefined;
};

const peerLoopReferenceIssues = (
  pkg: LoopModulePackageV3,
  projectLoops: readonly ProjectLoop[]
): LoopModuleIssue[] => {
  const peers = projectLoops.map((loop) => loop.id)
    .filter((loopId) => loopId !== pkg.manifest.id && loopId !== pkg.loop.key);
  if (peers.length === 0) return [];
  const stack: Array<{ value: unknown; path: string }> = [{ value: pkg, path: "$" }];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (typeof current.value === "string") {
      const peer = peers.find((loopId) => namesPeerLoop(current.value as string, loopId));
      if (peer) return [issue(
        "FORBIDDEN_CONTENT",
        current.path,
        `Reusable Loop content must not name peer Loop id ${peer}.`
      )];
      continue;
    }
    if (Array.isArray(current.value)) {
      current.value.forEach((child, index) => stack.push({ value: child, path: `${current.path}[${index}]` }));
      continue;
    }
    if (isRecord(current.value)) Object.entries(current.value).forEach(([childKey, child]) =>
      stack.push({ value: child, path: `${current.path}.${childKey}` }));
  }
  return [];
};

const namesPeerLoop = (value: string, loopId: string): boolean => {
  const escaped = escapeRegExp(loopId);
  if (loopId.includes("-")) {
    return new RegExp(`(^|[^a-z0-9-])${escaped}([^a-z0-9-]|$)`, "i").test(value);
  }
  return new RegExp(
    "(?:`" + escaped + "`|\\bLoop\\s+" + escaped + "\\b|\\b" + escaped + "\\s+Loop\\b)",
    "i"
  ).test(value);
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const zodIssue = (value: z.core.$ZodIssue): LoopModuleIssue => issue(
  value.code === "unrecognized_keys" ? "UNKNOWN_FIELD"
    : /(?:must be unique|keys must be unique)/i.test(value.message) ? "DUPLICATE_ID"
      : "INVALID_SCHEMA",
  value.path.length ? value.path.map(String).join(".") : "$",
  value.message
);
const issue = (code: LoopModuleErrorCode, issuePath: string, message: string): LoopModuleIssue => ({ code, path: issuePath, message });
const invalidInspection = (source: string, sizeBytes: number, ...issues: LoopModuleIssue[]): LoopModuleInspection => ({
  valid: false, source, sizeBytes, issues
});
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isMissing = (error: unknown): boolean => error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
const posix = (value: string): string => value.split(path.sep).join("/");
const slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "loop-module";
const uniqueId = (values: readonly string[], requested: string, maxLength: number): string => {
  const existing = new Set(values);
  const base = requested.slice(0, maxLength).replace(/-+$/g, "") || "module";
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (true) {
    const tail = `-${suffix}`;
    const candidate = `${base.slice(0, maxLength - tail.length).replace(/-+$/g, "")}${tail}`;
    if (!existing.has(candidate)) return candidate;
    suffix += 1;
  }
};
const localKeyFromMaterialized = (loopId: string, value: string): string => {
  const withoutNamespace = value.startsWith(`${loopId}-`) ? value.slice(loopId.length + 1) : value;
  return slug(withoutNamespace);
};
const omitKeys = (value: Record<string, unknown>, keys: string[]): Record<string, never> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key))) as Record<string, never>;
const inverse = (value: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(value).map(([key, mapped]) => [mapped, key]));
