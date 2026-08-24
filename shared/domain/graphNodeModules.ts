import type { JsonValue, NodeResult, ProjectGraphNode, ProjectNodeAppearance } from "./automation.js";
import type { ProjectScopedRewardDecisionStrategyV4 } from "./decisionModel.js";

export const graphNodeModulePackageVersion = 7 as const;
export const maxGraphNodeModulePackageBytes = 524_288;
export const maxGraphNodeModuleResources = 64;
export const maxGraphNodeModuleNodes = 64;
export const maxGraphNodeModuleStringLength = 20_000;
export const maxGraphNodeModuleResourceBodyBytes = 131_072;

export type GraphNodeModuleNetworkRequirement = "required" | "forbidden" | "optional";
export type GraphNodeModuleExternalWritesPermission = false | "requires-human-authorization";
export type GraphNodeModuleProvenanceStatus = "exact" | "modified" | "missing-resources";

export interface GraphNodeModuleManifestV7 {
  id: string; title: string; description: string; version: string; category?: string; tags: string[];
}
export interface GraphNodeModulePermissionsV7 {
  network: GraphNodeModuleNetworkRequirement; externalWrites: GraphNodeModuleExternalWritesPermission;
}
export interface GraphNodeModuleProfileSlotV7 {
  key: string; title: string; description: string; providers: Array<"codex" | "copilot">;
  network: GraphNodeModuleNetworkRequirement;
}
export interface GraphNodeModuleCompositionV7 { profileSlot: string; primaryInstruction: string; skills: string[]; }
export interface GraphNodeModuleIntrinsicOutcomeV7 { outcomeId: string; result: NodeResult; }
export interface GraphNodeModuleExecutableV7 extends ProjectNodeAppearance {
  key: string; description: string; task: string;
}
export type GraphNodeModuleWorkNodeV7 =
  | GraphNodeModuleExecutableV7 & GraphNodeModuleCompositionV7 & { type: "agent" }
  | GraphNodeModuleExecutableV7 & { type: "human" };
export type GraphNodeModuleValidationNodeV7 =
  | GraphNodeModuleExecutableV7 & GraphNodeModuleCompositionV7 & { type: "agent" }
  | GraphNodeModuleExecutableV7 & { type: "human" };
export interface GraphNodeModuleActionNodeV7 {
  key: string; description: string; capabilities: { accepts: string[]; provides: string[] };
  outcomes: GraphNodeModuleIntrinsicOutcomeV7[]; maxRetries: number;
  workNode: GraphNodeModuleWorkNodeV7; validationNode: GraphNodeModuleValidationNodeV7;
}
export interface GraphNodeModuleGraphNodeV7 {
  key: string; description: string; capabilities: { accepts: string[]; provides: string[] };
  outcomes: GraphNodeModuleIntrinsicOutcomeV7[]; stateContract: { description: string };
  strategy: ProjectScopedRewardDecisionStrategyV4;
  actionNodes: GraphNodeModuleActionNodeV7[];
}
export type GraphNodeModuleResourceV7 =
  | { kind: "instruction"; key: string; title: string; metadata: Record<string, JsonValue>; body: string }
  | { kind: "skill"; key: string; name: string; description: string; metadata: Record<string, JsonValue>; body: string };
export interface GraphNodeModuleStateContractV7 {
  id: string; version: string; description: string; requiredKeys: string[];
}
export interface GraphNodeModuleCapabilitiesV7 { requires: string[]; accepts: string[]; provides: string[]; }
export interface GraphNodeModulePackageV7 {
  format: "ballet-graph-node-module";
  version: typeof graphNodeModulePackageVersion;
  manifest: GraphNodeModuleManifestV7;
  permissions: GraphNodeModulePermissionsV7;
  profileSlots: GraphNodeModuleProfileSlotV7[];
  stateContract: GraphNodeModuleStateContractV7;
  capabilities: GraphNodeModuleCapabilitiesV7;
  resources: GraphNodeModuleResourceV7[];
  graphNode: GraphNodeModuleGraphNodeV7;
}

