import type { JsonValue, ProjectGraphNode, ProjectNodeAppearance } from "./automation.js";

export const graphNodeModulePackageVersion = 4 as const;
export const maxGraphNodeModulePackageBytes = 524_288;
export const maxGraphNodeModuleResources = 64;
export const maxGraphNodeModuleNodes = 64;
export const maxGraphNodeModuleRules = 256;
export const maxGraphNodeModuleStringLength = 20_000;
export const maxGraphNodeModuleResourceBodyBytes = 131_072;

export type GraphNodeModuleNetworkRequirement = "required" | "forbidden" | "optional";
export type GraphNodeModuleExternalWritesPermission = false | "requires-human-authorization";
export type GraphNodeModuleProvenanceStatus = "exact" | "modified" | "missing-resources";
export type GraphNodeModuleStateCompatibility = "compatible" | "incompatible" | "unknown";

export interface GraphNodeModuleManifestV4 {
  id: string;
  title: string;
  description: string;
  version: string;
  category?: string;
  tags: string[];
}
export interface GraphNodeModulePermissionsV4 {
  network: GraphNodeModuleNetworkRequirement;
  externalWrites: GraphNodeModuleExternalWritesPermission;
}
export interface GraphNodeModuleProfileSlotV4 {
  key: string;
  title: string;
  description: string;
  providers: Array<"codex" | "copilot">;
  network: GraphNodeModuleNetworkRequirement;
}
export interface GraphNodeModuleCompositionV4 {
  profileSlot: string;
  primaryInstruction: string;
  skills: string[];
}
export interface GraphNodeModuleExecutableV4 extends ProjectNodeAppearance {
  key: string;
  description: string;
  task: string;
}
export type GraphNodeModuleWorkNodeV4 =
  | GraphNodeModuleExecutableV4 & GraphNodeModuleCompositionV4 & { type: "agent" }
  | GraphNodeModuleExecutableV4 & { type: "human" };
export type GraphNodeModuleValidationNodeV4 =
  | GraphNodeModuleExecutableV4 & GraphNodeModuleCompositionV4 & { type: "agent" }
  | GraphNodeModuleExecutableV4 & { type: "human" };
export interface GraphNodeModuleJobNodeV4 extends ProjectNodeAppearance {
  key: string;
  description: string;
  capabilities: { accepts: string[]; provides: string[] };
  maxRetries: number;
  workNode: GraphNodeModuleWorkNodeV4;
  validationNode: GraphNodeModuleValidationNodeV4;
}
export type GraphNodeModuleRouteTargetV4 = { jobNode: string } | { terminal: "PASS" | "FAIL" };
export interface GraphNodeModuleCandidateV4 { target: GraphNodeModuleRouteTargetV4; description: string; }
export interface GraphNodeModuleOrchestratorV4 extends ProjectNodeAppearance, GraphNodeModuleCompositionV4 {
  key: string;
  description: string;
  maxTransitions: number;
  maxRouteAttempts: number;
  routing: {
    start: { key: string; candidates: GraphNodeModuleCandidateV4[] };
    continuation: Array<{
      key: string;
      sourceJobNode: string;
      result: "PASS" | "FAIL";
      candidates: GraphNodeModuleCandidateV4[];
    }>;
    repair: Array<{
      key: string;
      sourceJobNode: string;
      capability: string;
      candidates: GraphNodeModuleCandidateV4[];
    }>;
  };
}
export interface GraphNodeModuleRepairNodeV4 extends ProjectNodeAppearance, GraphNodeModuleCompositionV4 {
  key: string;
  description: string;
  task: string;
  maxRepairDepth: number;
  maxRepairAttempts: number;
}
export interface GraphNodeModuleGraphNodeV4 extends ProjectNodeAppearance {
  key: string;
  description: string;
  capabilities: { accepts: string[]; provides: string[] };
  stateContract: { description: string };
  orchestrator: GraphNodeModuleOrchestratorV4;
  repairNode?: GraphNodeModuleRepairNodeV4;
  jobNodes: GraphNodeModuleJobNodeV4[];
}
export type GraphNodeModuleResourceV4 =
  | { kind: "instruction"; key: string; title: string; metadata: Record<string, JsonValue>; body: string }
  | { kind: "skill"; key: string; name: string; description: string; metadata: Record<string, JsonValue>; body: string };
export interface GraphNodeModuleStateContractV4 {
  id: string;
  version: string;
  description: string;
  requiredKeys: string[];
}
export interface GraphNodeModuleRecommendedGraphRouteV4 {
  direction: "incoming" | "outgoing";
  result: "PASS" | "FAIL";
  capability: string;
  description: string;
}
export interface GraphNodeModuleCapabilitiesV4 {
  requires: string[];
  accepts: string[];
  provides: string[];
  recommendedGraphRoutes: GraphNodeModuleRecommendedGraphRouteV4[];
}
export interface GraphNodeModulePackageV4 {
  format: "ballet-graph-node-module";
  version: typeof graphNodeModulePackageVersion;
  manifest: GraphNodeModuleManifestV4;
  permissions: GraphNodeModulePermissionsV4;
  profileSlots: GraphNodeModuleProfileSlotV4[];
  stateContract: GraphNodeModuleStateContractV4;
  capabilities: GraphNodeModuleCapabilitiesV4;
  resources: GraphNodeModuleResourceV4[];
  graphNode: GraphNodeModuleGraphNodeV4;
}

