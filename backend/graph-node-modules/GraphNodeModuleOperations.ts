import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ProjectGraphNode } from "../../shared/domain/automation.js";
import type {
  GraphNodeModuleInstallPlan,
  GraphNodeModuleIssue,
  GraphNodeModulePackageV6,
  GraphNodeModuleResourceV6,
  InstalledGraphNodeModuleV6
} from "../../shared/domain/graphNodeModules.js";
import type { ExecutionProfile, ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import {
  graphNodeCompositions,
  localResourceKey,
  materializeGraphNode,
  moduleRemapping,
  renderResource
} from "./GraphNodeModuleMapping.js";

export function createModulePlan(
  pkg: GraphNodeModulePackageV6,
  packageSha256: string,
  source: string,
  mappings: Record<string, string>,
  project: ProjectConfiguration
): GraphNodeModuleInstallPlan {
  const issues: GraphNodeModuleIssue[] = [];
  const profileMappings = pkg.profileSlots.map((slot) => {
    const candidates = project.executionProfiles.filter((profile) =>
      slot.providers.includes(profile.provider) && networkCompatible(slot.network, profile)).map(profileCandidate);
    const selectedProfileId = mappings[slot.key];
    const selected = candidates.find(({ id }) => id === selectedProfileId);
    const issue = !selectedProfileId ? {
      code: "PROFILE_MAPPING_REQUIRED" as const, path: `profileMappings.${slot.key}`, message: "Choose an execution profile."
    } : !selected ? {
      code: "PROFILE_INCOMPATIBLE" as const, path: `profileMappings.${slot.key}`, message: `Profile ${selectedProfileId} is incompatible.`
    } : undefined;
    if (issue) issues.push(issue);
    return { slot, selectedProfileId, candidates, compatible: Boolean(selected), issue };
  });
  const profiles = new Map(profileMappings.flatMap((mapping) =>
    mapping.selectedProfileId ? [[mapping.slot.key, mapping.selectedProfileId] as const] : []));
  const idRemapping = moduleRemapping(pkg);
  const graphNode = materializeGraphNode(pkg.graphNode, idRemapping, profiles);
  if (project.graph.graphNodes.some(({ id }) => id === graphNode.id)) issues.push({
    code: "ID_CONFLICT", path: "graphNode.key", message: `Graph Node ${graphNode.id} already exists.`
  });
  const resources = pkg.resources.map((resource) => resourcePlan(resource, idRemapping));
  const base = {
    packageSha256, source, module: pkg.manifest, graphNode, idRemapping, resources, profileMappings,
    conflicts: [], issues, canInstall: issues.length === 0
  };
  return { ...base, planHash: moduleSha256(canonicalModuleJson(base)) };
}

export function installModuleGraphNode(
  config: ProjectConfiguration,
  graphNode: ProjectGraphNode
): ProjectConfiguration {
  const catalog = config.graph.strategy.capabilityModel;
  const existingOutcomes = new Map(catalog.outcomes.map((outcome) => [outcome.id, outcome]));
  const outcomes = [...catalog.outcomes];
  for (const intrinsic of graphNode.outcomes) if (!existingOutcomes.has(intrinsic.outcomeId)) outcomes.push({
    id: intrinsic.outcomeId,
    description: `${graphNode.id}: ${intrinsic.outcomeId}`,
    result: intrinsic.result,
    penaltyClass: intrinsic.result === "PASS" ? "none" : "implementation_defect"
  });
  return {
    ...config,
    graph: {
      ...config.graph,
      graphNodes: [...config.graph.graphNodes, graphNode],
      strategy: {
        ...config.graph.strategy,
        capabilityModel: {
          version: 3,
          outcomes,
          actions: [...catalog.actions, { actionId: graphNode.id, guards: [] }]
        }
      }
    }
  };
}

export function removeModuleGraphNode(config: ProjectConfiguration, graphNodeId: string) {
  const graphNodes = config.graph.graphNodes.filter(({ id }) => id !== graphNodeId);
  if (graphNodes.length === 0) return undefined;
  const usedOutcomes = new Set(graphNodes.flatMap(({ outcomes }) => outcomes.map(({ outcomeId }) => outcomeId)));
  return {
    ...config.graph,
    graphNodes,
    strategy: {
      ...config.graph.strategy,
      capabilityModel: {
        version: 3 as const,
        actions: config.graph.strategy.capabilityModel.actions.filter(({ actionId }) => actionId !== graphNodeId),
        outcomes: config.graph.strategy.capabilityModel.outcomes.filter(({ id }) => usedOutcomes.has(id))
      },
      model: {
        ...config.graph.strategy.model,
        stateActions: config.graph.strategy.model.stateActions.filter(({ actionId }) => actionId !== graphNodeId)
      }
    }
  };
}

export function installedModuleRecord(
  pkg: GraphNodeModulePackageV6,
  packageSha256: string,
  source: string,
  plan: GraphNodeModuleInstallPlan,
  persisted: ProjectGraphNode
): InstalledGraphNodeModuleV6 {
  const resourceHashes = plan.resources.map(({ relativePath, sha256: digest }) => ({ relativePath, sha256: digest }));
  return {
    moduleId: pkg.manifest.id, moduleVersion: pkg.manifest.version, title: pkg.manifest.title,
    source, packageSha256, graphNodeId: plan.graphNode.id, installedAt: new Date().toISOString(),
    profileMappings: Object.fromEntries(plan.profileMappings.map((mapping) => [mapping.slot.key, mapping.selectedProfileId!])),
    idRemapping: plan.idRemapping, stateContract: pkg.stateContract, capabilities: pkg.capabilities,
    ownedResources: plan.resources.map((resource) => ({
      kind: resource.kind, resourceId: resource.resourceId, relativePath: resource.relativePath,
      installedSha256: resource.sha256
    })),
    installedContentSha256: moduleContentHash(persisted, resourceHashes)
  };
}

export function moduleExportResources(
  compositions: ReturnType<typeof graphNodeCompositions>,
  catalog: Awaited<ReturnType<typeof import("../documents/projectResourceCatalog.js").loadProjectResources>>
): GraphNodeModuleResourceV6[] | undefined {
  const ids = [...new Set(compositions.flatMap((composition) =>
    [composition.primaryInstructionId, ...composition.skillIds]))];
  const resources: GraphNodeModuleResourceV6[] = [];
  for (const resourceId of ids) {
    const instruction = catalog.instructions.find(({ id }) => id === resourceId);
    if (instruction) {
      resources.push({
        kind: "instruction", key: localResourceKey(resourceId), title: instruction.title, metadata: {}, body: instruction.body
      });
      continue;
    }
    const skill = catalog.skills.find(({ id }) => id === resourceId);
    if (!skill) return undefined;
    resources.push({
      kind: "skill", key: localResourceKey(resourceId), name: skill.name,
      description: skill.description, metadata: skill.metadata, body: skill.body
    });
  }
  return resources;
}

export const moduleSourceIssues = (issues: Array<{ path: string; message: string }>): GraphNodeModuleIssue[] =>
  issues.map((issue) => ({ code: "INVALID_SCHEMA", ...issue }));
export const installedModulesPath = (root: string) => path.join(root, ".ballet", "graph-node-modules.json");
export const invalidModuleInspection = (
  source: string,
  raw: string,
  code: GraphNodeModuleIssue["code"],
  message: string
) => ({ valid: false as const, source, sizeBytes: Buffer.byteLength(raw), issues: [{ code, path: "package", message }] });
export const canonicalModuleJson = (value: unknown): string => JSON.stringify(sortValue(value));
export const moduleSha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const walkModuleLibrary = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.filter((entry) => entry.isDirectory())
    .map((entry) => walkModuleLibrary(path.join(directory, entry.name))));
  return [...entries.filter((entry) => !entry.isDirectory()).map((entry) => path.join(directory, entry.name)), ...nested.flat()];
};
export const moduleContentHash = (
  graphNode: ProjectGraphNode,
  resources: Array<{ relativePath: string; sha256: string }>
) => moduleSha256(canonicalModuleJson({
  graphNode,
  resources: [...resources].sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}));

const resourcePlan = (resource: GraphNodeModuleResourceV6, remap: ReturnType<typeof moduleRemapping>) => {
  const resourceId = resource.kind === "instruction" ? remap.instructions[resource.key] : remap.skills[resource.key];
  const relativePath = resource.kind === "instruction"
    ? `.ballet/instructions/${resourceId.slice(8)}.md` : `.agents/skills/${resourceId.slice(8)}/SKILL.md`;
  const rendered = renderResource(resourceId, resource);
  return {
    kind: resource.kind, key: resource.key, resourceId, relativePath,
    sha256: moduleSha256(rendered), bytes: Buffer.byteLength(rendered), action: "create" as const
  };
};
const sortValue = (value: unknown): unknown => Array.isArray(value) ? value.map(sortValue)
  : isRecord(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])])) : value;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const profileCandidate = (profile: ExecutionProfile) => ({
  id: profile.id, name: profile.name, provider: profile.provider, networkAccess: profile.networkAccess
});
const networkCompatible = (requirement: string, profile: ExecutionProfile) =>
  requirement === "optional" || (requirement === "required") === profile.networkAccess;