export type GraphNodeModuleErrorCode =
  | "INVALID_JSON" | "INVALID_UTF8" | "PACKAGE_TOO_LARGE" | "SCHEMA_DOWNGRADE"
  | "INVALID_SCHEMA" | "UNKNOWN_FIELD" | "DUPLICATE_ID" | "FORBIDDEN_CONTENT"
  | "PROFILE_MAPPING_REQUIRED" | "PROFILE_INCOMPATIBLE" | "NETWORK_PERMISSION_MISMATCH"
  | "STATE_CONTRACT_INCOMPATIBLE" | "ID_CONFLICT" | "RESOURCE_CONFLICT" | "OWNERSHIP_CONFLICT"
  | "ACTIVE_RUN" | "PLAN_STALE" | "GRAPH_NODE_NOT_FOUND" | "MODULE_NOT_INSTALLED";
export interface GraphNodeModuleIssue { code: GraphNodeModuleErrorCode; path: string; message: string; }
export interface GraphNodeModuleInspection {
  valid: boolean; package?: GraphNodeModulePackageV7; sha256?: string; canonicalJson?: string;
  source: string; sizeBytes: number; issues: GraphNodeModuleIssue[];
}
export interface GraphNodeModuleIdRemapping {
  graphNode: Record<string, string>; nodes: Record<string, string>;
  instructions: Record<string, string>; skills: Record<string, string>;
}
export interface GraphNodeModuleProfileCandidate {
  id: string; name: string; provider: "codex" | "copilot"; networkAccess: boolean;
}
export interface GraphNodeModuleProfileMappingPlan {
  slot: GraphNodeModuleProfileSlotV7; selectedProfileId?: string; candidates: GraphNodeModuleProfileCandidate[];
  compatible: boolean; issue?: GraphNodeModuleIssue;
}
export interface GraphNodeModuleResourceWritePlan {
  kind: "instruction" | "skill"; key: string; resourceId: string; relativePath: string;
  sha256: string; bytes: number; action: "create" | "conflict";
}
export interface GraphNodeModuleConflict {
  kind: "id" | "resource" | "ownership"; code: "ID_CONFLICT" | "RESOURCE_CONFLICT" | "OWNERSHIP_CONFLICT";
  target: string; message: string; blocking: boolean;
}
export interface GraphNodeModuleInstallPlan {
  planHash: string; packageSha256: string; source: string; module: GraphNodeModuleManifestV7;
  graphNode: ProjectGraphNode; idRemapping: GraphNodeModuleIdRemapping;
  resources: GraphNodeModuleResourceWritePlan[]; profileMappings: GraphNodeModuleProfileMappingPlan[];
  conflicts: GraphNodeModuleConflict[]; issues: GraphNodeModuleIssue[]; canInstall: boolean;
}
export interface GraphNodeModuleOwnedResource {
  kind: "instruction" | "skill"; resourceId: string; relativePath: string; installedSha256: string;
}
export interface InstalledGraphNodeModuleV7 {
  moduleId: string; moduleVersion: string; title: string; source: string; packageSha256: string;
  graphNodeId: string; installedAt: string; profileMappings: Record<string, string>;
  idRemapping: GraphNodeModuleIdRemapping; stateContract: GraphNodeModuleStateContractV7;
  capabilities: GraphNodeModuleCapabilitiesV7; ownedResources: GraphNodeModuleOwnedResource[];
  installedContentSha256: string;
}
export interface InstalledGraphNodeModulesFileV7 { version: 7; installed: InstalledGraphNodeModuleV7[]; }
export interface InstalledGraphNodeModuleStatus extends InstalledGraphNodeModuleV7 {
  status: GraphNodeModuleProvenanceStatus; currentContentSha256?: string; missingResources: string[];
}
export interface GraphNodeModuleLibraryEntry {
  source: string; sha256?: string; sizeBytes: number; valid: boolean; manifest?: GraphNodeModuleManifestV7;
  permissions?: GraphNodeModulePermissionsV7; package?: GraphNodeModulePackageV7; issues: GraphNodeModuleIssue[];
}
export interface GraphNodeModuleExportResult {
  package: GraphNodeModulePackageV7; canonicalJson: string; sha256: string; filename: string;
}