export type GraphNodeModuleErrorCode =
  | "INVALID_JSON" | "INVALID_UTF8" | "PACKAGE_TOO_LARGE" | "SCHEMA_DOWNGRADE"
  | "INVALID_SCHEMA" | "UNKNOWN_FIELD" | "DUPLICATE_ID" | "FORBIDDEN_CONTENT"
  | "PROFILE_MAPPING_REQUIRED" | "PROFILE_INCOMPATIBLE" | "NETWORK_PERMISSION_MISMATCH"
  | "STATE_CONTRACT_INCOMPATIBLE" | "ID_CONFLICT" | "RESOURCE_CONFLICT" | "OWNERSHIP_CONFLICT"
  | "ACTIVE_RUN" | "PLAN_STALE" | "GRAPH_NODE_NOT_FOUND" | "MODULE_NOT_INSTALLED";
export interface GraphNodeModuleIssue { code: GraphNodeModuleErrorCode; path: string; message: string; }
export interface GraphNodeModuleInspection {
  valid: boolean;
  package?: GraphNodeModulePackageV4;
  sha256?: string;
  canonicalJson?: string;
  source: string;
  sizeBytes: number;
  issues: GraphNodeModuleIssue[];
}
export interface GraphNodeModuleIdRemapping {
  graphNode: Record<string, string>;
  nodes: Record<string, string>;
  rules: Record<string, string>;
  instructions: Record<string, string>;
  skills: Record<string, string>;
}
export interface GraphNodeModuleProfileCandidate { id: string; name: string; provider: "codex" | "copilot"; networkAccess: boolean; }
export interface GraphNodeModuleProfileMappingPlan {
  slot: GraphNodeModuleProfileSlotV4;
  selectedProfileId?: string;
  candidates: GraphNodeModuleProfileCandidate[];
  compatible: boolean;
  issue?: GraphNodeModuleIssue;
}
export interface GraphNodeModuleResourceWritePlan {
  kind: "instruction" | "skill";
  key: string;
  resourceId: string;
  relativePath: string;
  sha256: string;
  bytes: number;
  action: "create" | "conflict";
}
export interface GraphNodeModuleConflict {
  kind: "id" | "resource" | "ownership";
  code: "ID_CONFLICT" | "RESOURCE_CONFLICT" | "OWNERSHIP_CONFLICT";
  target: string;
  message: string;
  blocking: boolean;
}
export interface GraphNodeModuleInstallPlan {
  planHash: string;
  packageSha256: string;
  source: string;
  module: GraphNodeModuleManifestV4;
  graphNode: ProjectGraphNode;
  idRemapping: GraphNodeModuleIdRemapping;
  resources: GraphNodeModuleResourceWritePlan[];
  profileMappings: GraphNodeModuleProfileMappingPlan[];
  conflicts: GraphNodeModuleConflict[];
  issues: GraphNodeModuleIssue[];
  canInstall: boolean;
}
export interface GraphNodeModuleOwnedResource {
  kind: "instruction" | "skill";
  resourceId: string;
  relativePath: string;
  installedSha256: string;
}
export interface InstalledGraphNodeModuleV4 {
  moduleId: string;
  moduleVersion: string;
  title: string;
  source: string;
  packageSha256: string;
  graphNodeId: string;
  installedAt: string;
  profileMappings: Record<string, string>;
  idRemapping: GraphNodeModuleIdRemapping;
  stateContract: GraphNodeModuleStateContractV4;
  capabilities: GraphNodeModuleCapabilitiesV4;
  ownedResources: GraphNodeModuleOwnedResource[];
  installedContentSha256: string;
}
export interface InstalledGraphNodeModulesFileV4 { version: 4; installed: InstalledGraphNodeModuleV4[]; }
export interface InstalledGraphNodeModuleStatus extends InstalledGraphNodeModuleV4 {
  status: GraphNodeModuleProvenanceStatus;
  currentContentSha256?: string;
  missingResources: string[];
}
export interface GraphNodeModuleLibraryEntry {
  source: string;
  sha256?: string;
  sizeBytes: number;
  valid: boolean;
  manifest?: GraphNodeModuleManifestV4;
  permissions?: GraphNodeModulePermissionsV4;
  package?: GraphNodeModulePackageV4;
  issues: GraphNodeModuleIssue[];
}
export interface GraphNodeModuleExportResult {
  package: GraphNodeModulePackageV4;
  canonicalJson: string;
  sha256: string;
  filename: string;
}
