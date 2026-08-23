import type { JsonValue, NodeResult, ProjectGraphNode, ProjectNodeAppearance } from "./automation.js";

export const graphNodeModulePackageVersion = 5 as const;
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

export interface GraphNodeModuleManifestV5 {
  id: string; title: string; description: string; version: string; category?: string; tags: string[];
}
export interface GraphNodeModulePermissionsV5 {
  network: GraphNodeModuleNetworkRequirement; externalWrites: GraphNodeModuleExternalWritesPermission;
}
export interface GraphNodeModuleProfileSlotV5 {
  key: string; title: string; description: string; providers: Array<"codex" | "copilot">;
  network: GraphNodeModuleNetworkRequirement;
}
export interface GraphNodeModuleCompositionV5 { profileSlot: string; primaryInstruction: string; skills: string[]; }
export interface GraphNodeModuleIntrinsicOutcomeV5 { outcomeId: string; result: NodeResult; }
export interface GraphNodeModuleExecutableV5 extends ProjectNodeAppearance {
  key: string; description: string; task: string;
}
export type GraphNodeModuleWorkNodeV5 =
  | GraphNodeModuleExecutableV5 & GraphNodeModuleCompositionV5 & { type: "agent" }
  | GraphNodeModuleExecutableV5 & { type: "human" };
export type GraphNodeModuleValidationNodeV5 =
  | GraphNodeModuleExecutableV5 & GraphNodeModuleCompositionV5 & { type: "agent" }
  | GraphNodeModuleExecutableV5 & { type: "human" };
export interface GraphNodeModuleJobNodeV5 {
  key: string; description: string; capabilities: { accepts: string[]; provides: string[] };
  outcomes: GraphNodeModuleIntrinsicOutcomeV5[]; maxRetries: number;
  workNode: GraphNodeModuleWorkNodeV5; validationNode: GraphNodeModuleValidationNodeV5;
}
export type GraphNodeModuleRouteTargetV5 = { jobNode: string } | { terminal: NodeResult };
export interface GraphNodeModuleCandidateV5 { target: GraphNodeModuleRouteTargetV5; description: string; }
export interface GraphNodeModuleOrchestratorV5 extends GraphNodeModuleCompositionV5 {
  key: string; description: string; maxTransitions: number; maxRouteAttempts: number;
  routing: {
    start: { key: string; candidates: GraphNodeModuleCandidateV5[] };
    continuation: Array<{ key: string; sourceJobNode: string; result: NodeResult; candidates: GraphNodeModuleCandidateV5[] }>;
    repair: Array<{ key: string; sourceJobNode: string; capability: string; candidates: GraphNodeModuleCandidateV5[] }>;
  };
}
export interface GraphNodeModuleRepairNodeV5 extends GraphNodeModuleCompositionV5 {
  key: string; description: string; task: string; maxRepairDepth: number; maxRepairAttempts: number;
}
export interface GraphNodeModuleGraphNodeV5 {
  key: string; description: string; capabilities: { accepts: string[]; provides: string[] };
  outcomes: GraphNodeModuleIntrinsicOutcomeV5[]; stateContract: { description: string };
  strategy: { kind: "agent_v1"; orchestrator: GraphNodeModuleOrchestratorV5 };
  repairNode?: GraphNodeModuleRepairNodeV5; jobNodes: GraphNodeModuleJobNodeV5[];
}
export type GraphNodeModuleResourceV5 =
  | { kind: "instruction"; key: string; title: string; metadata: Record<string, JsonValue>; body: string }
  | { kind: "skill"; key: string; name: string; description: string; metadata: Record<string, JsonValue>; body: string };
export interface GraphNodeModuleStateContractV5 {
  id: string; version: string; description: string; requiredKeys: string[];
}
export interface GraphNodeModuleRecommendedGraphRouteV5 {
  direction: "incoming" | "outgoing"; outcomeId: string; result: NodeResult; capability: string; description: string;
}
export interface GraphNodeModuleCapabilitiesV5 {
  requires: string[]; accepts: string[]; provides: string[];
  recommendedGraphRoutes: GraphNodeModuleRecommendedGraphRouteV5[];
}
export interface GraphNodeModulePackageV5 {
  format: "ballet-graph-node-module"; version: typeof graphNodeModulePackageVersion;
  manifest: GraphNodeModuleManifestV5; permissions: GraphNodeModulePermissionsV5;
  profileSlots: GraphNodeModuleProfileSlotV5[]; stateContract: GraphNodeModuleStateContractV5;
  capabilities: GraphNodeModuleCapabilitiesV5; resources: GraphNodeModuleResourceV5[];
  graphNode: GraphNodeModuleGraphNodeV5;
}

