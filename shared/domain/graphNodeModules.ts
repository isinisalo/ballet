import type { JsonValue, NodeResult, ProjectGraphNode, ProjectNodeAppearance } from "./automation.js";

export const graphNodeModulePackageVersion = 6 as const;
export const maxGraphNodeModulePackageBytes = 524_288;
export const maxGraphNodeModuleResources = 64;
export const maxGraphNodeModuleNodes = 64;
export const maxGraphNodeModuleStringLength = 20_000;
export const maxGraphNodeModuleResourceBodyBytes = 131_072;

export type GraphNodeModuleNetworkRequirement = "required" | "forbidden" | "optional";
export type GraphNodeModuleExternalWritesPermission = false | "requires-human-authorization";
export type GraphNodeModuleProvenanceStatus = "exact" | "modified" | "missing-resources";

export interface GraphNodeModuleManifestV6 {
  id: string; title: string; description: string; version: string; category?: string; tags: string[];
}
export interface GraphNodeModulePermissionsV6 {
  network: GraphNodeModuleNetworkRequirement; externalWrites: GraphNodeModuleExternalWritesPermission;
}
export interface GraphNodeModuleProfileSlotV6 {
  key: string; title: string; description: string; providers: Array<"codex" | "copilot">;
  network: GraphNodeModuleNetworkRequirement;
}
export interface GraphNodeModuleCompositionV6 { profileSlot: string; primaryInstruction: string; skills: string[]; }
export interface GraphNodeModuleIntrinsicOutcomeV6 { outcomeId: string; result: NodeResult; }
export interface GraphNodeModuleExecutableV6 extends ProjectNodeAppearance {
  key: string; description: string; task: string;
}
export type GraphNodeModuleWorkNodeV6 =
  | GraphNodeModuleExecutableV6 & GraphNodeModuleCompositionV6 & { type: "agent" }
  | GraphNodeModuleExecutableV6 & { type: "human" };
export type GraphNodeModuleValidationNodeV6 =
  | GraphNodeModuleExecutableV6 & GraphNodeModuleCompositionV6 & { type: "agent" }
  | GraphNodeModuleExecutableV6 & { type: "human" };
export interface GraphNodeModuleActionNodeV6 {
  key: string; description: string; capabilities: { accepts: string[]; provides: string[] };
  outcomes: GraphNodeModuleIntrinsicOutcomeV6[]; maxRetries: number;
  workNode: GraphNodeModuleWorkNodeV6; validationNode: GraphNodeModuleValidationNodeV6;
}
export interface GraphNodeModuleGraphNodeV6 {
  key: string; description: string; capabilities: { accepts: string[]; provides: string[] };
  outcomes: GraphNodeModuleIntrinsicOutcomeV6[]; stateContract: { description: string };
  actionNodes: GraphNodeModuleActionNodeV6[];
}
export type GraphNodeModuleResourceV6 =
  | { kind: "instruction"; key: string; title: string; metadata: Record<string, JsonValue>; body: string }
  | { kind: "skill"; key: string; name: string; description: string; metadata: Record<string, JsonValue>; body: string };
export interface GraphNodeModuleStateContractV6 {
  id: string; version: string; description: string; requiredKeys: string[];
}
export interface GraphNodeModuleCapabilitiesV6 { requires: string[]; accepts: string[]; provides: string[]; }
export interface GraphNodeModulePackageV6 {
  format: "ballet-graph-node-module";
  version: typeof graphNodeModulePackageVersion;
  manifest: GraphNodeModuleManifestV6;
  permissions: GraphNodeModulePermissionsV6;
  profileSlots: GraphNodeModuleProfileSlotV6[];
  stateContract: GraphNodeModuleStateContractV6;
  capabilities: GraphNodeModuleCapabilitiesV6;
  resources: GraphNodeModuleResourceV6[];
  graphNode: GraphNodeModuleGraphNodeV6;
}

export type GraphNodeModuleErrorCode =
  | "INVALID_JSON" | "INVALID_UTF8" | "PACKAGE_TOO_LARGE" | "SCHEMA_DOWNGRADE"
  | "INVALID_SCHEMA" | "UNKNOWN_FIELD" | "DUPLICATE_ID" | "FORBIDDEN_CONTENT"
  | "PROFILE_MAPPING_REQUIRED" | "PROFILE_INCOMPATIBLE" | "NETWORK_PERMISSION_MISMATCH"
  | "STATE_CONTRACT_INCOMPATIBLE" | "ID_CONFLICT" | "RESOURCE_CONFLICT" | "OWNERSHIP_CONFLICT"
  | "ACTIVE_RUN" | "PLAN_STALE" | "GRAPH_NODE_NOT_FOUND" | "MODULE_NOT_INSTALLED";
export interface GraphNodeModuleIssue { code: GraphNodeModuleErrorCode; path: string; message: string; }
export interface GraphNodeModuleInspection {
  valid: boolean; package?: GraphNodeModulePackageV6; sha256?: string; canonicalJson?: string;
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
  slot: GraphNodeModuleProfileSlotV6; selectedProfileId?: string; candidates: GraphNodeModuleProfileCandidate[];
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
  planHash: string; packageSha256: string; source: string; module: GraphNodeModuleManifestV6;
  graphNode: ProjectGraphNode; idRemapping: GraphNodeModuleIdRemapping;
  resources: GraphNodeModuleResourceWritePlan[]; profileMappings: GraphNodeModuleProfileMappingPlan[];
  conflicts: GraphNodeModuleConflict[]; issues: GraphNodeModuleIssue[]; canInstall: boolean;
}
export interface GraphNodeModuleOwnedResource {
  kind: "instruction" | "skill"; resourceId: string; relativePath: string; installedSha256: string;
}
export interface InstalledGraphNodeModuleV6 {
  moduleId: string; moduleVersion: string; title: string; source: string; packageSha256: string;
  graphNodeId: string; installedAt: string; profileMappings: Record<string, string>;
  idRemapping: GraphNodeModuleIdRemapping; stateContract: GraphNodeModuleStateContractV6;
  capabilities: GraphNodeModuleCapabilitiesV6; ownedResources: GraphNodeModuleOwnedResource[];
  installedContentSha256: string;
}
export interface InstalledGraphNodeModulesFileV6 { version: 6; installed: InstalledGraphNodeModuleV6[]; }
export interface InstalledGraphNodeModuleStatus extends InstalledGraphNodeModuleV6 {
  status: GraphNodeModuleProvenanceStatus; currentContentSha256?: string; missingResources: string[];
}
export interface GraphNodeModuleLibraryEntry {
  source: string; sha256?: string; sizeBytes: number; valid: boolean; manifest?: GraphNodeModuleManifestV6;
  permissions?: GraphNodeModulePermissionsV6; package?: GraphNodeModulePackageV6; issues: GraphNodeModuleIssue[];
}
export interface GraphNodeModuleExportResult {
  package: GraphNodeModulePackageV6; canonicalJson: string; sha256: string; filename: string;
}