export type GraphNodeModuleErrorCode =
  | "INVALID_JSON" | "INVALID_UTF8" | "PACKAGE_TOO_LARGE" | "SCHEMA_DOWNGRADE"
  | "INVALID_SCHEMA" | "UNKNOWN_FIELD" | "DUPLICATE_ID" | "FORBIDDEN_CONTENT"
  | "PROFILE_MAPPING_REQUIRED" | "PROFILE_INCOMPATIBLE" | "NETWORK_PERMISSION_MISMATCH"
  | "STATE_CONTRACT_INCOMPATIBLE" | "ID_CONFLICT" | "RESOURCE_CONFLICT" | "OWNERSHIP_CONFLICT"
  | "ACTIVE_RUN" | "PLAN_STALE" | "GRAPH_NODE_NOT_FOUND" | "MODULE_NOT_INSTALLED";
export interface GraphNodeModuleIssue { code: GraphNodeModuleErrorCode; path: string; message: string; }
export interface GraphNodeModuleInspection {
  valid: boolean; package?: GraphNodeModulePackageV5; sha256?: string; canonicalJson?: string;
  source: string; sizeBytes: number; issues: GraphNodeModuleIssue[];
}
export interface GraphNodeModuleIdRemapping {
  graphNode: Record<string, string>; nodes: Record<string, string>; rules: Record<string, string>;
  instructions: Record<string, string>; skills: Record<string, string>;
}
export interface GraphNodeModuleProfileCandidate {
  id: string; name: string; provider: "codex" | "copilot"; networkAccess: boolean;
}
export interface GraphNodeModuleProfileMappingPlan {
  slot: GraphNodeModuleProfileSlotV5; selectedProfileId?: string; candidates: GraphNodeModuleProfileCandidate[];
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
  planHash: string; packageSha256: string; source: string; module: GraphNodeModuleManifestV5;
  graphNode: ProjectGraphNode; idRemapping: GraphNodeModuleIdRemapping;
  resources: GraphNodeModuleResourceWritePlan[]; profileMappings: GraphNodeModuleProfileMappingPlan[];
  conflicts: GraphNodeModuleConflict[]; issues: GraphNodeModuleIssue[]; canInstall: boolean;
}
export interface GraphNodeModuleOwnedResource {
  kind: "instruction" | "skill"; resourceId: string; relativePath: string; installedSha256: string;
}
export interface InstalledGraphNodeModuleV5 {
  moduleId: string; moduleVersion: string; title: string; source: string; packageSha256: string;
  graphNodeId: string; installedAt: string; profileMappings: Record<string, string>;
  idRemapping: GraphNodeModuleIdRemapping; stateContract: GraphNodeModuleStateContractV5;
  capabilities: GraphNodeModuleCapabilitiesV5; ownedResources: GraphNodeModuleOwnedResource[];
  installedContentSha256: string;
}
export interface InstalledGraphNodeModulesFileV5 { version: 5; installed: InstalledGraphNodeModuleV5[]; }
export interface InstalledGraphNodeModuleStatus extends InstalledGraphNodeModuleV5 {
  status: GraphNodeModuleProvenanceStatus; currentContentSha256?: string; missingResources: string[];
}
export interface GraphNodeModuleLibraryEntry {
  source: string; sha256?: string; sizeBytes: number; valid: boolean; manifest?: GraphNodeModuleManifestV5;
  permissions?: GraphNodeModulePermissionsV5; package?: GraphNodeModulePackageV5; issues: GraphNodeModuleIssue[];
}
export interface GraphNodeModuleExportResult {
  package: GraphNodeModulePackageV5; canonicalJson: string; sha256: string; filename: string;
}
